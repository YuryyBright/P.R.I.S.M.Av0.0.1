import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Index, Text
from sqlmodel import Field, Relationship

from app.ai.tasks.domain import TaskStatus, TaskType
from app.models.rag.rag_base import USER_ID_FK, RagBaseModel, enum_column, fk_column, jsonb_column

if TYPE_CHECKING:
    from app.models.ai import AiArtifact
    from app.models.ai import AiTaskItem


class AiTask(RagBaseModel, table=True):
    __tablename__ = "ai_tasks"
    __table_args__ = (
        Index("ix_ai_tasks_user_status_created", "user_id", "status", "created_at"),
        Index("ix_ai_tasks_status_heartbeat", "status", "heartbeat_at"),
        Index("ix_ai_tasks_celery_task", "celery_task_id"),
    )

    user_id: uuid.UUID = Field(
        sa_column=fk_column(USER_ID_FK, ondelete="CASCADE")
    )
    type: TaskType = Field(sa_column=enum_column(TaskType, index=True))
    status: TaskStatus = Field(
        default=TaskStatus.QUEUED,
        sa_column=enum_column(TaskStatus, default=TaskStatus.QUEUED, index=True),
    )
    title: str = Field(default="AI Task", max_length=255)
    instruction: str = Field(sa_type=Text)
    config: dict[str, object] = Field(
        default_factory=dict,
        sa_column=jsonb_column("config"),
    )
    sources: list[str] = Field(
        default_factory=list,
        sa_column=jsonb_column("sources"),
    )
    progress: dict[str, object] = Field(
        default_factory=dict,
        sa_column=jsonb_column("progress"),
    )
    current_stage: Optional[str] = Field(default=None, max_length=64)
    stage_index: int = Field(default=0, ge=0)
    total_stages: int = Field(default=0, ge=0)
    checkpoint: dict[str, object] = Field(
        default_factory=dict,
        sa_column=jsonb_column("checkpoint"),
    )
    celery_task_id: Optional[str] = Field(default=None, max_length=255)
    result_artifact_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column(
            "ai_artifacts.id",
            ondelete="SET NULL",
            nullable=True,
        ),
    )
    error: Optional[str] = Field(default=None, sa_type=Text)
    started_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
    finished_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
    heartbeat_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
    )
    cancellation_requested: bool = Field(default=False)

    items: List["AiTaskItem"] = Relationship(
        back_populates="task",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
            "lazy": "raise",
        },
    )

    artifacts: List["AiArtifact"] = Relationship(
        back_populates="task",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan",
            "passive_deletes": True,
            "lazy": "raise",
            "foreign_keys": "[AiArtifact.task_id]",
        },
        
    )
