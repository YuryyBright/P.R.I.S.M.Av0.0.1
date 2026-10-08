"""AgentLoop (Executor): llm.stream(tools) → tool_calls → виконати → повторити, інакше фінал.

Ліміти: max_steps / max_tool_calls / token_budget / wall-clock (RunBudget). Дублікати
викликів не виконуються. Коли бюджет вичерпано — останній виклик з tool_choice="none".
Кожен tool_call має отримати tool-повідомлення (протокол OpenAI) — навіть відхилений.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import aclosing
from typing import Any, AsyncIterator

from pydantic import ValidationError

from app.ai.agent.tools.registry import ToolRegistry
from app.ai.domain.enums import StepStatus, StepType
from app.ai.domain.events import (
    RetrievalDone, StepFinished, StepStarted, TokenDelta, ToolCallEvent, ToolResultEvent, UsageEvent,
)
from app.ai.domain.exceptions import DomainError, RunCancelled, ToolError
from app.ai.domain.ports import LLMClient
from app.ai.domain.records import ExecutorOutput, RetrievalLog, StepRecord
from app.ai.chat.pipeline import chunk_refs
from app.ai.llm.types import (
    ChatMessage, ChatRequest, Finished, LLMUsage, TextDelta, ToolCall, ToolCallReady,
)
from app.ai.runtime.context import RunContext

logger = logging.getLogger(__name__)

MAX_REPEATED_CALLS = 3


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def _brief_validation_error(e: ValidationError) -> str:
    return "; ".join(f"{'.'.join(str(p) for p in err['loc']) or 'args'}: {err['msg']}"
                     for err in e.errors()[:5])


class AgentLoop:
    def __init__(self, llm: LLMClient, tools: ToolRegistry) -> None:
        self._llm, self._tools = llm, tools

    async def run(self, ctx: RunContext) -> AsyncIterator[ExecutorOutput]:
        cfg, budget = ctx.config, ctx.budget
        assert budget is not None
        specs = self._tools.specs(cfg.allowed_tools)
        messages: list[ChatMessage] = [
            ChatMessage("system", ctx.system_prompt), *ctx.history, ctx.user_message]
        seen: dict[str, int] = {}
        repeated = 0

        while True:
            if ctx.cancelled:
                raise RunCancelled()
            force_reason = budget.exceeded() or ("repeated_calls" if repeated >= MAX_REPEATED_CALLS else None)
            if force_reason:
                messages = [*messages, ChatMessage(
                    "user", f"Tool budget exhausted ({force_reason}). Give your final answer now "
                            "using the information gathered so far; do not call tools.")]

            idx = ctx.next_step_idx()
            title = "Фінальна відповідь" if force_reason else f"Крок {budget.steps + 1}"
            yield StepStarted(idx=idx, kind=StepType.LLM_CALL, title=title)
            t0 = time.perf_counter()
            parts: list[str] = []
            calls: list[ToolCall] = []
            usage: LLMUsage | None = None
            finish = "stop"
            req = ChatRequest(
                messages=messages, model=cfg.model, temperature=cfg.temperature, max_tokens=cfg.max_tokens,
                tools=specs or None, tool_choice="none" if (force_reason or not specs) else "auto")
            async with aclosing(self._llm.stream(req)) as stream:
                async for ev in stream:
                    if ctx.cancelled:
                        raise RunCancelled()
                    if isinstance(ev, TextDelta):
                        parts.append(ev.text)
                        yield TokenDelta(text=ev.text)
                    elif isinstance(ev, ToolCallReady):
                        calls.append(ev.call)
                    elif isinstance(ev, LLMUsage):
                        usage = ev
                        yield UsageEvent(prompt_tokens=ev.prompt_tokens, completion_tokens=ev.completion_tokens)
                    elif isinstance(ev, Finished):
                        finish = ev.reason
            budget.steps += 1
            if usage:
                budget.add_tokens(usage.prompt_tokens, usage.completion_tokens)
            text = "".join(parts)
            latency = _ms(t0)
            will_call = bool(calls) and not force_reason
            yield StepRecord(
                idx=idx, type=StepType.LLM_CALL, name="forced_final" if force_reason else "agent_step",
                latency_ms=latency, prompt_tokens=usage.prompt_tokens if usage else None,
                completion_tokens=usage.completion_tokens if usage else None,
                input={"model": cfg.model, "n_messages": len(messages), "tools": cfg.allowed_tools,
                       "tool_choice": req.tool_choice},
                output={"content": text, "finish_reason": finish,
                        "tool_calls": [{"id": c.id, "name": c.name, "arguments": c.arguments} for c in calls]})
            yield StepFinished(idx=idx, kind=StepType.LLM_CALL, latency_ms=latency, has_tool_calls=will_call)

            if not will_call:
                ctx.state.finish_reason = f"budget:{force_reason}"[:32] if force_reason else \
                    ("stop" if finish == "tool_calls" else finish)
                return

            messages = [*messages, ChatMessage("assistant", text, tool_calls=tuple(calls))]
            for call in calls:
                if ctx.cancelled:
                    raise RunCancelled()
                tool_msg: ChatMessage | None = None
                async for out in self._execute_call(ctx, call, seen):
                    if isinstance(out, ChatMessage):
                        tool_msg = out
                    else:
                        if isinstance(out, ToolResultEvent) and "Duplicate call" in out.summary:
                            repeated += 1
                        yield out
                assert tool_msg is not None
                messages = [*messages, tool_msg]

    # ---- один tool-виклик ------------------------------------------------------------

    async def _execute_call(self, ctx: RunContext, call: ToolCall, seen: dict[str, int]
                            ) -> AsyncIterator[Any]:
        budget = ctx.budget
        assert budget is not None
        idx = ctx.next_step_idx()
        yield StepStarted(idx=idx, kind=StepType.TOOL_CALL, title=call.name)
        yield ToolCallEvent(id=call.id, name=call.name, args=call.arguments)
        t0 = time.perf_counter()
        ok, content, summary = True, "", ""
        out = None

        tool = self._tools.get(call.name)
        key = call.name + json.dumps(call.arguments, sort_keys=True, ensure_ascii=False, default=str)
        if call.parse_error:
            ok, content = False, "Invalid JSON in tool arguments. Send a valid JSON object."
        elif tool is None or call.name not in ctx.config.allowed_tools:
            ok, content = False, f"Unknown or disallowed tool: {call.name!r}."
        elif budget.tool_calls >= budget.max_tool_calls:
            ok, content = False, "Tool call limit reached. Provide the final answer."
        elif seen.get(key, 0) >= 1:
            seen[key] += 1
            ok, content = False, "Duplicate call ignored: reuse the result you already have."
            summary = "Duplicate call ignored"
        else:
            seen[key] = 1
            budget.tool_calls += 1
            try:
                args = tool.args_model.model_validate(call.arguments)
            except ValidationError as e:
                ok, content = False, f"Invalid arguments: {_brief_validation_error(e)}"
            else:
                timeout = max(1.0, min(60.0, budget.wall_clock_s - budget.elapsed_s))
                try:
                    out = await asyncio.wait_for(tool.run(ctx, args), timeout=timeout)
                    content, summary = out.for_llm, out.ui_summary
                except asyncio.TimeoutError:
                    ok, content = False, "Tool timed out."
                except ToolError as e:
                    ok, content = False, str(e)
                except DomainError as e:
                    ok, content = False, e.detail
                except Exception:
                    logger.exception("tool %s crashed run=%s", call.name, ctx.run_id)
                    ok, content = False, "Tool failed with an internal error."

        content = content[: ctx.settings.agent.tool_result_max_chars]
        summary = summary or (content[:160] if not ok else "ok")
        latency = _ms(t0)

        if out is not None and out.retrieval is not None:
            ridx = ctx.next_step_idx()
            rewritten = None
            yield RetrievalDone(query=out.query or "", rewritten_query=rewritten,
                                chunks=chunk_refs(out.numbered), reranked=out.retrieval.trace.reranked,
                                latency_ms=out.retrieval.trace.latency_ms,
                                warnings=out.retrieval.trace.warnings)
            yield StepRecord(
                idx=ridx, type=StepType.RETRIEVAL, name=call.name,
                latency_ms=out.retrieval.trace.latency_ms,
                input={"query": out.query, "tool_call_id": call.id},
                output={"chunks": [{"n": n, "chunk_id": str(c.chunk_id), "score": c.score,
                                    "rerank_score": c.rerank_score} for n, c in out.numbered]},
                retrieval=RetrievalLog(
                    out.query or "", None, out.retrieval.trace.to_persistence_dict()
                ))

        yield StepRecord(
            idx=idx, type=StepType.TOOL_CALL, name=call.name,
            status=StepStatus.OK if ok else StepStatus.ERROR, latency_ms=latency,
            input={"tool_call_id": call.id, "name": call.name, "args": call.arguments},
            output={"content": content, "ok": ok, "summary": summary,
                    "chunk_ids": out.chunk_ids if out is not None else [],
                    "artifacts": out.artifacts if out is not None else []})
        yield ToolResultEvent(id=call.id, ok=ok, summary=summary, latency_ms=latency)
        yield StepFinished(idx=idx, kind=StepType.TOOL_CALL, ok=ok, latency_ms=latency, summary=summary)
        yield ChatMessage("tool", content, tool_call_id=call.id)
