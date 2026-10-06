from __future__ import annotations

import uuid

from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.ai.agent_profile import AiAgentProfile


class ProfileRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, profile_id: uuid.UUID) -> AiAgentProfile | None:
        return await self.db.get(AiAgentProfile, profile_id)

    def add(self, profile: AiAgentProfile) -> None:
        self.db.add(profile)

    async def list_visible(self, user_id: uuid.UUID) -> list[AiAgentProfile]:
        rows = await self.db.exec(select(AiAgentProfile).where(
            or_(AiAgentProfile.owner_id.is_(None), AiAgentProfile.owner_id == user_id),
            AiAgentProfile.is_archived.is_(False)).order_by(AiAgentProfile.name))
        return list(rows.all())
