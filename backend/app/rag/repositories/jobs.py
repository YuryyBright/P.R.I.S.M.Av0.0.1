"""Доступ до БД для IngestionJob / IngestionStage."""
import uuid
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.ingestion_stage import IngestionStage
from app.rag.domain.enums import IngestionStageName, JobStatus


class IngestionJobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, job: IngestionJob) -> None:
        self.db.add(job)

    async def get(self, job_id: uuid.UUID) -> IngestionJob | None:
        return await self.db.get(IngestionJob, job_id)          # stages — selectin

    async def set_celery_task_id(self, job_id: uuid.UUID, task_id: str | None) -> None:
        job = await self.db.get(IngestionJob, job_id)
        if job is not None:
            job.celery_task_id = task_id

    async def claim_undispatched(
        self, *, older_than: datetime, limit: int
    ) -> list[IngestionJob]:
        """Забрати QUEUED job-и без celery_task_id під час redispatch."""
        rows = await self.db.exec(
            select(IngestionJob)
            .where(
                IngestionJob.status == JobStatus.QUEUED,
                IngestionJob.celery_task_id.is_(None),
                IngestionJob.created_at <= older_than,
            )
            .order_by(IngestionJob.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        return list(rows.all())

    async def get_or_create_stage(
        self, job_id: uuid.UUID, name: IngestionStageName
    ) -> IngestionStage:
        """get-or-create stage."""
        stage = (await self.db.exec(select(IngestionStage).where(
            IngestionStage.job_id == job_id, IngestionStage.stage == name))).first()
        if stage is None:
            stage = IngestionStage(job_id=job_id, stage=name)
            self.db.add(stage)
        return stage
