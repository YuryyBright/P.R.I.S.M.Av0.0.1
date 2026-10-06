"""GET /ai/capabilities: що реально доступно UI (щоб чіпи не вмикали неіснуючі речі)."""
from __future__ import annotations

from typing import Any, Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.agent.tools.registry import ToolRegistry
from app.ai.domain.enums import RunMode
from app.ai.llm.registry import ModelRegistry
from app.ai.repositories.profile_repo import ProfileRepository
from app.ai.repositories.prompt_repo import PromptRepository
from app.ai.schemas import (
    CapabilitiesOut, ModelCap, ProfileOut, PromptTemplateOut, RerankerCap, ToolCap,
)
from app.ai.settings import AiSettings


class CapabilitiesService:
    def __init__(self, *, session_factory: Callable[[], AsyncSession], settings: AiSettings,
                 registry: ModelRegistry, tools: ToolRegistry, retrieval: Any, rag_settings: Any) -> None:
        self._sf, self._s = session_factory, settings
        self._models, self._tools = registry, tools
        self._retrieval, self._rag = retrieval, rag_settings

    async def build(self, user: Any) -> CapabilitiesOut:
        async with self._sf() as db:
            profiles = await ProfileRepository(db).list_visible(user.id)
            prompts = await PromptRepository(db).list_visible(user.id)
        agent_ok = any(m.tools for m in self._models.list())
        return CapabilitiesOut(
            modes=[RunMode.CHAT] + ([RunMode.AGENT] if agent_ok else []),
            models=[ModelCap(alias=m.alias, label=m.label, vision=m.vision, tools=m.tools,
                             context_len=m.context_len, default=m.alias == self._models.default_alias)
                    for m in self._models.list()],
            reranker=RerankerCap(
                available=self._retrieval.reranker_available,
                model=self._rag.reranker.model if self._retrieval.reranker_available else None,
                default_top_k=self._rag.reranker.top_k),
            tools=[ToolCap(**t) for t in self._tools.describe()],
            profiles=[ProfileOut.model_validate(p) for p in profiles],
            prompts=[PromptTemplateOut.model_validate(p) for p in prompts],
            limits={"max_steps": self._s.agent.max_steps, "max_tool_calls": self._s.agent.max_tool_calls,
                    "wall_clock_s": self._s.agent.wall_clock_s})
