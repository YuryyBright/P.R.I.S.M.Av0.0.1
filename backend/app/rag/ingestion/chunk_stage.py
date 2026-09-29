"""Етап CHUNK ingestion-pipeline: БД + storage + chunker. Без Celery.

Той самий патерн, що й у parse_stage: стан → commit → (CPU) чанкінг без
відкритої транзакції → запис результату → commit. Етап ідемпотентний:
старі чанки документа видаляються й вставляються нові в ОДНІЙ транзакції.
"""
import asyncio
import logging
import uuid
from typing import Any

from sqlalchemy import delete

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus, StageStatus
from app.rag.ingestion.canonical import CanonicalDocument
from app.rag.ingestion.chunker import ChunkDraft, TokenCounter, chunk_document, default_token_counter
from app.rag.errors import EmptyContentError, ParseError
from app.rag.ingestion.stage_common import SessionFactory, fail_job_stages, fail_stages, get_stage
from app.rag.ingestion.storage import BlobStorage, get_blob_storage, load_canonical
from app.rag.settings import ChunkingSettings, get_rag_settings

logger = logging.getLogger(__name__)

STAGE = IngestionStageName.CHUNK
CHUNK_PROGRESS = 40   # % прогресу job-а після CHUNK


def chunk_id(document_id: uuid.UUID, version: str, index: int, content_hash: str) -> uuid.UUID:
    """Детермінований id = id точки в Qdrant: повторний запуск дає ті самі id."""
    return uuid.uuid5(document_id, f"{version}:{index}:{content_hash}")


def _build(canonical: CanonicalDocument, cfg: ChunkingSettings, count: TokenCounter) -> list[ChunkDraft]:
    drafts = chunk_document(canonical, cfg, count)
    if not drafts:
        raise EmptyContentError("Document produced no chunks")
    return drafts


async def run_chunk_stage(
    session_factory: SessionFactory,
    job_id: uuid.UUID,
    *,
    storage: BlobStorage | None = None,
    cfg: ChunkingSettings | None = None,
    count_tokens: TokenCounter | None = None,
) -> dict[str, Any]:
    """Повертає {"status": "chunked"|"failed"|"skipped", ...}.
    Постійні помилки (ParseError, битий canonical) → FAILED без виключення.
    Тимчасові (I/O, БД) піднімаються — для retry у Celery."""
    storage = storage or get_blob_storage()
    cfg = cfg or get_rag_settings().chunking
    count = count_tokens or default_token_counter()

    # 1) стан
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return {"status": "skipped", "reason": "job_not_found", "job_id": str(job_id)}
        if job.status in (JobStatus.CANCELLED, JobStatus.COMPLETED):
            return {"status": "skipped", "reason": f"job_{job.status.value}", "job_id": str(job_id)}

        doc = await db.get(Document, job.document_id) if job.document_id else None
        if doc is None or doc.status == DocumentStatus.DELETED or doc.deleted_at is not None:
            await fail_stages(db, job, None, "document_not_found", "Document not found or deleted", STAGE)
            return {"status": "failed", "error_code": "document_not_found", "job_id": str(job_id)}

        now = utcnow()
        job.status = JobStatus.PROCESSING
        job.current_stage = STAGE
        job.error_code = job.error_message = None
        doc.status = DocumentStatus.CHUNKING
        stage = await get_stage(db, job_id, STAGE)
        stage.status, stage.started_at, stage.finished_at = StageStatus.PROCESSING, now, None
        stage.items_total = stage.items_processed = 0
        stage.error_message = None
        document_id = doc.id
        await db.commit()

    # 2) читання canonical + чанкінг (без відкритої транзакції)
    try:
        canonical = await asyncio.to_thread(load_canonical, storage, str(document_id))
        drafts = await asyncio.to_thread(_build, canonical, cfg, count)
    except (ParseError, ValueError, KeyError) as exc:   # ValueError/KeyError — битий/старий canonical
        code = getattr(exc, "code", "canonical_invalid")
        message = getattr(exc, "message", None) or str(exc)
        logger.warning("chunk failed job=%s code=%s: %s", job_id, code, message)
        async with session_factory() as db:
            job = await db.get(IngestionJob, job_id)
            doc = await db.get(Document, document_id)
            await fail_stages(db, job, doc, code, message, STAGE)
        return {"status": "failed", "error_code": code, "error_message": message,
                "job_id": str(job_id), "document_id": str(document_id)}

    # 3) запис: видалити старі чанки + вставити нові (одна транзакція)
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        doc = await db.get(Document, document_id)
        stage = await get_stage(db, job_id, STAGE)

        await db.exec(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
        db.add_all(
            DocumentChunk(
                id=chunk_id(document_id, cfg.version, d.index, d.content_hash),
                document_id=document_id,
                chunk_index=d.index,
                content=d.content,
                token_count=d.token_count,
                content_hash=d.content_hash,
                page_number=d.page_start,
                char_start=d.char_start,
                char_end=d.char_end,
                meta={"heading_path": d.heading_path, "page_end": d.page_end},
                chunking_version=cfg.version,
            )
            for d in drafts
        )

        stage.status, stage.finished_at = StageStatus.COMPLETED, utcnow()
        stage.items_total = stage.items_processed = len(drafts)
        job.progress = max(job.progress, CHUNK_PROGRESS)
        doc.meta = {**doc.meta, "chunk": {
            "chunks": len(drafts),
            "tokens": sum(d.token_count for d in drafts),
            "version": cfg.version,
        }}
        await db.commit()

    return {"status": "chunked", "job_id": str(job_id), "document_id": str(document_id),
            "chunks": len(drafts)}


async def fail_chunk_job(session_factory: SessionFactory, job_id: uuid.UUID,
                         code: str, message: str) -> None:
    """Фінальний фейл після вичерпання retry / таймауту (для етапу CHUNK)."""
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return
        doc = await db.get(Document, job.document_id) if job.document_id else None
        await fail_stages(db, job, doc, code, message, STAGE)