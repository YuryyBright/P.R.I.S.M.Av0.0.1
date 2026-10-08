"""ChatPipeline (Executor): [rewrite] → retrieve → generate → перевірка цитат (retry) → refusal.

Нічого не знає про HTTP/Celery/Redis/БД: бере все з RunContext, віддає RunEvent/StepRecord.
"""
from __future__ import annotations

import time
from contextlib import aclosing
from typing import Any, AsyncIterator

from app.ai.domain.enums import StepStatus, StepType
from app.ai.domain.events import (
    ChunkRef, RetrievalDone, StepFinished, StepStarted, TokenDelta, UsageEvent,
)
from app.ai.domain.exceptions import RunCancelled
from app.ai.domain.records import ExecutorOutput, RetrievalLog, StepRecord
from app.ai.llm.types import (
    ChatMessage, ChatRequest, Finished, LLMUsage, TextDelta,
)
from app.ai.prompts.protocol import format_sources
from app.ai.runtime.context import RunContext
from app.rag.retrieval.types import RetrievalRequest, RetrievedChunk

from app.ai.domain.ports import LLMClient

PREVIEW_CHARS = 200
CITATION_REMINDER = (
    "Your previous answer contained no valid source citations. Rewrite it so that every claim "
    "taken from the sources is followed by its source number in square brackets, e.g. [1]. "
    "Use only the source numbers provided."
)


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def chunk_refs(items: list[tuple[int, RetrievedChunk]]) -> list[ChunkRef]:
    return [ChunkRef(n=n, chunk_id=c.chunk_id, document_id=c.document_id,
                     document_title=c.document_title, page=c.page, score=c.score,
                     rerank_score=c.rerank_score, preview=c.text[:PREVIEW_CHARS]) for n, c in items]


class ChatPipeline:
    def __init__(self, llm: LLMClient, retrieval: Any) -> None:
        self._llm, self._retrieval = llm, retrieval

    async def run(self, ctx: RunContext) -> AsyncIterator[ExecutorOutput]:
        cfg, chat = ctx.config, ctx.settings.chat
        question = ctx.user_text
        sources_block: str | None = None

        # ---- 1) retrieval -----------------------------------------------------------
        if cfg.rag_enabled:
            rewritten = await self._maybe_rewrite(ctx)
            for out in rewritten.outputs:
                yield out
            query = rewritten.query

            idx = ctx.next_step_idx()
            yield StepStarted(idx=idx, kind=StepType.RETRIEVAL, title="Пошук у базі знань")
            t0 = time.perf_counter()
            result = await self._retrieval.retrieve(ctx.user, RetrievalRequest(
                query=query, collection_ids=cfg.collection_ids,
                rerank=cfg.rerank.enabled, top_k=cfg.rerank.top_k))
            items = ctx.citations.register_all(result.chunks)
            latency = _ms(t0)
            yield RetrievalDone(
                query=ctx.user_text, rewritten_query=query if query != ctx.user_text else None,
                chunks=chunk_refs(items), reranked=result.trace.reranked, latency_ms=latency,
                warnings=result.trace.warnings)
            yield StepRecord(
                idx=idx, type=StepType.RETRIEVAL, name="retrieve", latency_ms=latency,
                input={"query": ctx.user_text, "rewritten_query": query if query != ctx.user_text else None,
                       "collection_ids": [str(c) for c in cfg.collection_ids] if cfg.collection_ids is not None else None},
                output={"chunks": [{"n": n, "chunk_id": str(c.chunk_id), "document_id": str(c.document_id),
                                    "score": c.score, "rerank_score": c.rerank_score} for n, c in items]},
                retrieval=RetrievalLog(
                    ctx.user_text,
                    query if query != ctx.user_text else None,
                    result.trace.to_persistence_dict(),
                ))
            yield StepFinished(idx=idx, kind=StepType.RETRIEVAL, latency_ms=latency,
                               summary=f"{len(items)} фрагм.")

            if not items:
                if chat.refuse_when_empty:
                    async for out in self._refuse(ctx, "Немає релевантних джерел"):
                        yield out
                    return
            else:
                sources_block = format_sources(items)

        # ---- 2) generation (+ retry за цитатами) ---------------------------------------
        user_content = question if sources_block is None else f"{question}\n\n{sources_block}"
        messages: list[ChatMessage] = [
            ChatMessage("system", ctx.system_prompt), *ctx.history, ChatMessage("user", user_content)]
        need_citations = bool(sources_block) and chat.require_citations
        attempts = 1 + (chat.citation_retry if need_citations else 0)

        for attempt in range(attempts):
            if ctx.cancelled:
                raise RunCancelled()
            idx = ctx.next_step_idx()
            title = "Генерація відповіді" if attempt == 0 else "Повторна генерація (цитати)"
            yield StepStarted(idx=idx, kind=StepType.LLM_CALL, title=title)
            t0 = time.perf_counter()
            parts: list[str] = []
            usage: LLMUsage | None = None
            finish = "stop"
            req = ChatRequest(messages=messages, model=cfg.model, temperature=cfg.temperature,
                              max_tokens=cfg.max_tokens)
            async with aclosing(self._llm.stream(req)) as stream:
                async for ev in stream:
                    if ctx.cancelled:
                        raise RunCancelled()
                    if isinstance(ev, TextDelta):
                        parts.append(ev.text)
                        yield TokenDelta(text=ev.text)
                    elif isinstance(ev, LLMUsage):
                        usage = ev
                        yield UsageEvent(prompt_tokens=ev.prompt_tokens, completion_tokens=ev.completion_tokens)
                    elif isinstance(ev, Finished):
                        finish = ev.reason
            text = "".join(parts)
            if usage and ctx.budget:
                ctx.budget.add_tokens(usage.prompt_tokens, usage.completion_tokens)
            latency = _ms(t0)
            yield StepRecord(
                idx=idx, type=StepType.LLM_CALL, name="answer" if attempt == 0 else "answer_retry",
                latency_ms=latency, prompt_tokens=usage.prompt_tokens if usage else None,
                completion_tokens=usage.completion_tokens if usage else None,
                input={"model": cfg.model, "n_messages": len(messages), "attempt": attempt,
                       "prompt_versions": {k: str(v) for k, v in cfg.prompt_version_ids.items()}},
                output={"content": text, "finish_reason": finish})
            yield StepFinished(idx=idx, kind=StepType.LLM_CALL, latency_ms=latency)
            ctx.state.finish_reason = finish

            if not need_citations or ctx.citations.parse(text):
                return
            if attempt < attempts - 1:
                messages = [*messages, ChatMessage("assistant", text), ChatMessage("user", CITATION_REMINDER)]

        # цитат нема навіть після retry → refusal замість неперевіреної відповіді
        async for out in self._refuse(ctx, "Відповідь без підтвердження джерелами"):
            yield out

    # ---- helpers -------------------------------------------------------------------

    async def _refuse(self, ctx: RunContext, title: str) -> AsyncIterator[ExecutorOutput]:
        idx = ctx.next_step_idx()
        yield StepStarted(idx=idx, kind=StepType.LLM_CALL, title=title)    # скидає буфер відповіді
        yield TokenDelta(text=ctx.settings.chat.refusal_message)
        yield StepFinished(idx=idx, kind=StepType.LLM_CALL, summary="refusal")
        ctx.state.finish_reason = "refused"

    async def _maybe_rewrite(self, ctx: RunContext) -> "_Rewrite":
        chat = ctx.settings.chat
        if not (chat.query_rewrite and ctx.rewrite_prompt and ctx.history):
            return _Rewrite(ctx.user_text, [])
        idx = ctx.next_step_idx()
        outs: list[ExecutorOutput] = [StepStarted(idx=idx, kind=StepType.LLM_CALL, title="Уточнення запиту")]
        t0 = time.perf_counter()
        hist = "\n".join(f"{m.role}: {m.text}" for m in ctx.history)
        req = ChatRequest(
            messages=[ChatMessage("system", ctx.rewrite_prompt),
                      ChatMessage("user", f"Історія:\n{hist}\n\nПитання: {ctx.user_text}")],
            model=ctx.config.model, temperature=0.0, max_tokens=160)
        status, query, usage = StepStatus.OK, ctx.user_text, None
        try:
            res = await self._llm.complete(req)
            candidate = res.text.strip().strip('"').strip()
            if candidate:
                query = candidate[: chat.rewrite_max_chars]
            usage = res.usage
        except Exception:                                   # rewrite — оптимізація, не критичний шлях
            status = StepStatus.ERROR
        if usage:
            outs.append(UsageEvent(prompt_tokens=usage.prompt_tokens, completion_tokens=usage.completion_tokens))
            if ctx.budget:
                ctx.budget.add_tokens(usage.prompt_tokens, usage.completion_tokens)
        latency = _ms(t0)
        outs.append(StepRecord(
            idx=idx, type=StepType.LLM_CALL, name="query_rewrite", status=status, latency_ms=latency,
            prompt_tokens=usage.prompt_tokens if usage else None,
            completion_tokens=usage.completion_tokens if usage else None,
            input={"model": ctx.config.model, "question": ctx.user_text}, output={"query": query}))
        outs.append(StepFinished(idx=idx, kind=StepType.LLM_CALL, ok=status == StepStatus.OK,
                                 latency_ms=latency, summary=query))
        return _Rewrite(query, outs)


class _Rewrite:
    __slots__ = ("query", "outputs")

    def __init__(self, query: str, outputs: list[ExecutorOutput]) -> None:
        self.query, self.outputs = query, outputs
