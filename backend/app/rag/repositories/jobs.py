"""Доступ до БД для IngestionJob / IngestionStage.

Без commit: транзакцією керує caller (stage або сервіс). Методи `mark_*`,
`bump_progress`, `cancel` лише змінюють стан об'єктів у сесії.
"""
import uuid
from datetime import datetime
from typing import Sequence

from sqlalchemy import ColumnElement, func, or_, update
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.collection import Collection
from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.ingestion_stage import IngestionStage
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import IngestionStageName, JobStatus, StageStatus
from sqlalchemy import delete as sa_delete

ACTIVE_JOB_STATUSES = (
    JobStatus.QUEUED,
    JobStatus.PROCESSING,
)


class IngestionJobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---- job: читання / створення ------------------------------------------

    def add(self, job: IngestionJob) -> None:
        self.db.add(job)

    async def get(self, job_id: uuid.UUID) -> IngestionJob | None:
        return await self.db.get(IngestionJob, job_id)          # stages — selectin

    async def find_active_for_document(self, document_id: uuid.UUID) -> IngestionJob | None:
        return (await self.db.exec(
            select(IngestionJob)
            .where(IngestionJob.document_id == document_id,
                   IngestionJob.status.in_(ACTIVE_JOB_STATUSES))
            .order_by(IngestionJob.created_at.desc()))).first()

    async def list_for_document(self, document_id: uuid.UUID, *, limit: int = 20) -> list[IngestionJob]:
        rows = await self.db.exec(
            select(IngestionJob).where(IngestionJob.document_id == document_id)
            .order_by(IngestionJob.created_at.desc()).limit(limit))
        return list(rows.all())

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

    def cancel(self, job: IngestionJob) -> None:
        job.status, job.finished_at = JobStatus.CANCELLED, utcnow()
        job.error_code, job.error_message = "cancelled", "Cancelled by user"

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

    # ---- масове скасування (видалення документів/колекцій) -----------------

    async def cancel_active_for_documents(self, document_ids: Sequence[uuid.UUID]) -> int:
        if not document_ids:
            return 0
        res = await self.db.exec(update(IngestionJob).where(
            IngestionJob.document_id.in_(document_ids),
            IngestionJob.status.in_(ACTIVE_JOB_STATUSES),
        ).values(status=JobStatus.CANCELLED, finished_at=utcnow(), error_code="cancelled"))
        return getattr(res, "rowcount", 0) or 0

    async def cancel_active_in_collection(self, collection_id: uuid.UUID) -> int:
        doc_ids = select(Document.id).where(Document.collection_id == collection_id)
        res = await self.db.exec(update(IngestionJob).where(
            IngestionJob.document_id.in_(doc_ids),
            IngestionJob.status.in_(ACTIVE_JOB_STATUSES),
        ).values(status=JobStatus.CANCELLED, finished_at=utcnow(), error_code="cancelled"))
        return getattr(res, "rowcount", 0) or 0

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
    
    async def list_page(
            self, *,
            user_id: uuid.UUID | None,
            collections_where: ColumnElement[bool] | None,
            status: JobStatus | None,
            document_id: uuid.UUID | None,
            limit: int,
            offset: int,
        ) -> tuple[list[tuple[IngestionJob, str | None, uuid.UUID | None]], int]:
            """Сторінка job-ів (нові першими) + назва документа й collection_id.
    
            user_id is None            -> без обмежень (superuser);
            user_id задано             -> job-и автора АБО job-и документів колекцій,
                                          що підпали під `collections_where`
                                          (умову будує access.collections_with_role_where).
            LEFT JOIN: job переживає видалення документа (document_id SET NULL),
            а власні job-и без документа лишаються видимими автору.
            """
            stmt = (
                select(IngestionJob, Document.title, Document.collection_id)
                .outerjoin(Document, Document.id == IngestionJob.document_id)
            )
            if user_id is not None:
                scope = IngestionJob.user_id == user_id
                if collections_where is not None:
                    scope = or_(
                        scope,
                        Document.collection_id.in_(
                            select(Collection.id).where(collections_where)),
                    )
                stmt = stmt.where(scope)
            if status is not None:
                stmt = stmt.where(IngestionJob.status == status)
            if document_id is not None:
                stmt = stmt.where(IngestionJob.document_id == document_id)
    
            total = (await self.db.exec(
                select(func.count()).select_from(stmt.order_by(None).subquery())
            )).one()
    
            rows = (await self.db.exec(
                stmt.order_by(IngestionJob.created_at.desc(), IngestionJob.id)
                    .limit(limit).offset(offset)
            )).all()
            return list(map(tuple, rows)), total
    async def delete_for_document(self, document_id: uuid.UUID) -> int:
        """Hard-delete всіх job-ів документа разом зі stages. Ідемпотентно.

        Викликається з purge_document ПІСЛЯ того, як job-и вже скасовані
        (soft-delete документа скасовує активні). Повертає кількість видалених job-ів.
        """
        return await self._hard_delete(IngestionJob.document_id == document_id)

    async def delete_in_collection(self, collection_id: uuid.UUID) -> int:
        """Страховка для purge_collection: добирає job-и, чиї документи ще не встигли
        пройти purge_document (або вже втратили document_id)."""
        doc_ids = select(Document.id).where(Document.collection_id == collection_id)
        return await self._hard_delete(IngestionJob.document_id.in_(doc_ids))

    async def _hard_delete(self, condition) -> int:
        # stages мають FK на job — видаляємо першими (безпечно навіть без ON DELETE CASCADE)
        job_ids = select(IngestionJob.id).where(condition)
        await self.db.exec(
            sa_delete(IngestionStage).where(IngestionStage.job_id.in_(job_ids))
        )
        res = await self.db.exec(sa_delete(IngestionJob).where(condition))
        return getattr(res, "rowcount", 0) or 0
    
    async def hard_delete_for_document(self, document_id: uuid.UUID) -> int:
        """Прибрати всі job-и документа разом зі stages. Ідемпотентно.

        Stages зникають завдяки ON DELETE CASCADE на ingestion_stages.job_id,
        тому додатково їх не чіпаємо.
        """
        res = await self.db.exec(
            delete(IngestionJob).where(IngestionJob.document_id == document_id)
        )
        return getattr(res, "rowcount", 0) or 0

    async def hard_delete_in_collection(self, collection_id: uuid.UUID) -> int:
        """Страховка для purge_collection: добирає job-и, чиї документи вже
        втратили document_id (SET NULL) або ще не пройшли purge_document."""
        doc_ids = select(Document.id).where(Document.collection_id == collection_id)
        res = await self.db.exec(
            delete(IngestionJob).where(IngestionJob.document_id.in_(doc_ids))
        )
        return getattr(res, "rowcount", 0) or 0
    
    