"""Етап PARSE ingestion-pipeline: репозиторії + storage + парсер. Без Celery.

Транзакції короткі: стан → commit → (довгий) парсинг без відкритої
транзакції → результат → commit.
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass
from hashlib import sha256
from typing import Any, cast

from app.rag.domain.enums import DocumentStatus, IngestionStageName
from app.rag.domain.ports import BlobStorage
from app.rag.errors import MissingFileError, ParseError
from app.rag.ingestion.canonical import CanonicalDocument
from app.rag.ingestion.parsers import ParseLimits, parse_document_bytes
from app.rag.ingestion.stage_common import (
    SessionFactory, fail_job_stages, load_context,
)
from app.rag.ingestion.storage import get_blob_storage, read_original, save_canonical
from app.rag.repositories import DocumentRepository, IngestionJobRepository
from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob

logger = logging.getLogger(__name__)

STAGE = IngestionStageName.PARSE
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
        ctx = await load_context(db, job_id, STAGE)
        if isinstance(ctx, dict):
            return ctx
        doc = ctx.doc
        ctx.jobs.mark_processing(ctx.job, STAGE)
        ctx.docs.set_status(doc, DocumentStatus.PROCESSING)
        await ctx.jobs.begin_stage(job_id, STAGE)
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
        await fail_job_stages(session_factory, job_id, exc.code, exc.message, STAGE)
        return {"status": "failed", "error_code": exc.code, "error_message": exc.message,
                "job_id": str(job_id), "document_id": str(src.document_id)}

    # 3) зафіксувати успіх
    async with session_factory() as db:
        jobs, docs = IngestionJobRepository(db), DocumentRepository(db)
        job = cast(IngestionJob, await jobs.get(job_id))
        doc = cast(Document, await docs.get(src.document_id))

        await jobs.complete_stage(job_id, STAGE, items=len(canonical.blocks))
        jobs.bump_progress(job, PARSE_PROGRESS)

        docs.fill_missing(
            doc,
            size_bytes=len(data),
            content_hash=sha256(data).hexdigest(),
            author=canonical.author,
            published_at=canonical.published_at,
            language=canonical.language,
            url=canonical.url,
        )
        docs.merge_meta(doc, "parse", {
            "parser": canonical.metadata.get("parser"),
            "title": canonical.title,
            "blocks": len(canonical.blocks),
            "chars": len(canonical.content),
            "pages": canonical.metadata.get("page_count"),
        })
        await db.commit()

    return {"status": "parsed", "job_id": str(job_id), "document_id": str(src.document_id),
            "blocks": len(canonical.blocks), "chars": len(canonical.content)}


async def record_retry(session_factory: SessionFactory, job_id: uuid.UUID, retries: int) -> None:
    async with session_factory() as db:
        await IngestionJobRepository(db).record_retry(job_id, retries)
        await db.commit()


async def fail_job(session_factory: SessionFactory, job_id: uuid.UUID, code: str, message: str) -> None:
    """Фінальний фейл після вичерпання retry / таймауту."""
    await fail_job_stages(session_factory, job_id, code, message, STAGE)
