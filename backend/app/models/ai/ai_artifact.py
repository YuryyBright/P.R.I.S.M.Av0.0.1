from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Index
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import USER_ID_FK, RagImmutableModel, fk_column, jsonb_column

if TYPE_CHECKING:
    from app.models.ai import AiTask
    from app.models.users.user_model import User


class AiArtifact(RagImmutableModel, table=True):
    __tablename__ = "ai_artifacts"
    __table_args__ = (
        Index("ix_ai_artifacts_task_id", "task_id"),
        Index("ix_ai_artifacts_owner_id", "owner_id"),
    )

    task_id: uuid.UUID = Field(
        sa_column=fk_column("ai_tasks.id", ondelete="CASCADE")
    )
    owner_id: uuid.UUID = Field(
        sa_column=fk_column(USER_ID_FK, ondelete="CASCADE")
    )
    type: str = Field(max_length=64)
    name: str = Field(max_length=255)
    mime_type: str = Field(max_length=255)
    storage_key: str = Field(max_length=1024)
    size: int = Field(default=0, ge=0, sa_type=BigInteger)
    meta: dict[str, object] = Field(
        default_factory=dict,
        sa_column=jsonb_column("metadata"),
    )

    task: AiTask = Relationship(
        back_populates="artifacts",
        sa_relationship_kwargs={"foreign_keys": "[AiArtifact.task_id]"},
    )
