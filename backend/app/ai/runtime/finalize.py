"""Finalize: створення RagMessage + rag_citations і перехід run у термінальний статус.

RagMessage append-only → асистентське повідомлення пишеться ОДИН раз, наприкінці
(повністю або частково при cancel). Викликається через asyncio.shield з НОВОЮ сесією,
тому CancelledError / відключення клієнта не обривають commit.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import RunStatus
from app.ai.domain.events import CitationEvent
from app.ai.repositories.run_repo import RunRepository
from app.ai.runtime.context import RunContext
from app.models.rag.rag_base import utcnow
from app.models.rag.rag_citation import RagCitation
from app.models.rag.rag_conversation import RagConversation
from app.models.rag.rag_message import RagMessage
from app.rag.domain.enums import MessageRole

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class Outcome:
    status: RunStatus = RunStatus.COMPLETED
    error_code: str | None = None
    error_message: str | None = None


@dataclass(slots=True)
class FinalizeResult:
    status: RunStatus
    message_id: uuid.UUID | None
    finish_reason: str | None
    citations: list[CitationEvent]
    usage: dict[str, int]
    error_code: str | None
    error_message: str | None


async def finalize_run(session_factory: Callable[[], AsyncSession], ctx: RunContext,
                       outcome: Outcome) -> FinalizeResult:
    st = ctx.state
    answer = st.answer
    usage = {"prompt_tokens": st.prompt_tokens, "completion_tokens": st.completion_tokens}
    save_message = outcome.status == RunStatus.COMPLETED or (
        outcome.status == RunStatus.CANCELLED and answer.strip())
    if outcome.status == RunStatus.CANCELLED:
        finish_reason: str | None = "cancelled"
    elif outcome.status == RunStatus.FAILED:
        finish_reason = "error"
    else:
        finish_reason = st.finish_reason or "stop"

    events: list[CitationEvent] = []
    message_id: uuid.UUID | None = None
    status, code, msg = outcome.status, outcome.error_code, outcome.error_message

    async with session_factory() as db:
        if save_message:
            message = RagMessage(
                conversation_id=ctx.conversation_id, role=MessageRole.ASSISTANT, content=answer,
                model=ctx.config.model, prompt_tokens=st.prompt_tokens or None,
                completion_tokens=st.completion_tokens or None,
                finish_reason=(finish_reason or "stop")[:32],
                meta={"run_id": str(ctx.run_id), "mode": ctx.config.mode.value,
                      "prompt_version_ids": {k: str(v) for k, v in ctx.config.prompt_version_ids.items()},
                      "profile_id": str(ctx.config.profile_id) if ctx.config.profile_id else None},
            )
            db.add(message)
            await db.flush()
            message_id = message.id
            for n, chunk in ctx.citations.referenced(answer):
                db.add(RagCitation(
                    message_id=message.id, document_id=chunk.document_id, chunk_id=chunk.chunk_id,
                    rank=n, score=chunk.rerank_score if chunk.rerank_score is not None else chunk.score,
                    citation_text=chunk.text,
                    meta={"title": chunk.document_title, "url": chunk.document_url, "page": chunk.page,
                          "heading_path": chunk.heading_path, "retrieval_score": chunk.score,
                          "rerank_score": chunk.rerank_score}))
                events.append(CitationEvent(
                    rank=n, chunk_id=chunk.chunk_id, document_id=chunk.document_id,
                    document_title=chunk.document_title, page=chunk.page, url=chunk.document_url,
                    text=chunk.text))
        updated = await RunRepository(db).finish(
            ctx.run_id, status, assistant_message_id=message_id, usage=usage,
            error_code=code, error_message=msg)
        if not updated:
            # run уже термінальний (його закрив sweeper): повідомлення не публікуємо
            await db.rollback()
            logger.warning("finalize skipped: run %s already terminal", ctx.run_id)
            return FinalizeResult(status, None, finish_reason, [], usage, code, msg)
        conv = await db.get(RagConversation, ctx.conversation_id)
        if conv is not None:
            conv.updated_at = utcnow()
        await db.commit()
    return FinalizeResult(status, message_id, finish_reason, events, usage, code, msg)
