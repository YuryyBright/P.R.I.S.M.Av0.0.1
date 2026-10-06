"""Збірка історії діалогу з rag_messages під бюджет токенів."""
from __future__ import annotations

import uuid
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.llm.types import ChatMessage
from app.ai.repositories.conversation_repo import ConversationRepository
from app.ai.runtime.citations import strip_markers
from app.ai.settings import ChatSettings
from app.rag.domain.enums import MessageRole


def trim_history(messages: list[tuple[str, str]], *, token_budget: int, chars_per_token: float,
                 max_messages: int) -> list[ChatMessage]:
    """messages: [(role, text)] за зростанням часу. Беремо найновіші, поки вміщується бюджет.
    Попередні відповіді асистента очищаємо від [n]: номери цитат минулих run-ів — не з цього run-а."""
    out: list[ChatMessage] = []
    used = 0
    for role, text in reversed(messages[-max_messages:] if max_messages else []):
        if role not in ("user", "assistant"):
            continue
        clean = strip_markers(text) if role == "assistant" else text
        cost = max(1, int(len(clean) / chars_per_token))
        if used + cost > token_budget:
            if not out:                                  # хоча б останнє повідомлення, обрізане
                clean = clean[-int(token_budget * chars_per_token):]
                out.append(ChatMessage(role, clean))     # type: ignore[arg-type]
            break
        used += cost
        out.append(ChatMessage(role, clean))             # type: ignore[arg-type]
    out.reverse()
    return out


async def load_history(session_factory: Callable[[], AsyncSession], conversation_id: uuid.UUID, *,
                       exclude_message_id: uuid.UUID, cfg: ChatSettings) -> list[ChatMessage]:
    async with session_factory() as db:
        rows = await ConversationRepository(db).recent_messages(
            conversation_id, limit=cfg.max_history_messages, exclude_id=exclude_message_id)
    pairs = [(m.role.value if isinstance(m.role, MessageRole) else str(m.role), m.content) for m in rows]
    return trim_history(pairs, token_budget=cfg.history_token_budget,
                        chars_per_token=cfg.chars_per_token, max_messages=cfg.max_history_messages)
