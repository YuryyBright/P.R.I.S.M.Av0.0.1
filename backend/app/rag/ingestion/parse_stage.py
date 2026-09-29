"""Етап PARSE ingestion-pipeline: БД + storage + парсер. Без Celery.

Транзакції короткі: стан → commit → (довгий) парсинг без відкритої
транзакції → результат → commit.
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass
from hashlib import sha256
from typing import Any


from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus, StageStatus
from app.rag.ingestion.canonical import CanonicalDocument
from app.rag.errors import MissingFileError, ParseError
from app.rag.ingestion.parsers import ParseLimits, parse_document_bytes
from app.rag.domain.ports import BlobStorage
from app.rag.ingestion.stage_common import SessionFactory, fail_job_stages, fail_stages, get_stage
from app.rag.ingestion.storage import get_blob_storage, read_original, save_canonical

logger = logging.getLogger(__name__)

PARSE_PROGRESS = 20   # % прогресу job-а після завершення PARSE


@dataclass(slots=True)
class _Source:
    document_id: uuid.UUID
    storage_path: str | None
    filename: str | None
    mime_type: str | None
    source_id: str | None
    external_id: str | None
    url: str | None


async def run_parse_stage(
    session_factory: SessionFactory,
    job_id: uuid.UUID,
    *,
    storage: BlobStorage | None = None,
    limits: ParseLimits | None = None,
) -> dict[str, Any]:
    """Повертає {"status": "parsed"|"failed"|"skipped", ...}.
    ParseError → job/document стають FAILED, виключення НЕ піднімається.
    Будь-яке інше виключення (I/O, БД) піднімається — для retry у Celery."""
    storage = storage or get_blob_storage()

    # 1) взяти job/document, позначити стан
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return {"status": "skipped", "reason": "job_not_found", "job_id": str(job_id)}
        if job.status in (JobStatus.CANCELLED, JobStatus.COMPLETED):
            return {"status": "skipped", "reason": f"job_{job.status.value}", "job_id": str(job_id)}

        doc = await db.get(Document, job.document_id) if job.document_id else None
        if doc is None or doc.status == DocumentStatus.DELETED or doc.deleted_at is not None:
            await fail_stages(db, job, None, "document_not_found", "Document not found or deleted", IngestionStageName.PARSE)
            return {"status": "failed", "error_code": "document_not_found", "job_id": str(job_id)}

        now = utcnow()
        job.status = JobStatus.PROCESSING
        job.current_stage = IngestionStageName.PARSE
        job.started_at = job.started_at or now
        job.error_code = job.error_message = None
        doc.status = DocumentStatus.PROCESSING
        stage = await get_stage(db, job_id, IngestionStageName.PARSE)
        stage.status, stage.started_at, stage.finished_at = StageStatus.PROCESSING, now, None
        stage.items_total = stage.items_processed = 0
        stage.error_message = None
        src = _Source(doc.id, doc.storage_path, doc.filename, doc.mime_type,
                      str(doc.source_id) if doc.source_id else None, doc.external_id, doc.url)
        await db.commit()

    # 2) читання + парсинг (без відкритої транзакції)
    try:
        if not src.storage_path:
            raise MissingFileError("Document has no storage_path")
        data = await asyncio.to_thread(read_original, storage, src.storage_path,
                                       (limits or ParseLimits()).max_bytes)
        canonical: CanonicalDocument = await asyncio.to_thread(
            parse_document_bytes, data, filename=src.filename or src.storage_path,
            mime_type=src.mime_type, source_id=src.source_id,
            external_id=src.external_id, url=src.url, limits=limits)
        await asyncio.to_thread(save_canonical, storage, str(src.document_id), canonical)
    except ParseError as exc:
        logger.warning("parse failed job=%s code=%s: %s", job_id, exc.code, exc.message)
        async with session_factory() as db:
            job = await db.get(IngestionJob, job_id)
            doc = await db.get(Document, src.document_id)
            await fail_stages(db, job, doc, exc.code, exc.message, IngestionStageName.PARSE)
        return {"status": "failed", "error_code": exc.code, "error_message": exc.message,
                "job_id": str(job_id), "document_id": str(src.document_id)}

    # 3) зафіксувати успіх
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        doc = await db.get(Document, src.document_id)
        stage = await get_stage(db, job_id, IngestionStageName.PARSE)
        stage.status, stage.finished_at = StageStatus.COMPLETED, utcnow()
        stage.items_total = stage.items_processed = len(canonical.blocks)
        job.progress = max(job.progress, PARSE_PROGRESS)

        doc.size_bytes = doc.size_bytes or len(data)
        doc.content_hash = doc.content_hash or sha256(data).hexdigest()
        doc.author = doc.author or canonical.author
        doc.published_at = doc.published_at or canonical.published_at
        doc.language = doc.language or canonical.language
        doc.url = doc.url or canonical.url
        doc.meta = {**doc.meta, "parse": {
            "parser": canonical.metadata.get("parser"),
            "title": canonical.title,
            "blocks": len(canonical.blocks),
            "chars": len(canonical.content),
            "pages": canonical.metadata.get("page_count"),
        }}
        await db.commit()

    return {"status": "parsed", "job_id": str(job_id), "document_id": str(src.document_id),
            "blocks": len(canonical.blocks), "chars": len(canonical.content)}


async def record_retry(session_factory: SessionFactory, job_id: uuid.UUID, retries: int) -> None:
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is not None:
            job.retry_count = retries
            job.status = JobStatus.QUEUED
            await db.commit()


async def fail_job(session_factory: SessionFactory, job_id: uuid.UUID, code: str, message: str) -> None:
    """Фінальний фейл після вичерпання retry / таймауту."""
    await fail_job_stages(session_factory, job_id, code, message, IngestionStageName.PARSE)
