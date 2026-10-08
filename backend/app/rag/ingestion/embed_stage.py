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
from typing import Any, cast

from app.rag.container import build_container
from app.rag.domain.enums import DocumentStatus, IngestionStageName, JobStatus
from app.rag.domain.ports import Embedder, SparseEmbedder, VectorPoint, VectorStore
from app.rag.errors import DimensionMismatchError, ParseError
from app.rag.ingestion.stage_common import (
    SessionFactory, fail_job_stages, fail_stages, load_context,
)
from app.rag.repositories import DocumentChunkRepository, DocumentRepository, IngestionJobRepository
from app.models.rag.document import Document
from app.models.rag.ingestion_job import IngestionJob

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
        ctx = await load_context(db, job_id, EMBED, INDEX)
        if isinstance(ctx, dict):
            return ctx
        doc = ctx.doc
        ctx.jobs.mark_processing(ctx.job, EMBED)
        ctx.docs.set_status(doc, DocumentStatus.EMBEDDING)
        rows = await DocumentChunkRepository(db).list_for_embedding(doc.id)
        for name in (EMBED, INDEX):
            await ctx.jobs.begin_stage(job_id, name, items_total=len(rows))
        info = _DocInfo(doc.id, doc.collection_id, doc.source_id, doc.title, doc.language)
        if not rows:
            await fail_stages(db, ctx.job, doc, "no_chunks", "Document has no chunks", EMBED, INDEX)
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
            reason = await _record_batch(session_factory, job_id, info.id,
                                         [c.id for c in batch], deps.embedder.model, done, total)
            if reason:
                return await _abort(deps, info, job_id, reason)

        reason = None
        async with session_factory() as db:
            jobs, docs = IngestionJobRepository(db), DocumentRepository(db)
            job = await jobs.get(job_id)
            active_doc = await docs.get_active(info.id)
            if job is None or job.status == JobStatus.CANCELLED:
                reason = "job_cancelled"
            elif active_doc is None:
                reason = "document_deleted"
            else:
                docs.set_status(active_doc, DocumentStatus.INDEXING)
                jobs.mark_processing(job, INDEX)
                await db.commit()
        if reason:
            return await _abort(deps, info, job_id, reason)
        removed = await deps.store.delete_stale(str(info.id), [str(c.id) for c in chunks])
    except ParseError as exc:
        logger.warning("embed failed job=%s code=%s: %s", job_id, exc.code, exc.message)
        await fail_job_stages(session_factory, job_id, exc.code, exc.message, EMBED, INDEX)
        return {"status": "failed", "error_code": exc.code, "error_message": exc.message,
                "job_id": str(job_id), "document_id": str(info.id)}

    # 3) зафіксувати успіх
    async with session_factory() as db:
        jobs, docs = IngestionJobRepository(db), DocumentRepository(db)
        job = cast(IngestionJob, await jobs.get(job_id))
        doc = cast(Document, await docs.get(info.id))
        for name in (EMBED, INDEX):
            await jobs.complete_stage(job_id, name, items=total)
        jobs.bump_progress(job, PROGRESS_END)
        docs.merge_meta(doc, "index", {
            "points": total, "stale_removed": removed,
            "embedding_model": deps.embedder.model, "sparse": deps.sparse is not None,
        })
        await db.commit()

    return {"status": "embedded", "job_id": str(job_id), "document_id": str(info.id),
            "chunks": total, "stale_removed": removed}


async def _record_batch(session_factory: SessionFactory, job_id: uuid.UUID, document_id: uuid.UUID,
                        chunk_ids: list[uuid.UUID], model: str, done: int, total: int) -> str | None:
    """Записати прогрес батча. Повертає причину переривання ("job_cancelled"/"document_deleted")
    або None — так скасування/видалення помічаються між батчами, а не лише на старті етапу."""
    async with session_factory() as db:
        jobs, docs = IngestionJobRepository(db), DocumentRepository(db)
        await DocumentChunkRepository(db).mark_indexed(chunk_ids, model, EMBEDDING_VERSION)
        await jobs.set_stage_items(job_id, (EMBED, INDEX), done)
        job = cast(IngestionJob, await jobs.get(job_id))
        jobs.bump_progress(job, PROGRESS_START + (PROGRESS_END - PROGRESS_START) * done // total)
        reason = None
        if job.status == JobStatus.CANCELLED:
            reason = "job_cancelled"
        elif await docs.get_active(document_id) is None:
            reason = "document_deleted"
        await db.commit()
        return reason


async def _abort(deps: EmbedDeps, info: _DocInfo, job_id: uuid.UUID, reason: str) -> dict[str, Any]:
    """Етап перервано ззовні. Для видаленого документа прибираємо вже записані вектори
    (purge міг відпрацювати раніше за цей upsert); статус job-а/документа не чіпаємо."""
    if reason == "document_deleted":
        await deps.store.delete_document(str(info.id))
    logger.info("embed aborted job=%s reason=%s", job_id, reason)
    return {"status": "skipped", "reason": reason, "job_id": str(job_id), "document_id": str(info.id)}


async def fail_embed_job(session_factory: SessionFactory, job_id: uuid.UUID,
                         code: str, message: str) -> None:
    await fail_job_stages(session_factory, job_id, code, message, EMBED, INDEX)
