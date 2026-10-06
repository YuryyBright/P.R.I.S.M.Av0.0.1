"""RunService.start_run(): валідація → snapshot config → user message + AiRun(queued) → dispatch.

Послідовність коротких сесій (жодна не живе довго): читання → резолв промптів/scope →
одна транзакція запису → commit → dispatch (після commit!).
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any, Callable, Mapping

from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.agent.tools.registry import ToolRegistry
from app.ai.domain.config import LimitsConfig, RerankConfig, RunConfig
from app.ai.domain.enums import PromptKind, RunMode, RunStatus
from app.ai.domain.exceptions import (
    ConversationBusyError, ForbiddenError, InvalidInputError, NotFoundError, RunNotFoundError,
)
from app.ai.domain.ports import CancelStore, RunLauncher
from app.ai.llm.registry import ModelRegistry
from app.ai.prompts.service import PromptService, ResolvedPrompt
from app.ai.repositories.conversation_repo import ConversationRepository
from app.ai.repositories.profile_repo import ProfileRepository
from app.ai.repositories.run_repo import RunRepository
from app.ai.repositories.step_repo import StepRepository
from app.ai.schemas import ConversationSettings, StartRunRequest, StartRunResponse
from app.ai.settings import AiSettings
from app.models.ai.ai_run import AiRun
from app.models.rag.rag_conversation import RagConversation
from app.models.rag.rag_message import RagMessage
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import MessageRole
from app.rag.retrieval.scope import resolve_scope

TITLE_CHARS = 60


@dataclass(slots=True)
class _Plan:
    settings: ConversationSettings
    mode: RunMode
    config: RunConfig
    profile_id: uuid.UUID | None


class RunService:
    def __init__(self, *, session_factory: Callable[[], AsyncSession], settings: AiSettings,
                 registry: ModelRegistry, prompts: PromptService, tools: ToolRegistry,
                 retrieval: Any, launchers: Mapping[RunMode, RunLauncher], cancel: CancelStore) -> None:
        self._sf, self._s = session_factory, settings
        self._models, self._prompts, self._tools = registry, prompts, tools
        self._retrieval, self._launchers, self._cancel = retrieval, launchers, cancel

    # ---- start ---------------------------------------------------------------------

    async def start_run(self, user: Any, conversation_id: uuid.UUID, body: StartRunRequest) -> StartRunResponse:
        if body.attachment_ids:
            raise InvalidInputError("Attachments are not supported yet")
        async with self._sf() as db:                                     # A: читання
            conv = await ConversationRepository(db).get_owned(conversation_id, user.id)
            if conv is None:
                raise NotFoundError("Conversation not found")
            if await RunRepository(db).active_for_conversation(conversation_id) is not None:
                raise ConversationBusyError("This conversation already has an active run")
            current = ConversationSettings.model_validate(conv.settings or {})
            has_title = bool(conv.title)

        merged = ConversationSettings.model_validate({
            **current.model_dump(),
            **(body.settings.model_dump(exclude_unset=True) if body.settings else {}),
            **({"mode": body.mode} if body.mode else {}),
        })
        plan = await self._plan(user, merged)

        try:                                                             # B: запис
            async with self._sf() as db:
                conv = await ConversationRepository(db).get_owned(conversation_id, user.id)
                if conv is None:
                    raise NotFoundError("Conversation not found")
                msg = RagMessage(conversation_id=conversation_id, role=MessageRole.USER,
                                 content=body.content, meta={"settings_mode": plan.mode.value})
                db.add(msg)
                await db.flush()
                run = AiRun(
                    conversation_id=conversation_id, user_id=user.id, user_message_id=msg.id,
                    mode=plan.mode, status=RunStatus.QUEUED, profile_id=plan.profile_id,
                    config=plan.config.model_dump(mode="json"))
                RunRepository(db).add(run)
                conv.settings = plan.settings.model_dump(mode="json")
                conv.updated_at = utcnow()
                if not has_title:
                    conv.title = body.content.strip().replace("\n", " ")[:TITLE_CHARS]
                await db.commit()
                run_id, msg_id = run.id, msg.id
        except IntegrityError:                                           # partial unique: гонка двох POST
            raise ConversationBusyError("This conversation already has an active run") from None

        await self._launchers[plan.mode].dispatch(run_id)                # після commit
        return StartRunResponse(run_id=run_id, user_message_id=msg_id, conversation_id=conversation_id,
                                mode=plan.mode, status=RunStatus.QUEUED)

    # ---- planning (валідація + snapshot) --------------------------------------------

    async def _plan(self, user: Any, s: ConversationSettings) -> _Plan:
        mode = s.mode
        profile = None
        if mode == RunMode.AGENT and s.profile_id is not None:
            async with self._sf() as db:
                profile = await ProfileRepository(db).get(s.profile_id)
            if profile is None or profile.is_archived or profile.owner_id not in (None, user.id):
                raise NotFoundError("Agent profile not found")

        web_enabled = bool(s.web_enabled and self._s.agent.allow_web_search)

        model = self._models.require(
            s.model or (profile.model if profile else None), tools=(mode == RunMode.AGENT))

        # --- RAG / колекції
        collection_ids = s.collection_ids
        if profile is not None and collection_ids is None and profile.default_collection_ids:
            collection_ids = [uuid.UUID(str(c)) for c in profile.default_collection_ids]
        unavailable: list[uuid.UUID] = []
        if s.rag_enabled:
            if collection_ids is not None:
                if not collection_ids:
                    raise InvalidInputError("RAG is enabled but no collections are selected")
                async with self._sf() as db:
                    scope = await resolve_scope(db, user, collection_ids)
                if scope.empty:
                    raise InvalidInputError("None of the selected collections is available")
                collection_ids, unavailable = scope.collection_ids, scope.denied
        else:
            collection_ids = None

        rerank = RerankConfig(
            enabled=s.reranker.enabled and s.rag_enabled and self._retrieval.reranker_available,
            top_k=s.reranker.top_k)

        # --- інструменти
        allowed: list[str] = []
        if mode == RunMode.AGENT:
            allowed = self._tools.resolve_allowed(
                list(profile.allowed_tools) if profile and profile.allowed_tools else None,
                rag_enabled=s.rag_enabled)

        # --- промпти (версії фіксуються в snapshot)
        sys_kind = PromptKind.AGENT_SYSTEM if mode == RunMode.AGENT else PromptKind.CHAT_SYSTEM
        template_id = s.prompt_template_id or (profile.prompt_template_id if profile else None)
        system = await self._prompts.resolve(
            user, sys_kind, version_id=s.prompt_version_id, template_id=template_id)
        self._check_variables(system, s.prompt_variables)
        versions = {"system": system.version_id}
        if mode == RunMode.CHAT and s.rag_enabled and self._s.chat.query_rewrite:
            rw = await self._prompts.resolve(user, PromptKind.QUERY_REWRITE)
            versions["rewrite"] = rw.version_id

        agent = self._s.agent
        max_steps = min(profile.max_steps, agent.max_steps) if profile else agent.max_steps
        config = RunConfig(
            mode=mode, model=model.alias, rag_enabled=s.rag_enabled, web_enabled=web_enabled, collection_ids=collection_ids,
            unavailable_collection_ids=unavailable, rerank=rerank, prompt_version_ids=versions,
            prompt_variables=s.prompt_variables, profile_id=profile.id if profile else None,
            allowed_tools=allowed,
            limits=LimitsConfig(max_steps=max_steps, max_tool_calls=agent.max_tool_calls,
                                token_budget=agent.token_budget, wall_clock_s=agent.wall_clock_s),
            temperature=system.model_params.get("temperature"),
            max_tokens=system.model_params.get("max_tokens"))
        stored = s.model_copy(update={"mode": mode, "web_enabled": web_enabled, "reranker": s.reranker.model_copy(
            update={"enabled": rerank.enabled})})
        return _Plan(stored, mode, config, config.profile_id)

    @staticmethod
    def _check_variables(prompt: ResolvedPrompt, variables: dict[str, str]) -> None:
        allowed = set(PromptService.user_variable_names(prompt))
        extra = set(variables) - allowed
        if extra:
            raise InvalidInputError(f"Unknown prompt variables: {', '.join(sorted(extra))}")
        required = set(prompt.variables_schema.get("required") or [])
        missing = required - set(variables)
        if missing:
            raise InvalidInputError(f"Missing prompt variables: {', '.join(sorted(missing))}")

    # ---- read / cancel ---------------------------------------------------------------

    async def get_run(self, user: Any, run_id: uuid.UUID) -> AiRun:
        async with self._sf() as db:
            run = await RunRepository(db).get(run_id)
        if run is None or (run.user_id != user.id and not getattr(user, "is_superuser", False)):
            raise RunNotFoundError("Run not found")
        return run

    async def list_steps(self, user: Any, run_id: uuid.UUID):
        await self.get_run(user, run_id)
        async with self._sf() as db:
            return await StepRepository(db).list_for_run(run_id)

    async def cancel_run(self, user: Any, run_id: uuid.UUID) -> AiRun:
        run = await self.get_run(user, run_id)
        if run.user_id != user.id:
            raise ForbiddenError("Only the run owner can cancel it")
        if run.status in (RunStatus.QUEUED, RunStatus.RUNNING, RunStatus.WAITING_APPROVAL):
            await self._cancel.request(run_id)       # раннер/sidecar побачить прапорець
        return run
