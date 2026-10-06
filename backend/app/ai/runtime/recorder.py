"""RunRecorder: запис завершених кроків у ai_run_steps (+ rag_queries для retrieval).

Кожен запис — коротка сесія й свій commit. Крок пишеться один раз (immutable).
"""
from __future__ import annotations

import uuid
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import StepType
from app.ai.domain.records import StepRecord
from app.ai.repositories.step_repo import StepRepository
from app.models.rag.rag_query import RagQuery


class RunRecorder:
    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._sf = session_factory

    async def write_step(self, *, run_id: uuid.UUID, user_id: uuid.UUID,
                         conversation_id: uuid.UUID, llm_model: str, rec: StepRecord) -> None:
        async with self._sf() as db:
            step = await StepRepository(db).add(run_id, rec)
            if rec.type == StepType.RETRIEVAL and rec.retrieval is not None:
                trace = rec.retrieval.trace
                db.add(
                RagQuery(
                    user_id=user_id,
                    conversation_id=conversation_id,
                    run_id=run_id,
                    step_id=step.id,
                    query_text=rec.retrieval.query_text,
                    rewritten_query=rec.retrieval.rewritten_query,
                    llm_model=llm_model,
                    **trace.to_persistence_dict(),
                )
            )
            await db.commit()
