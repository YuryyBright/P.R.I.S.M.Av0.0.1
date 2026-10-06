from __future__ import annotations

import uuid
from typing import Any, Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.agent.tools.registry import ToolRegistry
from app.ai.domain.enums import PromptKind
from app.ai.domain.exceptions import InvalidInputError, NotFoundError
from app.ai.llm.registry import ModelRegistry
from app.ai.repositories.profile_repo import ProfileRepository
from app.ai.repositories.prompt_repo import PromptRepository
from app.ai.schemas import ProfileCreate
from app.models.ai.agent_profile import AiAgentProfile


class ProfileService:
    def __init__(self, session_factory: Callable[[], AsyncSession], tools: ToolRegistry,
                 models: ModelRegistry) -> None:
        self._sf, self._tools, self._models = session_factory, tools, models

    async def create(self, user: Any, body: ProfileCreate) -> AiAgentProfile:
        self._tools.resolve_allowed(body.allowed_tools or None, rag_enabled=True)   # валідація імен
        if body.model:
            self._models.require(body.model, tools=True)
        async with self._sf() as db:
            tpl = await PromptRepository(db).get_template(body.prompt_template_id)
            if tpl is None or tpl.owner_id not in (None, user.id):
                raise NotFoundError("Prompt template not found")
            if tpl.kind != PromptKind.AGENT_SYSTEM:
                raise InvalidInputError("Agent profile requires an agent_system prompt")
            p = AiAgentProfile(
                owner_id=user.id, name=body.name, description=body.description,
                prompt_template_id=tpl.id, model=body.model, allowed_tools=body.allowed_tools,
                default_collection_ids=[str(c) for c in body.default_collection_ids],
                max_steps=body.max_steps)
            ProfileRepository(db).add(p)
            await db.commit()
            await db.refresh(p)
            return p

    async def list(self, user: Any) -> list[AiAgentProfile]:
        async with self._sf() as db:
            return await ProfileRepository(db).list_visible(user.id)

    async def archive(self, user: Any, profile_id: uuid.UUID) -> None:
        async with self._sf() as db:
            p = await ProfileRepository(db).get(profile_id)
            if p is None or p.owner_id != user.id:
                raise NotFoundError("Profile not found")
            p.is_archived = True
            await db.commit()
