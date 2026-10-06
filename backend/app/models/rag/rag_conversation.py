import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Index, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, fk_column, jsonb_column,
)

if TYPE_CHECKING:
    from app.models.rag.rag_message import RagMessage


class RagConversation(RagBaseModel, table=True):
    """Діалог користувача з RAG (таблиця `rag_conversations`)."""

    __tablename__ = "rag_conversations"
    __table_args__ = (
        Index("ix_rag_conversations_user_updated", "user_id", "updated_at"),
    )

    user_id: uuid.UUID = Field(sa_column=fk_column(USER_ID_FK, ondelete="CASCADE"))
    collection_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("collections.id", ondelete="SET NULL", nullable=True),
    )
    title: Optional[str] = Field(default=None, max_length=255)

    mode: str = Field(default="chat", max_length=16, sa_column_kwargs={"server_default": "chat"})
    is_archived: bool = Field(default=False, sa_column_kwargs={"server_default": text("false")})

    settings: dict = Field(default_factory=dict, sa_column=jsonb_column("settings"))

    messages: list["RagMessage"] = Relationship(
        back_populates="conversation",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True,
            "lazy": "raise", "order_by": "RagMessage.created_at",
        },
    )
