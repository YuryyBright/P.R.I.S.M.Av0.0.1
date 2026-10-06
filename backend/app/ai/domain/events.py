"""Єдиний протокол подій run-а (chat і agent). Джерело правди для фронтенду:
`scripts/gen_event_schema.py` генерує JSON Schema → TS-типи (json-schema-to-typescript).

SSE-конверт: `id:` = id запису в Redis Stream, `event:` = type, `data:` = JSON події.

Семантика токенів: `token.delta` належить ОСТАННЬОМУ step.started(kind=llm_call).
Фінальна відповідь = текст останнього llm_call-кроку. Якщо крок завершився tool-викликами,
його текст — це «коментар» кроку (UI показує його в картці кроку).
Старт нового llm_call-кроку скидає живий буфер відповіді (так само робить і сервер).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Union
from uuid import UUID

from pydantic import BaseModel, Field, TypeAdapter

from .enums import RunMode, RunStatus, StepType


def _now() -> datetime:
    return datetime.now(timezone.utc)


class _Event(BaseModel):
    run_id: UUID | None = None      # проставляє раннер
    seq: int = 0                    # проставляє раннер (монотонний у межах run)
    ts: datetime = Field(default_factory=_now)


class ChunkRef(BaseModel):
    n: int                          # номер цитати [n] у межах run
    chunk_id: UUID
    document_id: UUID
    document_title: str
    page: int | None = None
    score: float
    rerank_score: float | None = None
    preview: str = ""


class RunStarted(_Event):
    type: Literal["run.started"] = "run.started"
    mode: RunMode
    model: str
    config: dict[str, Any] = Field(default_factory=dict)   # публічна частина snapshot-а


class StepStarted(_Event):
    type: Literal["step.started"] = "step.started"
    idx: int
    kind: StepType
    title: str


class StepFinished(_Event):
    type: Literal["step.finished"] = "step.finished"
    idx: int
    kind: StepType
    ok: bool = True
    latency_ms: int = 0
    has_tool_calls: bool = False
    summary: str | None = None


class TokenDelta(_Event):
    type: Literal["token.delta"] = "token.delta"
    text: str


class RetrievalDone(_Event):
    type: Literal["retrieval.done"] = "retrieval.done"
    query: str
    rewritten_query: str | None = None
    chunks: list[ChunkRef] = Field(default_factory=list)
    reranked: bool = False
    latency_ms: int = 0
    warnings: list[str] = Field(default_factory=list)


class ToolCallEvent(_Event):
    type: Literal["tool.call"] = "tool.call"
    id: str
    name: str
    args: dict[str, Any] = Field(default_factory=dict)


class ToolResultEvent(_Event):
    type: Literal["tool.result"] = "tool.result"
    id: str
    ok: bool
    summary: str
    latency_ms: int = 0


class CitationEvent(_Event):
    """Надсилається при finalize — лише для цитат, на які реально посилається відповідь."""
    type: Literal["citation"] = "citation"
    rank: int
    chunk_id: UUID
    document_id: UUID
    document_title: str
    page: int | None = None
    url: str | None = None
    text: str


class UsageEvent(_Event):
    type: Literal["usage"] = "usage"
    prompt_tokens: int
    completion_tokens: int


class RunFinished(_Event):
    type: Literal["run.finished"] = "run.finished"
    status: RunStatus
    message_id: UUID | None = None
    finish_reason: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    usage: dict[str, int] = Field(default_factory=dict)


RunEvent = Annotated[
    Union[
        RunStarted, StepStarted, StepFinished, TokenDelta, RetrievalDone,
        ToolCallEvent, ToolResultEvent, CitationEvent, UsageEvent, RunFinished,
    ],
    Field(discriminator="type"),
]

run_event_adapter: TypeAdapter = TypeAdapter(RunEvent)


def parse_event(data: str | bytes) -> Any:
    return run_event_adapter.validate_json(data)
