"""Фізичне очищення видалених документів і колекцій. БД + vector store + blob storage, без Celery.

Модель видалення:
  1. Сервіс робить soft-delete (Document.status=DELETED, Collection.deleted_at) і commit —
     з цього моменту ресурс невидимий для API.
  2. Celery-задача (або sweep, якщо dispatch впав) викликає purge_*: вектори → blob-и →
     чанки → маркер `meta["cleanup"]`.
Усе ідемпотентне: повторний запуск після збою безпечний; тимчасові помилки піднімаються
(Celery зробить retry).
"""
import asyncio
import logging
import uuid
from datetime import timedelta
from typing import Any

from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus
from app.rag.domain.ports import BlobStorage, VectorStore
from app.rag.ingestion.sincludetage_common import SessionFactory
from app.rag.ingestion.storage import delete_canonical, delete_original
from app.rag.repositories import CollectionRepository, DocumentChunkRepository, DocumentRepository

logger = logging.getLogger(__name__)


def _delete_blobs(storage: BlobStorage, storage_path: str | None, document_id: uuid.UUID) -> None:
    if storage_path:
        delete_original(storage, storage_path)
    delete_canonical(storage, str(document_id))


async def purge_document(session_factory: SessionFactory, document_id: uuid.UUID, *,
                         store: VectorStore, storage: BlobStorage) -> dict[str, Any]:
    """Повертає {"status": "purged"|"skipped", ...}."""
    async with session_factory() as db:
        doc = await DocumentRepository(db).get(document_id)
        if doc is None:
            return {"status": "skipped", "reason": "document_not_found", "document_id": str(document_id)}
        if doc.status != DocumentStatus.DELETED:
            return {"status": "skipped", "reason": "not_deleted", "document_id": str(document_id)}
        if "cleanup" in (doc.meta or {}):
            return {"status": "skipped", "reason": "already_purged", "document_id": str(document_id)}
        storage_path = doc.storage_path

    removed = await store.delete_document(str(document_id))
    await asyncio.to_thread(_delete_blobs, storage, storage_path, document_id)

    async with session_factory() as db:
        docs = DocumentRepository(db)
        doc = await docs.get(document_id)
        await DocumentChunkRepository(db).delete_for_document(document_id)
        docs.merge_meta(doc, "cleanup", {"at": utcnow().isoformat(), "vectors_removed": removed})
        doc.storage_path = None
        await db.commit()

    logger.info("purged document=%s vectors=%s", document_id, removed)
    return {"status": "purged", "document_id": str(document_id), "vectors_removed": removed}


async def purge_collection(session_factory: SessionFactory, collection_id: uuid.UUID, *,
                           store: VectorStore, storage: BlobStorage) -> dict[str, Any]:
    """Очистити всі документи колекції, потім фізично видалити документи й саму колекцію
    (FK documents.collection_id = RESTRICT, тому порядок важливий)."""
    async with session_factory() as db:
        col = await CollectionRepository(db).get(collection_id)
        if col is None:
            return {"status": "skipped", "reason": "collection_not_found", "collection_id": str(collection_id)}
        if col.deleted_at is None:
            return {"status": "skipped", "reason": "not_deleted", "collection_id": str(collection_id)}
        # страховка від документів, що з'явились між soft-delete і purge
        await DocumentRepository(db).soft_delete_in_collection(collection_id)
        await db.commit()
        doc_ids = await DocumentRepository(db).ids_in_collection(collection_id)

    for doc_id in doc_ids:
        await purge_document(session_factory, doc_id, store=store, storage=storage)

    async with session_factory() as db:
        await DocumentRepository(db).hard_delete_in_collection(collection_id)
        await CollectionRepository(db).hard_delete(collection_id)
        await db.commit()

    logger.info("purged collection=%s documents=%s", collection_id, len(doc_ids))
    return {"status": "purged", "collection_id": str(collection_id), "documents": len(doc_ids)}


async def find_pending_cleanup(session_factory: SessionFactory, *, min_age_s: int,
                               limit: int) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    """(collection_ids, document_ids), для яких очищення не завершене й dispatch, ймовірно, втрачено.

    Документи видалених колекцій не повертаються окремо: їх покриває purge_collection.
    """
    older_than = utcnow() - timedelta(seconds=min_age_s)
    async with session_factory() as db:
        collections = await CollectionRepository(db).list_deleted(older_than=older_than, limit=limit)
        pending_docs = await DocumentRepository(db).list_pending_cleanup(
            older_than=older_than, limit=limit)
    deleted = set(collections)
    # окремий purge_document для таких документів зайвий, але нешкідливий (ідемпотентний)
    doc_ids = [d for d, c in pending_docs if c not in deleted]
    return list(deleted), doc_ids