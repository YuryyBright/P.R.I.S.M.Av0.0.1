import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, CheckConstraint, DateTime, Text, UniqueConstraint
from sqlmodel import Field, Relationship

from app.models.rag.rag_base import RagBaseModel, enum_column, fk_column
from app.rag.domain.enums import IngestionStageName, StageStatus

if TYPE_CHECKING:
    from app.models.rag.ingestion_job import IngestionJob


class IngestionStage(RagBaseModel, table=True):
    """Стан окремого етапу job-а (таблиця `ingestion_stages`).

    Один рядок на (job, stage); при retry рядок скидається й перезаписується.
    """

    __tablename__ = "ingestion_stages"  # type: ignore[assignment]
    __table_args__ = (
        UniqueConstraint("job_id", "stage", name="uq_ingestion_stages_job_stage"),
        CheckConstraint(
            "items_total >= 0 AND items_processed >= 0", name="ck_ingestion_stages_items"
        ),
    )

    job_id: uuid.UUID = Field(sa_column=fk_column("ingestion_jobs.id", ondelete="CASCADE"))
    stage: IngestionStageName = Field(sa_column=enum_column(IngestionStageName))
    status: StageStatus = Field(
        default=StageStatus.PENDING,
        sa_column=enum_column(StageStatus, default=StageStatus.PENDING),
    )

    started_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    finished_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    items_total: int = Field(default=0)
    items_processed: int = Field(default=0)
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    job: Optional["IngestionJob"] = Relationship(back_populates="stages")
