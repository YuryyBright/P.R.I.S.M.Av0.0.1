"""RunConfig — незмінний SNAPSHOT налаштувань run-а (зберігається в ai_runs.config).

Executor читає ЛИШЕ його, а не rag_conversations.settings: зміни налаштувань посеред
run нічого не ламають, а будь-яку відповідь можна відтворити.
"""
from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from .enums import RunMode


class RerankConfig(BaseModel):
    enabled: bool = False
    top_k: int | None = Field(default=None, ge=1, le=20)


class LimitsConfig(BaseModel):
    max_steps: int
    max_tool_calls: int
    token_budget: int
    wall_clock_s: int


class RunConfig(BaseModel):
    mode: RunMode
    model: str                                   # alias з AiSettings.models
    rag_enabled: bool = False
    web_enabled: bool = False
    collection_ids: list[UUID] | None = None     # None = усі доступні за ACL; [] = жодної
    unavailable_collection_ids: list[UUID] = Field(default_factory=list)
    rerank: RerankConfig = Field(default_factory=RerankConfig)
    prompt_version_ids: dict[str, UUID] = Field(default_factory=dict)   # "system", "rewrite"
    prompt_variables: dict[str, str] = Field(default_factory=dict)
    profile_id: UUID | None = None
    allowed_tools: list[str] = Field(default_factory=list)
    limits: LimitsConfig
    temperature: float | None = None
    max_tokens: int | None = None
    attachment_ids: list[UUID] = Field(default_factory=list)            # етап 7

    def public(self) -> dict:
        """Що можна показати UI у run.started (без prompt-ів/змінних)."""
        return {
            "model": self.model, "rag_enabled": self.rag_enabled, "web_enabled": self.web_enabled,
            "collection_ids": [str(c) for c in self.collection_ids] if self.collection_ids is not None else None,
            "unavailable_collections": len(self.unavailable_collection_ids),
            "rerank": self.rerank.model_dump(), "allowed_tools": self.allowed_tools,
            "limits": self.limits.model_dump(),
        }
