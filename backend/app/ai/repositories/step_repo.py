from __future__ import annotations

import uuid

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.records import StepRecord
from app.models.ai.ai_run_step import AiRunStep


class StepRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def add(self, run_id: uuid.UUID, rec: StepRecord) -> AiRunStep:
        step = AiRunStep(
            run_id=run_id, idx=rec.idx, type=rec.type, name=rec.name, status=rec.status,
            input=rec.input, output=rec.output, latency_ms=rec.latency_ms,
            prompt_tokens=rec.prompt_tokens, completion_tokens=rec.completion_tokens)
        self.db.add(step)
        await self.db.flush()
        return step

    async def list_for_run(self, run_id: uuid.UUID) -> list[AiRunStep]:
        rows = await self.db.exec(select(AiRunStep).where(AiRunStep.run_id == run_id)
                                  .order_by(AiRunStep.idx))
        return list(rows.all())
