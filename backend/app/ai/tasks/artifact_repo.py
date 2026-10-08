from __future__ import annotations
import uuid
from typing import Any, Sequence, cast

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.ai.ai_artifact import AiArtifact


class ArtifactRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _columns() -> Any:
        # SQLModel exposes __table__ at runtime, but its typing omits it.
        return cast(Any, AiArtifact).__table__.c

    async def list_for_task(self, task_id: uuid.UUID) -> Sequence[AiArtifact]:
        statement = (
            select(AiArtifact)
            .where(self._columns().task_id == task_id)
            .order_by(self._columns().created_at.desc())
        )
        result = await self.db.exec(statement)
        return result.all()

    async def get(self, artifact_id: uuid.UUID) -> AiArtifact | None:
        return await self.db.get(AiArtifact, artifact_id)
