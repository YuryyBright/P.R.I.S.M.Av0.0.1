"""Celery-задачі очищення: purge документа / колекції + періодичний sweep.

Уся логіка — в app.rag.ingestion.cleanup (БД + vector store + blob storage, без Celery).
Тут лише обгортка: retry/backoff, контейнер (store + blobs) усередині event loop задачі,
розклад для beat.

Імпорти з tasks.py — ЛІНИВІ (всередині функцій): app.celery_app імпортує цей модуль
раніше за tasks, тож модульний `from ...tasks import _get_session_factory` ламається
(ImportError на частково ініціалізованому модулі), коли tasks завантажено першим.
"""
import asyncio
import logging
import uuid
from typing import Any, Awaitable, Callable

from celery.exceptions import SoftTimeLimitExceeded

from app.celery_app import celery_app
from app.rag.container import build_container
from app.rag.cleanup import find_pending_cleanup, purge_collection, purge_document
from app.rag.settings import get_rag_settings

logger = logging.getLogger(__name__)

_cfg = get_rag_settings().ingestion
QUEUE = _cfg.queue
MAX_RETRIES = _cfg.task_max_retries
BACKOFF_S = _cfg.retry_backoff_s
SWEEP_LIMIT = 100

# Імена використовує app.rag.services.dispatch
PURGE_DOCUMENT_TASK = "rag.purge_document"
PURGE_COLLECTION_TASK = "rag.purge_collection"
SWEEP_CLEANUP_TASK = "rag.sweep_pending_cleanup"


# ---- async-обгортки: контейнер створюється й закривається в межах одного loop -------

async def _purge_document(document_id: uuid.UUID) -> dict[str, Any]:
    from app.rag.ingestion.tasks import _get_session_factory

    container = build_container()
    try:
        return await purge_document(
            _get_session_factory(), document_id,
            store=container.vector_store, storage=container.blobs)
    finally:
        await container.aclose()


async def _purge_collection(collection_id: uuid.UUID) -> dict[str, Any]:
    from app.rag.ingestion.tasks import _get_session_factory

    container = build_container()
    try:
        return await purge_collection(
            _get_session_factory(), collection_id,
            store=container.vector_store, storage=container.blobs)
    finally:
        await container.aclose()


async def _find_pending(limit: int) -> tuple[list[uuid.UUID], list[uuid.UUID]]:
    from app.rag.ingestion.tasks import _get_session_factory

    return await find_pending_cleanup(
        _get_session_factory(), min_age_s=_cfg.cleanup_min_age_s, limit=limit)


# ---- спільна обгортка: timeout / retry з backoff -----------------------------------

def _execute(task, label: str, key: str,
             run: Callable[[uuid.UUID], Awaitable[dict[str, Any]]],
             arg: uuid.UUID) -> dict[str, Any]:
    """purge ідемпотентний, тому будь-який збій безпечно повторити. Після вичерпання
    retry ресурс лишається в soft-delete без маркера cleanup — його підбере sweep."""
    try:
        return asyncio.run(run(arg))
    except SoftTimeLimitExceeded:
        logger.warning("%s timed out %s=%s; sweep will redispatch", label, key, arg)
        return {"status": "timeout", key: str(arg)}
    except Exception as exc:
        attempt = task.request.retries
        if attempt < task.max_retries:
            logger.warning("%s retry %s/%s %s=%s: %r",
                           label, attempt + 1, task.max_retries, key, arg, exc)
            raise task.retry(exc=exc, countdown=min(BACKOFF_S * 2 ** attempt, 600))
        logger.exception("%s failed permanently %s=%s (sweep will retry)", label, key, arg)
        return {"status": "failed", "error_code": f"{label}_unexpected_error", key: str(arg)}


# ---- задачі -------------------------------------------------------------------------

@celery_app.task(
    bind=True, name=PURGE_DOCUMENT_TASK, queue=QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=300, time_limit=360,
)
def purge_document_task(self, document_id: str) -> dict:
    """Вектори → blob-и → чанки → маркер meta["cleanup"] для видаленого документа."""
    return _execute(self, "purge_document", "document_id",
                    _purge_document, uuid.UUID(document_id))


@celery_app.task(
    bind=True, name=PURGE_COLLECTION_TASK, queue=QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=1500, time_limit=1560,
)
def purge_collection_task(self, collection_id: str) -> dict:
    """Усі документи колекції, потім сама колекція (великі колекції — довго)."""
    return _execute(self, "purge_collection", "collection_id",
                    _purge_collection, uuid.UUID(collection_id))


@celery_app.task(name=SWEEP_CLEANUP_TASK, queue=QUEUE, soft_time_limit=120, time_limit=150)
def sweep_pending_cleanup() -> dict:
    """Страховка: ставить у чергу purge для того, що видалено, але не очищено
    (dispatch після soft-delete міг упасти)."""
    collection_ids, document_ids = asyncio.run(_find_pending(SWEEP_LIMIT))
    sent = 0
    for name, ids in ((PURGE_COLLECTION_TASK, collection_ids),
                      (PURGE_DOCUMENT_TASK, document_ids)):
        for item in ids:
            try:
                celery_app.send_task(name, args=[str(item)], queue=QUEUE)
                sent += 1
            except Exception:
                logger.exception("sweep: cannot enqueue %s id=%s", name, item)
    if sent:
        logger.info("cleanup sweep: collections=%s documents=%s dispatched=%s",
                    len(collection_ids), len(document_ids), sent)
    return {"collections": len(collection_ids), "documents": len(document_ids),
            "dispatched": sent}


RAG_CLEANUP_BEAT_SCHEDULE = {
    "rag-sweep-pending-cleanup": {
        "task": SWEEP_CLEANUP_TASK,
        "schedule": float(_cfg.cleanup_sweep_interval_s),
        "options": {"queue": QUEUE},
    },
}
# merge, а не заміна: той самий принцип, що в tasks.py і celery_beat_schedule.py
celery_app.conf.beat_schedule = {**(celery_app.conf.beat_schedule or {}), **RAG_CLEANUP_BEAT_SCHEDULE}