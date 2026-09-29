"""Етап FINALIZE: перевірка повноти індексації → Job.COMPLETED, Document.READY.

Окремий крок, щоб завершення pipeline не змішувалось із логікою vector store.
Ідемпотентний: повторний виклик для COMPLETED job повертає skipped.
"""
import logging
import uuid
from typing import Any

from sqlmodel import func, select

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus, StageStatus
from app.rag.ingestion.stage_common import SessionFactory, fail_job_stages, fail_stages, get_stage

logger = logging.getLogger(__name__)

FINALIZE = IngestionStageName.FINALIZE


async def run_finalize_stage(session_factory: SessionFactory, job_id: uuid.UUID) -> dict[str, Any]:
    """Повертає {"status": "finalized"|"failed"|"skipped", ...}."""
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return {"status": "skipped", "reason": "job_not_found", "job_id": str(job_id)}
        if job.status in (JobStatus.CANCELLED, JobStatus.COMPLETED):
            return {"status": "skipped", "reason": f"job_{job.status.value}", "job_id": str(job_id)}

        doc = await db.get(Document, job.document_id) if job.document_id else None
        if doc is None or doc.status == DocumentStatus.DELETED or doc.deleted_at is not None:
            await fail_stages(db, job, None, "document_not_found",
                              "Document not found or deleted", FINALIZE)
            return {"status": "failed", "error_code": "document_not_found", "job_id": str(job_id)}

        now = utcnow()
        job.current_stage = FINALIZE
        stage = await get_stage(db, job_id, FINALIZE)
        stage.started_at = now

        total = (await db.exec(select(func.count()).select_from(DocumentChunk)
                               .where(DocumentChunk.document_id == doc.id))).one()
        pending = (await db.exec(select(func.count()).select_from(DocumentChunk).where(
            DocumentChunk.document_id == doc.id, DocumentChunk.indexed_at.is_(None)))).one()
        if total == 0 or pending:
            msg = f"{pending} of {total} chunks are not indexed"
            await fail_stages(db, job, doc, "index_incomplete", msg, FINALIZE)
            return {"status": "failed", "error_code": "index_incomplete",
                    "error_message": msg, "job_id": str(job_id)}

        stage.status, stage.finished_at = StageStatus.COMPLETED, now
        stage.items_total = stage.items_processed = total
        job.status, job.progress, job.finished_at = JobStatus.COMPLETED, 100, now
        job.error_code = job.error_message = None
        doc.status, doc.indexed_at = DocumentStatus.READY, now
        await db.commit()

    return {"status": "finalized", "job_id": str(job_id), "document_id": str(doc.id), "chunks": total}


async def fail_finalize_job(session_factory: SessionFactory, job_id: uuid.UUID,
                            code: str, message: str) -> None:
    await fail_job_stages(session_factory, job_id, code, message, FINALIZE)