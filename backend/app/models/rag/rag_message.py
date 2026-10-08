import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Index, Text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    RagImmutableModel, enum_column, fk_column, meta_field,
)
from app.rag.domain.enums import MessageRole

if TYPE_CHECKING:
    from app.models.rag.rag_citation import RagCitation
    from app.models.rag.rag_conversation import RagConversation


class RagMessage(RagImmutableModel, table=True):
    """Повідомлення діалогу (таблиця `rag_messages`). Append-only."""

    __tablename__ = "rag_messages"  # type: ignore[assignment]
    __table_args__ = (
        Index("ix_rag_messages_conversation_created", "conversation_id", "created_at"),
    )

    conversation_id: uuid.UUID = Field(
        sa_column=fk_column("rag_conversations.id", ondelete="CASCADE")
    )
    role: MessageRole = Field(sa_column=enum_column(MessageRole))
    content: str = Field(sa_type=Text)

    model: Optional[str] = Field(default=None, max_length=255)
    prompt_tokens: Optional[int] = Field(default=None)
    completion_tokens: Optional[int] = Field(default=None)
    finish_reason: Optional[str] = Field(default=None, max_length=32)
    meta: dict = meta_field()

    conversation: Optional["RagConversation"] = Relationship(back_populates="messages")
    citations: list["RagCitation"] = Relationship(
        back_populates="message",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True,
            "lazy": "raise", "order_by": "RagCitation.rank",
        },
    )
