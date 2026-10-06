from __future__ import annotations
import uuid
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.ai.ai_artifact import AiArtifact
class ArtifactRepository:
    def __init__(self,db:AsyncSession): self.db=db
    async def list_for_task(self,task_id:uuid.UUID):
        r=await self.db.exec(select(AiArtifact).where(AiArtifact.task_id==task_id).order_by(AiArtifact.created_at.desc())); return list(r.all())
    async def get(self,artifact_id:uuid.UUID): return await self.db.get(AiArtifact,artifact_id)
