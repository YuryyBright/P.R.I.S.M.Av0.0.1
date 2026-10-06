from __future__ import annotations
from uuid import UUID
from app.ai.analysis.checkpoint import AnalysisCheckpoint, CheckpointStore
from app.ai.tasks.repository import TaskRepository

class DbTaskCheckpointStore(CheckpointStore):
    def __init__(self, session_factory): self.sf=session_factory
    async def load(self, analysis_id: UUID):
        async with self.sf() as db:
            task=await TaskRepository(db).get(analysis_id)
            if not task or not task.checkpoint: return None
            return AnalysisCheckpoint(analysis_id,tuple(UUID(x) for x in task.checkpoint.get("completed_document_ids",[])),tuple(task.checkpoint.get("completed_batch_ids",[])))
    async def save(self, checkpoint):
        async with self.sf() as db:
            await TaskRepository(db).set_state(checkpoint.analysis_id,checkpoint={"completed_document_ids":[str(x) for x in checkpoint.completed_document_ids],"completed_batch_ids":list(checkpoint.completed_batch_ids)})
            await db.commit()
