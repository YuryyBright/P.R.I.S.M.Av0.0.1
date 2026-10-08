"""Етап CHUNK ingestion-pipeline: репозиторії + storage + chunker. Без Celery.

Той самий патерн, що й у parse_stage: стан → commit → (CPU) чанкінг без
відкритої транзакції → запис результату → commit. Етап ідемпотентний:
старі чанки документа видаляються й вставляються нові в ОДНІЙ транзакції.
"""
import asyncio
import logging
import uuid
from typing import Any, cast

from app.models.rag.document_chunk import DocumentChunk
from app.rag.domain.enums import DocumentStatus, IngestionStageName
from app.rag.errors import EmptyContentError, ParseError
from app.rag.ingestion.canonical import CanonicalDocument
from app.rag.ingestion.chunker import ChunkDraft, TokenCounter, chunk_document, default_token_counter
from app.rag.ingestion.stage_common import SessionFactory, fail_job_stages, load_context
from app.rag.ingestion.storage import BlobStorage, get_blob_storage, load_canonical
from app.rag.repositories import DocumentChunkRepository, DocumentRepository, IngestionJobRepository
from app.rag.settings import ChunkingSettings, get_rag_settings
from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob

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
        ctx = await load_context(db, job_id, STAGE)
        if isinstance(ctx, dict):
            return ctx
        ctx.jobs.mark_processing(ctx.job, STAGE)
        ctx.docs.set_status(ctx.doc, DocumentStatus.CHUNKING)
        await ctx.jobs.begin_stage(job_id, STAGE)
        document_id = ctx.doc.id
        await db.commit()

    # 2) читання canonical + чанкінг (без відкритої транзакції)
    try:
        canonical = await asyncio.to_thread(load_canonical, storage, str(document_id))
        drafts = await asyncio.to_thread(_build, canonical, cfg, count)
    except (ParseError, ValueError, KeyError) as exc:   # ValueError/KeyError — битий/старий canonical
        code = getattr(exc, "code", "canonical_invalid")
        message = getattr(exc, "message", None) or str(exc)
        logger.warning("chunk failed job=%s code=%s: %s", job_id, code, message)
        await fail_job_stages(session_factory, job_id, code, message, STAGE)
        return {"status": "failed", "error_code": code, "error_message": message,
                "job_id": str(job_id), "document_id": str(document_id)}

    # 3) запис: видалити старі чанки + вставити нові (одна транзакція)
    async with session_factory() as db:
        jobs, docs, chunks = (IngestionJobRepository(db), DocumentRepository(db),
                              DocumentChunkRepository(db))
        job = cast(IngestionJob, await jobs.get(job_id))
        doc = cast(Document, await docs.get(document_id))

        await chunks.replace_for_document(document_id, [
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
        ])

        await jobs.complete_stage(job_id, STAGE, items=len(drafts))
        jobs.bump_progress(job, CHUNK_PROGRESS)
        docs.merge_meta(doc, "chunk", {
            "chunks": len(drafts),
            "tokens": sum(d.token_count for d in drafts),
            "version": cfg.version,
        })
        await db.commit()

    return {"status": "chunked", "job_id": str(job_id), "document_id": str(document_id),
            "chunks": len(drafts)}


async def fail_chunk_job(session_factory: SessionFactory, job_id: uuid.UUID,
                         code: str, message: str) -> None:
    """Фінальний фейл після вичерпання retry / таймауту (для етапу CHUNK)."""
    await fail_job_stages(session_factory, job_id, code, message, STAGE)
