"""Pydantic DTO для API."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.ai.domain.enums import PromptKind, RunMode, RunStatus, StepStatus, StepType
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

class _Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- settings діалогу (rag_conversations.settings) -----------------------------------

class RerankerIn(BaseModel):
    enabled: bool = False
    top_k: int | None = Field(default=None, ge=1, le=20)


class ConversationSettings(BaseModel):
    """Єдине джерело налаштувань діалогу. collection_ids: None = усі доступні; [] при RAG → помилка."""
    model_config = ConfigDict(extra="ignore")
    mode: RunMode = RunMode.CHAT
    model: str | None = None
    rag_enabled: bool = False
    web_enabled: bool = False
    collection_ids: list[uuid.UUID] | None = None
    reranker: RerankerIn = Field(default_factory=RerankerIn)
    prompt_template_id: uuid.UUID | None = None
    prompt_version_id: uuid.UUID | None = None       # явне «закріплення» версії
    prompt_variables: dict[str, str] = Field(default_factory=dict)
    profile_id: uuid.UUID | None = None


class ConversationSettingsPatch(BaseModel):
    """Те саме, але кожне поле опційне: застосовуються лише передані (exclude_unset)."""
    mode: RunMode | None = None
    model: str | None = None
    rag_enabled: bool | None = None
    web_enabled: bool | None = None
    collection_ids: list[uuid.UUID] | None = None
    reranker: RerankerIn | None = None
    prompt_template_id: uuid.UUID | None = None
    prompt_version_id: uuid.UUID | None = None
    prompt_variables: dict[str, str] | None = None
    profile_id: uuid.UUID | None = None


# ---- conversations ---------------------------------------------------------------------

class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    settings: ConversationSettingsPatch | None = None


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    is_archived: bool | None = None
    settings: ConversationSettingsPatch | None = None


class ConversationOut(_Out):
    id: uuid.UUID
    title: str | None
    mode: str
    is_archived: bool
    settings: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class CitationOut(_Out):
    rank: int
    document_id: uuid.UUID | None
    chunk_id: uuid.UUID | None
    score: float | None
    citation_text: str
    meta: dict[str, Any]


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    model: str | None
    finish_reason: str | None
    created_at: datetime
    run_id: uuid.UUID | None = None
    citations: list[CitationOut] = Field(default_factory=list)


# ---- runs ------------------------------------------------------------------------------

class StartRunRequest(BaseModel):
    content: str = Field(min_length=1, max_length=32000)
    mode: RunMode | None = None                      # None → settings.mode діалогу
    settings: ConversationSettingsPatch | None = None  # зміни налаштувань разом з повідомленням
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)   # етап 7


class StartRunResponse(BaseModel):
    run_id: uuid.UUID
    user_message_id: uuid.UUID
    conversation_id: uuid.UUID
    mode: RunMode
    status: RunStatus


class RunOut(_Out):
    id: uuid.UUID
    conversation_id: uuid.UUID
    mode: RunMode
    status: RunStatus
    config: dict[str, Any]
    usage: dict[str, Any]
    assistant_message_id: uuid.UUID | None
    started_at: datetime | None
    finished_at: datetime | None
    error_code: str | None
    error_message: str | None
    created_at: datetime


class StepOut(_Out):
    idx: int
    type: StepType
    name: str | None
    status: StepStatus
    input: dict[str, Any]
    output: dict[str, Any]
    latency_ms: int
    prompt_tokens: int | None
    completion_tokens: int | None


# ---- prompts / profiles ----------------------------------------------------------------

class PromptTemplateCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9][a-z0-9_\-]*$")
    name: str = Field(min_length=1, max_length=255)
    kind: PromptKind
    content: str = Field(min_length=1)
    description: str | None = None
    variables_schema: dict[str, Any] = Field(default_factory=dict)
    model_params: dict[str, Any] = Field(default_factory=dict)
    system: bool = False


class PromptVersionCreate(BaseModel):
    content: str = Field(min_length=1)
    variables_schema: dict[str, Any] = Field(default_factory=dict)
    model_params: dict[str, Any] = Field(default_factory=dict)
    changelog: str | None = None
    activate: bool = True


class PromptForkRequest(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9][a-z0-9_\-]*$")
    name: str | None = None


class PromptActivateRequest(BaseModel):
    version_id: uuid.UUID


class PromptVersionOut(_Out):
    id: uuid.UUID
    template_id: uuid.UUID
    version: int
    content: str
    variables_schema: dict[str, Any]
    model_params: dict[str, Any]
    changelog: str | None
    created_at: datetime


class PromptTemplateOut(_Out):
    id: uuid.UUID
    owner_id: uuid.UUID | None
    slug: str
    name: str
    kind: PromptKind
    description: str | None
    is_archived: bool
    active_version_id: uuid.UUID | None


class ProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    prompt_template_id: uuid.UUID
    model: str | None = None
    allowed_tools: list[str] = Field(default_factory=list)
    default_collection_ids: list[uuid.UUID] = Field(default_factory=list)
    max_steps: int = Field(default=8, ge=1, le=50)


class ProfileOut(_Out):
    id: uuid.UUID
    owner_id: uuid.UUID | None
    name: str
    description: str | None
    prompt_template_id: uuid.UUID
    model: str | None
    allowed_tools: list[str]
    default_collection_ids: list[uuid.UUID]
    max_steps: int


# ---- capabilities ----------------------------------------------------------------------

class ModelCap(BaseModel):
    alias: str
    label: str
    vision: bool
    tools: bool
    context_len: int
    default: bool


class RerankerCap(BaseModel):
    available: bool
    model: str | None = None
    default_top_k: int


class ToolCap(BaseModel):
    name: str
    description: str
    risk: str
    requires_rag: bool


class CapabilitiesOut(BaseModel):
    modes: list[RunMode]
    models: list[ModelCap]
    reranker: RerankerCap
    tools: list[ToolCap]
    profiles: list[ProfileOut]
    prompts: list[PromptTemplateOut]
    limits: dict[str, int]
