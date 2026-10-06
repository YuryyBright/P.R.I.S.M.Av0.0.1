"""RunRunner — спільний «двигун» для chat і agent.

Executor (async-генератор) нічого не знає про транспорт. Раннер:
  claim → load → run.started → [executor events → bus (з коалесингом токенів);
  StepRecord → БД] → finalize (shield, нова сесія) → citation* → run.finished → bus.finish.

Скасування: sidecar опитує прапорець і ставить ctx.cancel_event; pump чекає на
«наступна подія АБО cancel» одночасно, тож скасування спрацьовує навіть коли LLM мовчить.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from typing import Any, Callable, Mapping

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import RunMode, RunStatus, StepType
from app.ai.domain.events import (
    RunFinished, RunStarted, StepStarted, TokenDelta, UsageEvent,
)
from app.ai.domain.exceptions import RunCancelled
from app.ai.domain.ports import CancelStore, EventBus, Executor
from app.ai.domain.records import AnyEvent, StepRecord
from app.ai.runtime.coalescer import DeltaCoalescer
from app.ai.runtime.context import RunContext
from app.ai.runtime.finalize import FinalizeResult, Outcome, finalize_run
from app.ai.runtime.heartbeat import run_sidecar
from app.ai.runtime.loader import RunLoader
from app.ai.runtime.recorder import RunRecorder
from app.ai.settings import AiSettings

logger = logging.getLogger(__name__)


class _Emitter:
    """Проставляє run_id/seq і публікує в bus. Збій bus не валить run (фінал іде через БД)."""

    def __init__(self, bus: EventBus, run_id: uuid.UUID, settings: AiSettings) -> None:
        self._bus, self._run_id, self._seq = bus, run_id, 0
        self._coalescer = DeltaCoalescer(
            self._publish, interval_s=settings.bus.flush_interval_ms / 1000,
            max_chars=settings.bus.flush_max_chars)

    async def _publish(self, ev: AnyEvent) -> None:
        self._seq += 1
        ev.run_id, ev.seq = self._run_id, self._seq
        try:
            await self._bus.publish(self._run_id, ev)
        except Exception:
            logger.warning("bus publish failed run=%s type=%s", self._run_id, ev.type, exc_info=True)

    async def emit(self, ev: AnyEvent) -> None:
        await self._coalescer.push(ev)

    async def flush(self) -> None:
        await self._coalescer.flush()

    async def emit_now(self, ev: AnyEvent) -> None:
        await self._coalescer.flush()
        await self._publish(ev)


class RunRunner:
    def __init__(self, *, session_factory: Callable[[], AsyncSession], settings: AiSettings,
                 bus: EventBus, cancel: CancelStore, loader: RunLoader, recorder: RunRecorder,
                 executors: Mapping[RunMode, Executor]) -> None:
        self._sf, self._settings = session_factory, settings
        self._bus, self._cancel = bus, cancel
        self._loader, self._recorder, self._executors = loader, recorder, executors

    # ---- overridable (тести підміняють БД-частини) -------------------------------

    async def _finalize(self, ctx: RunContext, outcome: Outcome) -> FinalizeResult:
        return await finalize_run(self._sf, ctx, outcome)

    async def _write_step(self, ctx: RunContext, rec: StepRecord) -> None:
        await self._recorder.write_step(
            run_id=ctx.run_id, user_id=ctx.user_id, conversation_id=ctx.conversation_id,
            llm_model=ctx.config.model, rec=rec)

    # ---- public ------------------------------------------------------------------

    async def execute(self, run_id: uuid.UUID) -> None:
        if not await self._loader.claim(run_id):
            logger.info("run %s not claimable (already started/terminal) — skip", run_id)
            return
        emitter = _Emitter(self._bus, run_id, self._settings)
        try:
            ctx = await self._loader.load(run_id)
        except Exception as e:
            logger.exception("run %s: prepare failed", run_id)
            await self._loader.fail_early(run_id, "prepare_failed", f"{type(e).__name__}: {e}")
            await self._close_stream(emitter, run_id, RunStatus.FAILED, "prepare_failed", str(e))
            return

        sidecar = asyncio.create_task(run_sidecar(
            run_id=run_id, session_factory=self._sf, cancel_store=self._cancel,
            cancel_event=ctx.cancel_event, heartbeat_s=self._settings.agent.heartbeat_s))
        outcome = Outcome()
        interrupted: BaseException | None = None
        try:
            await emitter.emit_now(RunStarted(mode=ctx.config.mode, model=ctx.config.model,
                                              config=ctx.config.public()))
            if await self._cancel.is_requested(run_id):
                raise RunCancelled()
            await self._pump(ctx, self._executors[ctx.config.mode].run(ctx), emitter)
            if not ctx.state.answer.strip():
                outcome = Outcome(RunStatus.FAILED, "empty_response", "Model returned an empty answer")
        except RunCancelled:
            outcome = Outcome(RunStatus.CANCELLED)
        except asyncio.CancelledError as e:                 # shutdown процесу / відміна таска
            outcome = Outcome(RunStatus.FAILED, "interrupted", "Run was interrupted")
            interrupted = e
        except Exception as e:
            logger.exception("run %s failed", run_id)
            outcome = Outcome(RunStatus.FAILED, getattr(e, "code", None) or "executor_error",
                              f"{type(e).__name__}: {e}"[:1000])
        finally:
            sidecar.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await sidecar
            with contextlib.suppress(Exception):
                await emitter.flush()

        result = await asyncio.shield(self._finalize_safe(ctx, outcome))
        await self._publish_final(emitter, run_id, result)
        if interrupted is not None:
            raise interrupted

    # ---- internals ---------------------------------------------------------------

    async def _pump(self, ctx: RunContext, stream: Any, emitter: _Emitter) -> None:
        it = stream.__aiter__()
        cancel_wait = asyncio.ensure_future(ctx.cancel_event.wait())
        try:
            while True:
                nxt = asyncio.ensure_future(it.__anext__())
                done, _ = await asyncio.wait({nxt, cancel_wait}, return_when=asyncio.FIRST_COMPLETED)
                if cancel_wait in done and nxt not in done:
                    nxt.cancel()
                    with contextlib.suppress(asyncio.CancelledError, StopAsyncIteration, Exception):
                        await nxt
                    raise RunCancelled()
                try:
                    item = nxt.result()
                except StopAsyncIteration:
                    return
                if isinstance(item, StepRecord):
                    await self._write_step(ctx, item)
                    continue
                self._track(ctx, item)
                await emitter.emit(item)
        finally:
            cancel_wait.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await cancel_wait
            aclose = getattr(it, "aclose", None)
            if aclose is not None:
                with contextlib.suppress(Exception):
                    await aclose()

    @staticmethod
    def _track(ctx: RunContext, ev: AnyEvent) -> None:
        st = ctx.state
        if isinstance(ev, StepStarted) and ev.kind == StepType.LLM_CALL:
            st.parts.clear()                    # відповідь = текст ОСТАННЬОГО llm_call-кроку
        elif isinstance(ev, TokenDelta):
            st.parts.append(ev.text)
        elif isinstance(ev, UsageEvent):
            st.prompt_tokens += ev.prompt_tokens
            st.completion_tokens += ev.completion_tokens

    async def _finalize_safe(self, ctx: RunContext, outcome: Outcome) -> FinalizeResult:
        try:
            return await self._finalize(ctx, outcome)
        except Exception as e:
            logger.exception("finalize failed run=%s", ctx.run_id)
            with contextlib.suppress(Exception):
                await self._loader.fail_early(ctx.run_id, "finalize_failed", f"{type(e).__name__}: {e}")
            return FinalizeResult(RunStatus.FAILED, None, "error", [], {}, "finalize_failed", str(e))

    async def _publish_final(self, emitter: _Emitter, run_id: uuid.UUID, r: FinalizeResult) -> None:
        for c in r.citations:
            await emitter.emit_now(c)
        await emitter.emit_now(RunFinished(
            status=r.status, message_id=r.message_id, finish_reason=r.finish_reason,
            error_code=r.error_code, error_message=r.error_message, usage=r.usage))
        with contextlib.suppress(Exception):
            await self._bus.finish(run_id)

    async def _close_stream(self, emitter: _Emitter, run_id: uuid.UUID, status: RunStatus,
                            code: str, message: str) -> None:
        await emitter.emit_now(RunFinished(status=status, error_code=code, error_message=message[:500]))
        with contextlib.suppress(Exception):
            await self._bus.finish(run_id)
