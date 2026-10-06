"""RunLoader: claim run + завантаження всього, що потрібно executor-у, КОРОТКИМИ сесіями.

Жодна сесія не живе довше за запит до БД — executor потім не торкається БД взагалі.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.config import RunConfig
from app.ai.domain.enums import PromptKind, RunMode, RunStatus
from app.ai.llm.types import ChatMessage
from app.ai.prompts import protocol
from app.ai.prompts.service import PromptService, builtin_variables
from app.ai.repositories.run_repo import RunRepository
from app.ai.runtime.budget import RunBudget
from app.ai.runtime.context import RunContext
from app.ai.runtime.history import load_history
from app.ai.settings import AiSettings
from app.models.rag.rag_conversation import RagConversation
from app.models.rag.rag_message import RagMessage

logger = logging.getLogger(__name__)


class RunLoader:
    def __init__(self, *, session_factory: Callable[[], AsyncSession], settings: AiSettings,
                 prompts: PromptService, retrieval: Any) -> None:
        self._sf, self._settings = session_factory, settings
        self._prompts, self._retrieval = prompts, retrieval

    async def claim(self, run_id: uuid.UUID) -> bool:
        async with self._sf() as db:
            claimed = await RunRepository(db).claim_for_start(run_id)
            await db.commit()
        return claimed

    async def load(self, run_id: uuid.UUID) -> RunContext:
        from app.models.users.user_model import User     # lazy: не тягнемо RBAC без потреби

        async with self._sf() as db:
            run = await RunRepository(db).get(run_id)
            if run is None:
                raise LookupError(f"run {run_id} not found")
            conv = await db.get(RagConversation, run.conversation_id)
            user = await db.get(User, run.user_id)
            user_msg = await db.get(RagMessage, run.user_message_id) if run.user_message_id else None
            if conv is None or user is None or user_msg is None:
                raise LookupError("conversation, user or user message no longer exists")
            config = RunConfig.model_validate(run.config)
            conversation_id, user_message_id, user_text = conv.id, user_msg.id, user_msg.content

        history = await load_history(self._sf, conversation_id, exclude_message_id=user_message_id,
                                     cfg=self._settings.chat)

        # collections → змінна промпту (імена лише тих колекцій, що реально доступні)
        names: list[str] = []
        if config.rag_enabled:
            briefs = await self._retrieval.list_collections(user)
            wanted = set(config.collection_ids) if config.collection_ids is not None else None
            names = [b.name for b in briefs if wanted is None or b.id in wanted]

        has_tools = config.mode == RunMode.AGENT and bool(config.allowed_tools)
        sys_kind = PromptKind.AGENT_SYSTEM if config.mode == RunMode.AGENT else PromptKind.CHAT_SYSTEM
        resolved = await self._prompts.get_version(config.prompt_version_ids["system"])
        variables = {**config.prompt_variables, **builtin_variables(user, names)}   # builtin виграє
        system_prompt = protocol.compose_system(
            self._prompts.render(resolved, variables),
            mode=config.mode, rag_enabled=config.rag_enabled, has_tools=has_tools)
        assert resolved.kind == sys_kind

        rewrite_prompt = None
        if config.mode == RunMode.CHAT and config.rag_enabled and "rewrite" in config.prompt_version_ids:
            rw = await self._prompts.get_version(config.prompt_version_ids["rewrite"])
            rewrite_prompt = self._prompts.render(rw, variables)

        lim = config.limits
        return RunContext(
            run_id=run_id, conversation_id=conversation_id, user=user, config=config,
            settings=self._settings, system_prompt=system_prompt, user_text=user_text,
            user_message=ChatMessage("user", user_text), history=history, rewrite_prompt=rewrite_prompt,
            budget=RunBudget(max_steps=lim.max_steps, max_tool_calls=lim.max_tool_calls,
                             token_budget=lim.token_budget, wall_clock_s=lim.wall_clock_s),
        )

    async def fail_early(self, run_id: uuid.UUID, code: str, message: str) -> None:
        async with self._sf() as db:
            await RunRepository(db).finish(
                run_id, RunStatus.FAILED, assistant_message_id=None, usage={},
                error_code=code, error_message=message)
            await db.commit()
