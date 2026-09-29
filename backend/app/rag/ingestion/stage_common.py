"""Спільні helper-и всіх ingestion stage-ів."""
import uuid
from typing import Callable

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.ingestion_stage import IngestionStage
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus, StageStatus

SessionFactory = Callable[[], AsyncSession]


async def get_stage(db: AsyncSession, job_id: uuid.UUID, name: IngestionStageName) -> IngestionStage:
    stage = (await db.exec(select(IngestionStage).where(
        IngestionStage.job_id == job_id, IngestionStage.stage == name))).first()
    if stage is None:
        stage = IngestionStage(job_id=job_id, stage=name)
        db.add(stage)
    return stage


async def fail_stages(db: AsyncSession, job: IngestionJob | None, doc: Document | None,
                      code: str, message: str, *names: IngestionStageName) -> None:
    """job/document → FAILED; вказані stage-и (крім COMPLETED) → FAILED."""
    now = utcnow()
    if job is not None:
        job.status, job.finished_at = JobStatus.FAILED, now
        job.error_code, job.error_message = code[:64], message[:2000]
        for name in names:
            stage = await get_stage(db, job.id, name)
            if stage.status != StageStatus.COMPLETED:
                stage.status, stage.finished_at = StageStatus.FAILED, now
                stage.error_message = message[:2000]
    if doc is not None:
        doc.status = DocumentStatus.FAILED
    await db.commit()


async def fail_job_stages(session_factory: SessionFactory, job_id: uuid.UUID,
                          code: str, message: str, *names: IngestionStageName) -> None:
    """Фінальний фейл після вичерпання retry / таймауту."""
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return
        doc = await db.get(Document, job.document_id) if job.document_id else None
        await fail_stages(db, job, doc, code, message, *names)