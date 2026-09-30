"""Спільні helper-и всіх ingestion stage-ів (поверх репозиторіїв, без прямих запитів).

Транзакціями, як і раніше, керують самі stage-и; тут лише оркестрація.
"""
import uuid
from dataclasses import dataclass
from typing import Any, Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus
from app.rag.repositories import DocumentRepository, IngestionJobRepository

SessionFactory = Callable[[], AsyncSession]


@dataclass(slots=True)
class StageContext:
    job: IngestionJob
    doc: Document
    jobs: IngestionJobRepository
    docs: DocumentRepository


async def load_context(db: AsyncSession, job_id: uuid.UUID,
                       *stage_names: IngestionStageName) -> StageContext | dict[str, Any]:
    """Спільний вхід усіх етапів: job → перевірка статусу → активний документ.

    Повертає StageContext, або готовий результат етапу (dict) для раннього виходу:
    skipped (нема job / скасований / завершений) чи failed (документа нема або видалений).
    """
    jobs, docs = IngestionJobRepository(db), DocumentRepository(db)
    job = await jobs.get(job_id)
    if job is None:
        return {"status": "skipped", "reason": "job_not_found", "job_id": str(job_id)}
    if job.status in (JobStatus.CANCELLED, JobStatus.COMPLETED):
        return {"status": "skipped", "reason": f"job_{job.status.value}", "job_id": str(job_id)}

    doc = await docs.get_active(job.document_id) if job.document_id else None
    if doc is None:
        await fail_stages(db, job, None, "document_not_found",
                          "Document not found or deleted", *stage_names)
        return {"status": "failed", "error_code": "document_not_found", "job_id": str(job_id)}
    return StageContext(job, doc, jobs, docs)


async def fail_stages(db: AsyncSession, job: IngestionJob | None, doc: Document | None,
                      code: str, message: str, *names: IngestionStageName) -> None:
    """job/document → FAILED; вказані stage-и (крім COMPLETED) → FAILED. Робить commit."""
    if job is not None:
        await IngestionJobRepository(db).mark_failed(job, code, message, *names)
    if doc is not None:
        DocumentRepository(db).set_status(doc, DocumentStatus.FAILED)
    await db.commit()


async def fail_job_stages(session_factory: SessionFactory, job_id: uuid.UUID,
                          code: str, message: str, *names: IngestionStageName) -> None:
    """Фінальний фейл після вичерпання retry / таймауту / постійної помилки етапу."""
    async with session_factory() as db:
        job = await IngestionJobRepository(db).get(job_id)
        if job is None:
            return
        doc = await DocumentRepository(db).get(job.document_id) if job.document_id else None
        await fail_stages(db, job, doc, code, message, *names)