"""Етап EMBED + INDEX: чанки з БД → вектори → vector store.

Вектори в PostgreSQL не зберігаються, тому між EMBED та INDEX їх нема де
«запаркувати». Обробляємо батчами: embed(batch) → upsert(batch) → короткий
commit прогресу. Обидва рядки IngestionStage (EMBED, INDEX) ведуться разом.

Ідемпотентність: id точки = id чанка (детермінований), upsert перезаписує;
після успішного upsert усіх батчів видаляємо «застарілі» точки документа
(яких немає в поточному наборі чанків), тож документ ніколи не лишається
без векторів посеред перечанкінгу.
"""
import logging
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import update
from sqlmodel import select

from app.models.rag.document import Document
from app.models.rag.document_chunk import DocumentChunk
from app.models.rag.ingestion_job import IngestionJob
from app.models.rag.rag_base import utcnow
from app.rag.container import build_container
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus, StageStatus
from app.rag.errors import DimensionMismatchError, ParseError
from app.rag.ingestion.stage_common import SessionFactory, fail_job_stages, fail_stages, get_stage
from app.rag.domain.ports import Embedder, SparseEmbedder, VectorPoint, VectorStore

logger = logging.getLogger(__name__)

EMBED = IngestionStageName.EMBED
INDEX = IngestionStageName.INDEX
PROGRESS_START, PROGRESS_END = 40, 90     # діапазон progress job-а для EMBED+INDEX
EMBEDDING_VERSION = "v1"                  # підняти, якщо змінюється _embedding_text()


@dataclass(slots=True)
class EmbedDeps:
    embedder: Embedder
    sparse: SparseEmbedder | None
    store: VectorStore


@dataclass(slots=True)
class _Chunk:
    id: uuid.UUID
    index: int
    content: str
    page: int | None
    heading_path: list[str]


@dataclass(slots=True)
class _DocInfo:
    id: uuid.UUID
    collection_id: uuid.UUID
    source_id: uuid.UUID | None
    title: str
    language: str | None


def _embedding_text(title: str, c: _Chunk) -> str:
    """Dense-вектор будуємо з контекстом (назва + шлях заголовків): чанк із
    середини секції інакше втрачає, про що він."""
    header = " > ".join(x for x in [title, *c.heading_path] if x)
    return f"{header}\n\n{c.content}" if header else c.content


def _check_vectors(vectors: list[list[float]], expected: int, dim: int) -> None:
    if len(vectors) != expected:
        raise DimensionMismatchError(
            f"Embedder returned {len(vectors)} vectors for {expected} texts",
            code="embedding_count_mismatch")
    for v in vectors:
        if len(v) != dim:
            raise DimensionMismatchError(f"Vector dim {len(v)} != expected {dim}")


async def run_embed_stage(
    session_factory: SessionFactory,
    job_id: uuid.UUID,
    *,
    deps: EmbedDeps | None = None,
    batch_size: int | None = None,
) -> dict[str, Any]:
    """Повертає {"status": "embedded"|"failed"|"skipped", ...}.
    Постійні помилки (ParseError/ProviderError) → FAILED без виключення;
    тимчасові (мережа, 429/5xx) піднімаються — для retry у Celery.

    Без `deps` компоненти створюються з контейнера ВСЕРЕДИНІ поточного
    event loop і закриваються після етапу (async-клієнти не переносяться між loop-ами).
    """
    if deps is not None:
        return await _run(session_factory, job_id, deps, batch_size)
    container = build_container()
    try:
        deps = EmbedDeps(container.embedder, container.sparse, container.vector_store)
        return await _run(session_factory, job_id, deps, batch_size or container.settings.embedding.batch_size)
    finally:
        await container.aclose()


async def _run(session_factory: SessionFactory, job_id: uuid.UUID,
               deps: EmbedDeps, batch_size: int | None) -> dict[str, Any]:
    bs = batch_size or 64

    # 1) стан + читання чанків
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        if job is None:
            return {"status": "skipped", "reason": "job_not_found", "job_id": str(job_id)}
        if job.status in (JobStatus.CANCELLED, JobStatus.COMPLETED):
            return {"status": "skipped", "reason": f"job_{job.status.value}", "job_id": str(job_id)}

        doc = await db.get(Document, job.document_id) if job.document_id else None
        if doc is None or doc.status == DocumentStatus.DELETED or doc.deleted_at is not None:
            await fail_stages(db, job, None, "document_not_found",
                              "Document not found or deleted", EMBED, INDEX)
            return {"status": "failed", "error_code": "document_not_found", "job_id": str(job_id)}

        now = utcnow()
        job.status, job.current_stage = JobStatus.PROCESSING, EMBED
        job.error_code = job.error_message = None
        doc.status = DocumentStatus.EMBEDDING
        rows = (await db.exec(
            select(DocumentChunk.id, DocumentChunk.chunk_index, DocumentChunk.content,
                   DocumentChunk.page_number, DocumentChunk.meta)
            .where(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index))).all()
        for name in (EMBED, INDEX):
            st = await get_stage(db, job_id, name)
            st.status, st.started_at, st.finished_at = StageStatus.PROCESSING, now, None
            st.items_total, st.items_processed, st.error_message = len(rows), 0, None
        info = _DocInfo(doc.id, doc.collection_id, doc.source_id, doc.title, doc.language)
        if not rows:
            await fail_stages(db, job, doc, "no_chunks", "Document has no chunks", EMBED, INDEX)
            return {"status": "failed", "error_code": "no_chunks", "job_id": str(job_id)}
        await db.commit()

    chunks = [_Chunk(r[0], r[1], r[2], r[3], list((r[4] or {}).get("heading_path") or []))
              for r in rows]
    total = len(chunks)

    # 2) embed → upsert батчами (без відкритої транзакції під час мережевих викликів)
    try:
        await deps.store.ensure(deps.embedder.dim, sparse=deps.sparse is not None)
        done = 0
        for i in range(0, total, bs):
            batch = chunks[i:i + bs]
            dense = await deps.embedder.embed([_embedding_text(info.title, c) for c in batch])
            _check_vectors(dense, len(batch), deps.embedder.dim)
            sparse = (await deps.sparse.embed([c.content for c in batch])
                      if deps.sparse else [None] * len(batch))
            await deps.store.upsert([
                VectorPoint(
                    id=str(c.id), dense=d, sparse=s,
                    payload={
                        "document_id": str(info.id),
                        "collection_id": str(info.collection_id),
                        "source_id": str(info.source_id) if info.source_id else None,
                        "chunk_id": str(c.id),
                        "chunk_index": c.index,
                        "page": c.page,
                        "heading_path": c.heading_path,
                        "language": info.language,
                    })
                for c, d, s in zip(batch, dense, sparse)
            ])
            done += len(batch)
            await _record_batch(session_factory, job_id, [c.id for c in batch],
                                deps.embedder.model, done, total)

        async with session_factory() as db:
            doc = await db.get(Document, info.id)
            doc.status = DocumentStatus.INDEXING
            job = await db.get(IngestionJob, job_id)
            job.current_stage = INDEX
            await db.commit()
        removed = await deps.store.delete_stale(str(info.id), [str(c.id) for c in chunks])
    except ParseError as exc:
        logger.warning("embed failed job=%s code=%s: %s", job_id, exc.code, exc.message)
        async with session_factory() as db:
            job = await db.get(IngestionJob, job_id)
            doc = await db.get(Document, info.id)
            await fail_stages(db, job, doc, exc.code, exc.message, EMBED, INDEX)
        return {"status": "failed", "error_code": exc.code, "error_message": exc.message,
                "job_id": str(job_id), "document_id": str(info.id)}

    # 3) зафіксувати успіх
    async with session_factory() as db:
        job = await db.get(IngestionJob, job_id)
        doc = await db.get(Document, info.id)
        now = utcnow()
        for name in (EMBED, INDEX):
            st = await get_stage(db, job_id, name)
            st.status, st.finished_at = StageStatus.COMPLETED, now
            st.items_total = st.items_processed = total
        job.progress = max(job.progress, PROGRESS_END)
        doc.meta = {**doc.meta, "index": {
            "points": total, "stale_removed": removed,
            "embedding_model": deps.embedder.model, "sparse": deps.sparse is not None,
        }}
        await db.commit()

    return {"status": "embedded", "job_id": str(job_id), "document_id": str(info.id),
            "chunks": total, "stale_removed": removed}


async def _record_batch(session_factory: SessionFactory, job_id: uuid.UUID,
                        chunk_ids: list[uuid.UUID], model: str, done: int, total: int) -> None:
    async with session_factory() as db:
        await db.exec(update(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids)).values(
            embedding_model=model, embedding_version=EMBEDDING_VERSION, indexed_at=utcnow()))
        for name in (EMBED, INDEX):
            st = await get_stage(db, job_id, name)
            st.items_processed = done
        job = await db.get(IngestionJob, job_id)
        job.progress = max(job.progress,
                           PROGRESS_START + (PROGRESS_END - PROGRESS_START) * done // total)
        await db.commit()


async def fail_embed_job(session_factory: SessionFactory, job_id: uuid.UUID,
                         code: str, message: str) -> None:
    await fail_job_stages(session_factory, job_id, code, message, EMBED, INDEX)