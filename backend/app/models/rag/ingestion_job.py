import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, CheckConstraint, DateTime, Index, Text, text
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import (
    USER_ID_FK, RagBaseModel, enum_column, fk_column, jsonb_column,
)
from app.rag.domain.enums import IngestionStageName, JobStatus, JobType

if TYPE_CHECKING:
    from app.models.rag.document import Document
    from app.models.rag.ingestion_stage import IngestionStage
    from app.models.rag.source import Source


class IngestionJob(RagBaseModel, table=True):
    """Стан Celery/RAG pipeline (таблиця `ingestion_jobs`).

    Job-и видаляються разом із документом; системні job-и можуть не мати документа.
    """

    __tablename__ = "ingestion_jobs"  # type: ignore[assignment]
    __table_args__ = (
        CheckConstraint("progress BETWEEN 0 AND 100", name="ck_ingestion_jobs_progress"),
        Index("ix_ingestion_jobs_status_created", "status", "created_at"),
        Index("ix_ingestion_jobs_celery_task", "celery_task_id"),
    )

    user_id: Optional[uuid.UUID] = Field(
        default=None,  # None = системний job (планувальник)
        sa_column=fk_column(USER_ID_FK, ondelete="SET NULL", nullable=True),
    )
    document_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("documents.id", ondelete="CASCADE", nullable=True),
    )
    source_id: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=fk_column("sources.id", ondelete="SET NULL", nullable=True),
    )

    job_type: JobType = Field(
        sa_column=enum_column(JobType, index=True)
    )
    status: JobStatus = Field(
        default=JobStatus.QUEUED,
        sa_column=enum_column(JobStatus, default=JobStatus.QUEUED),
    )
    current_stage: Optional[IngestionStageName] = Field(
        default=None, sa_column=enum_column(IngestionStageName, nullable=True)
    )
    progress: int = Field(default=0, sa_column_kwargs={"server_default": text("0")})

    celery_task_id: Optional[str] = Field(default=None, max_length=255)
    retry_count: int = Field(default=0, sa_column_kwargs={"server_default": text("0")})

    payload: dict = Field(default_factory=dict, sa_column=jsonb_column("payload"))

    error_code: Optional[str] = Field(default=None, max_length=64)
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    started_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    finished_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    document: Optional["Document"] = Relationship(sa_relationship_kwargs={"lazy": "raise"})
    source: Optional["Source"] = Relationship(sa_relationship_kwargs={"lazy": "raise"})
    stages: list["IngestionStage"] = Relationship(
        back_populates="job",
        sa_relationship_kwargs={
            "cascade": "all, delete-orphan", "passive_deletes": True,
            "lazy": "selectin", "order_by": "IngestionStage.created_at",
        },
    )
