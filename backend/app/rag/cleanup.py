"""Фізичне очищення видалених документів і колекцій.

Модель видалення:
    1. Сервіс робить soft-delete і commit.
    2. purge_* очищає vector store + blob storage.
    3. Для документів видаляються chunks та ingestion jobs.
    4. Після успішного cleanup виконується hard-delete.

Усе має бути ідемпотентним: повторний запуск після збою безпечний.
Тимчасові помилки піднімаються, щоб Celery/sweep міг повторити cleanup.
"""

import asyncio
import logging
import uuid
from datetime import timedelta
from typing import Any

from app.models.rag.rag_base import utcnow
from app.rag.domain.enums import DocumentStatus
from app.rag.domain.ports import BlobStorage, VectorStore
from app.rag.ingestion.stage_common import SessionFactory
from app.rag.ingestion.storage import delete_canonical, delete_original
from app.rag.repositories import (
    CollectionRepository,
    DocumentChunkRepository,
    DocumentRepository,
    IngestionJobRepository,
)

logger = logging.getLogger(__name__)


def _delete_blobs(
    storage: BlobStorage,
    storage_path: str | None,
    document_id: uuid.UUID,
) -> None:
    if storage_path:
        delete_original(storage, storage_path)

    delete_canonical(storage, str(document_id))


async def purge_document(
    session_factory: SessionFactory,
    document_id: uuid.UUID,
    *,
    store: VectorStore,
    storage: BlobStorage,
) -> dict[str, Any]:
    """Фізично очистити один soft-deleted документ."""

    # ---------------------------------------------------------
    # TRANSACTION 1
    # Перевіряємо документ і забираємо storage_path.
    # ---------------------------------------------------------

    async with session_factory() as db:
        repo = DocumentRepository(db)

        doc = await repo.get(document_id)

        if doc is None:
            return {
                "status": "skipped",
                "reason": "document_not_found",
                "document_id": str(document_id),
            }

        if doc.status != DocumentStatus.DELETED:
            return {
                "status": "skipped",
                "reason": "not_deleted",
                "document_id": str(document_id),
            }

        if "cleanup" in (doc.meta or {}):
            return {
                "status": "skipped",
                "reason": "already_purged",
                "document_id": str(document_id),
            }

        storage_path = doc.storage_path

    # ---------------------------------------------------------
    # OUTSIDE DB TRANSACTION
    # Vector store + blob storage.
    # ---------------------------------------------------------

    vectors_removed = await store.delete_document(
        str(document_id)
    )

    await asyncio.to_thread(
        _delete_blobs,
        storage,
        storage_path,
        document_id,
    )

    # ---------------------------------------------------------
    # TRANSACTION 2
    # Видаляємо DB-залежності документа.
    # ---------------------------------------------------------

    async with session_factory() as db:
        repo = DocumentRepository(db)

        doc = await repo.get(document_id)

        if doc is None:
            return {
                "status": "skipped",
                "reason": "document_not_found",
                "document_id": str(document_id),
            }

        if doc.status != DocumentStatus.DELETED:
            return {
                "status": "skipped",
                "reason": "not_deleted",
                "document_id": str(document_id),
            }

        await DocumentChunkRepository(db).delete_for_document(
            document_id
        )

        jobs_removed = (
            await IngestionJobRepository(db)
            .hard_delete_for_document(document_id)
        )

        repo.merge_meta(
            doc,
            "cleanup",
            {
                "at": utcnow().isoformat(),
                "vectors_removed": vectors_removed,
                "jobs_removed": jobs_removed,
            },
        )

        doc.storage_path = None

        await db.commit()

    logger.info(
        "purged document=%s vectors=%s jobs=%s",
        document_id,
        vectors_removed,
        jobs_removed,
    )

    return {
        "status": "purged",
        "document_id": str(document_id),
        "vectors_removed": vectors_removed,
        "jobs_removed": jobs_removed,
    }


async def purge_collection(
    session_factory: SessionFactory,
    collection_id: uuid.UUID,
    *,
    store: VectorStore,
    storage: BlobStorage,
) -> dict[str, Any]:
    """Фізично очистити всі документи колекції та саму колекцію.

    Порядок:
        1. Перевірити, що collection soft-deleted.
        2. Отримати document IDs.
        3. Soft-delete документи.
        4. Cancel активні ingestion jobs.
        5. Commit.
        6. Очистити vector store + blob для кожного документа.
        7. Hard-delete документи.
        8. Hard-delete collection.

    FK documents.collection_id = RESTRICT,
    тому документи повинні бути видалені перед collection.
    """

    # ---------------------------------------------------------
    # TRANSACTION 1
    # ---------------------------------------------------------

    async with session_factory() as db:
        collection = await CollectionRepository(db).get(
            collection_id
        )

        if collection is None:
            return {
                "status": "skipped",
                "reason": "collection_not_found",
                "collection_id": str(collection_id),
            }

        if collection.deleted_at is None:
            return {
                "status": "skipped",
                "reason": "not_deleted",
                "collection_id": str(collection_id),
            }

        # Архівну колекцію (яку ще можна відновити) чіпати не можна:
        # purge дозволений лише після «видалити назавжди» / спливу retention.
        if collection.purge_requested_at is None:
            return {
                "status": "skipped",
                "reason": "archived_not_purge_requested",
                "collection_id": str(collection_id),
            }

        document_repo = DocumentRepository(db)
        job_repo = IngestionJobRepository(db)

        # Отримуємо IDs до hard-delete.
        document_ids = await document_repo.ids_in_collection(
            collection_id
        )

        # Страховка: усі документи collection стають DELETED.
        await document_repo.soft_delete_in_collection(
            collection_id
        )

        # Зупиняємо активні ingestion jobs.
        cancelled_jobs = (
            await job_repo.cancel_active_in_collection(
                collection_id
            )
        )

        await db.commit()

    # ---------------------------------------------------------
    # OUTSIDE DB TRANSACTION
    # Vector store + blob storage.
    # ---------------------------------------------------------

    for document_id in document_ids:
        result = await purge_document(
            session_factory=session_factory,
            document_id=document_id,
            store=store,
            storage=storage,
        )

        # "purged" — документ очищено.
        # "skipped/document_not_found" — можливо, його вже
        # очистив інший worker, що є нормальним для idempotency.
        #
        # Інші помилки не ковтаємо: collection не повинна
        # hard-delete, якщо cleanup документа не завершився.
        if result["status"] not in {"purged", "skipped"}:
            raise RuntimeError(
                f"Failed to purge document "
                f"{document_id}: {result}"
            )

    # ---------------------------------------------------------
    # TRANSACTION 2
    # ---------------------------------------------------------

    async with session_factory() as db:
        # IngestionJob вже видаляються в purge_document().
        # Повторний delete_in_collection() тут НЕ потрібен.

        await DocumentRepository(db).hard_delete_in_collection(
            collection_id
        )

        await CollectionRepository(db).hard_delete(
            collection_id
        )

        await db.commit()

    logger.info(
        "purged collection=%s documents=%s cancelled_jobs=%s",
        collection_id,
        len(document_ids),
        cancelled_jobs,
    )

    return {
        "status": "purged",
        "collection_id": str(collection_id),
        "documents": len(document_ids),
        "cancelled_jobs": cancelled_jobs,
    }


async def find_pending_cleanup(
    session_factory: SessionFactory,
    *,
    min_age_s: int,
    limit: int,
    archive_retention_s: int = 0,
) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    """Знайти collection/document, для яких cleanup не завершено.

    Колекції в архіві (без purge_requested_at) пропускаються; після retention
    вони автоматично позначаються на purge.

    Документи deleted collection не повертаються окремо,
    оскільки їх очищає purge_collection().
    """

    older_than = utcnow() - timedelta(seconds=min_age_s)

    async with session_factory() as db:
        collection_repo = CollectionRepository(db)

        # Архів, що перевищив retention, переходить у «purge requested».
        if archive_retention_s > 0:
            expired = await collection_repo.mark_expired_for_purge(
                archived_before=utcnow() - timedelta(seconds=archive_retention_s),
            )
            if expired:
                await db.commit()
                logger.info("archive retention: %s collection(s) queued for purge", expired)

        collections = await collection_repo.list_deleted(
            older_than=older_than,
            limit=limit,
        )

        pending_docs = (
            await DocumentRepository(db).list_pending_cleanup(
                older_than=older_than,
                limit=limit,
            )
        )

    deleted_collections = set(collections)

    document_ids = [
        document_id
        for document_id, collection_id in pending_docs
        if collection_id not in deleted_collections
    ]

    return list(deleted_collections), document_ids
