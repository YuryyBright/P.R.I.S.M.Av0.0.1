import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Index, Text, text
from sqlmodel import Field, Relationship

from app.ai.domain.enums import RunMode, RunStatus
from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, enum_column, fk_column, jsonb_column,
)

if TYPE_CHECKING:
    from app.models.ai.ai_run_step import AiRunStep


class AiRun(RagBaseModel, table=True):
    """Одна відповідь асистента = один run (таблиця `ai_runs`). Chat і Agent — однаково.

    `config` — незмінний snapshot (модель, фактичні collection_ids, reranker,
    prompt_version_ids, ліміти). Executor читає лише його.
    """

    __tablename__ = "ai_runs"
    __table_args__ = (
        Index("ix_ai_runs_status_heartbeat", "status", "heartbeat_at"),   # sweeper
        Index("ix_ai_runs_conversation_created", "conversation_id", "created_at"),
        Index("ix_ai_runs_celery_task", "celery_task_id"),
        # не більше одного активного run на діалог (гонка двох POST /runs → IntegrityError → 409)
        Index("uq_ai_runs_one_active_per_conversation", "conversation_id", unique=True,
              postgresql_where=text("status IN ('queued','running','waiting_approval')")),
    )

    conversation_id: uuid.UUID = Field(
        sa_column=fk_column("rag_conversations.id", ondelete="CASCADE")
    )
    user_id: uuid.UUID = Field(sa_column=fk_column(USER_ID_FK, ondelete="CASCADE"))
    user_message_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("rag_messages.id", ondelete="SET NULL", nullable=True),
    )
    # заповнюється при finalize (RagMessage append-only → створюється наприкінці)
    assistant_message_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("rag_messages.id", ondelete="SET NULL", nullable=True),
    )
    profile_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("ai_agent_profiles.id", ondelete="SET NULL", nullable=True),
    )

    mode: RunMode = Field(sa_column=enum_column(RunMode, index=True))
    status: RunStatus = Field(
        default=RunStatus.QUEUED,
        sa_column=enum_column(RunStatus, default=RunStatus.QUEUED),
    )

    config: dict = Field(default_factory=dict, sa_column=jsonb_column("config"))
    usage: dict = Field(default_factory=dict, sa_column=jsonb_column("usage"))

    celery_task_id: Optional[str] = Field(default=None, max_length=255)
    heartbeat_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    started_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    finished_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    error_code: Optional[str] = Field(default=None, max_length=64)
    error_message: Optional[str] = Field(default=None, sa_type=Text)

    steps: list["AiRunStep"] = Relationship(
        back_populates="run",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True,
            "lazy": "raise", "order_by": "AiRunStep.idx",
        },
    )
