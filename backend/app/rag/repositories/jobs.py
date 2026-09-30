"""Доступ до БД для IngestionJob / IngestionStage.

Без commit: транзакцією керує caller (stage або сервіс). Методи `mark_*`,
`bump_progress` лише змінюють стан об'єктів у сесії.
"""
import uuid
from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.ingestion_stage import IngestionStage
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import IngestionStageName, JobStatus, StageStatus


class IngestionJobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---- job: читання / створення ------------------------------------------

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

    # ---- job: зміна стану --------------------------------------------------

    def mark_processing(self, job: IngestionJob, stage: IngestionStageName) -> None:
        job.status = JobStatus.PROCESSING
        job.current_stage = stage
        job.started_at = job.started_at or utcnow()
        job.error_code = job.error_message = None

    def bump_progress(self, job: IngestionJob, value: int) -> None:
        """Прогрес ніколи не зменшується (retry етапу не «відкочує» його)."""
        job.progress = max(job.progress, value)

    def mark_completed(self, job: IngestionJob) -> None:
        job.status, job.progress, job.finished_at = JobStatus.COMPLETED, 100, utcnow()
        job.error_code = job.error_message = None

    async def mark_failed(self, job: IngestionJob, code: str, message: str,
                          *stage_names: IngestionStageName) -> None:
        """job → FAILED; вказані stage-и (крім COMPLETED) → FAILED."""
        now = utcnow()
        job.status, job.finished_at = JobStatus.FAILED, now
        job.error_code, job.error_message = code[:64], message[:2000]
        for name in stage_names:
            stage = await self.get_or_create_stage(job.id, name)
            if stage.status != StageStatus.COMPLETED:
                stage.status, stage.finished_at = StageStatus.FAILED, now
                stage.error_message = message[:2000]

    async def record_retry(self, job_id: uuid.UUID, retries: int) -> None:
        job = await self.db.get(IngestionJob, job_id)
        if job is not None:
            job.retry_count = retries
            job.status = JobStatus.QUEUED

    # ---- stages ------------------------------------------------------------

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

    async def begin_stage(self, job_id: uuid.UUID, name: IngestionStageName, *,
                          items_total: int = 0) -> IngestionStage:
        """Скинути й запустити stage (retry перезаписує рядок)."""
        stage = await self.get_or_create_stage(job_id, name)
        stage.status, stage.started_at, stage.finished_at = StageStatus.PROCESSING, utcnow(), None
        stage.items_total, stage.items_processed = items_total, 0
        stage.error_message = None
        return stage

    async def complete_stage(self, job_id: uuid.UUID, name: IngestionStageName, *,
                             items: int | None = None) -> IngestionStage:
        stage = await self.get_or_create_stage(job_id, name)
        stage.status, stage.finished_at = StageStatus.COMPLETED, utcnow()
        if items is not None:
            stage.items_total = stage.items_processed = items
        return stage

    async def set_stage_items(self, job_id: uuid.UUID,
                              names: tuple[IngestionStageName, ...], done: int) -> None:
        for name in names:
            stage = await self.get_or_create_stage(job_id, name)
            stage.items_processed = done