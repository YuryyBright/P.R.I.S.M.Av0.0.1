from __future__ import annotations

from typing import Callable
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.analysis.checkpoint import AnalysisCheckpoint, CheckpointStore
from app.ai.tasks.repository import TaskRepository


def _string_values(value: object) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(item for item in value if isinstance(item, str))


class DbTaskCheckpointStore(CheckpointStore):
    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self.sf = session_factory

    async def load(self, analysis_id: UUID) -> AnalysisCheckpoint | None:
        async with self.sf() as db:
            task = await TaskRepository(db).get(analysis_id)
            if task is None or not task.checkpoint:
                return None
            document_ids = _string_values(
                task.checkpoint.get("completed_document_ids", [])
            )
            batch_ids = _string_values(task.checkpoint.get("completed_batch_ids", []))
            return AnalysisCheckpoint(
                analysis_id=analysis_id,
                completed_document_ids=tuple(UUID(value) for value in document_ids),
                completed_batch_ids=batch_ids,
            )

    async def save(self, checkpoint: AnalysisCheckpoint) -> None:
        async with self.sf() as db:
            await TaskRepository(db).set_state(
                checkpoint.analysis_id,
                checkpoint={
                    "completed_document_ids": [
                        str(value) for value in checkpoint.completed_document_ids
                    ],
                    "completed_batch_ids": list(checkpoint.completed_batch_ids),
                },
            )
            await db.commit()
