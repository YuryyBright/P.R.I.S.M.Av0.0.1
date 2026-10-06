"""RunContext — усе, що потрібно executor-у. Жодних DB-сесій: усе завантажує раннер/loader
(executor лишається чистим і тестується без БД)."""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.ai.domain.config import RunConfig
from app.ai.llm.types import ChatMessage
from app.ai.runtime.budget import RunBudget
from app.ai.runtime.citations import CitationRegistry
from app.ai.settings import AiSettings


@dataclass
class RunState:
    """Мутабельний стан, який веде раннер і читає finalize."""
    parts: list[str] = field(default_factory=list)       # текст ПОТОЧНОГО llm_call-кроку
    prompt_tokens: int = 0
    completion_tokens: int = 0
    finish_reason: str | None = None
    step_idx: int = -1
    system_prompt_version: dict[str, str] = field(default_factory=dict)

    @property
    def answer(self) -> str:
        return "".join(self.parts)


@dataclass
class RunContext:
    run_id: uuid.UUID
    conversation_id: uuid.UUID
    user: Any                                  # ORM User (id, is_superuser, …)
    config: RunConfig
    settings: AiSettings
    system_prompt: str                         # вже відрендерений + протокол
    user_text: str
    user_message: ChatMessage
    history: list[ChatMessage] = field(default_factory=list)
    rewrite_prompt: str | None = None
    budget: RunBudget | None = None
    citations: CitationRegistry = field(default_factory=CitationRegistry)
    state: RunState = field(default_factory=RunState)
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    @property
    def user_id(self) -> uuid.UUID:
        return self.user.id

    def next_step_idx(self) -> int:
        self.state.step_idx += 1
        return self.state.step_idx

    @property
    def cancelled(self) -> bool:
        return self.cancel_event.is_set()
