"""Відправка задач у Celery (sync-виклик брокера; з async-коду — через to_thread)."""
import uuid


def dispatch_parse(job_id: uuid.UUID) -> str | None:
    """Ставить rag.parse_document у чергу; повертає celery task id."""
    from app.celery_app import celery_app
    from app.rag.ingestion.tasks import PARSE_TASK, RAG_INGESTION_QUEUE   # єдине джерело назв

    result = celery_app.send_task(PARSE_TASK, args=[str(job_id)], queue=RAG_INGESTION_QUEUE)
    return result.id


def dispatch_purge_document(document_id: uuid.UUID) -> str | None:
    """Ставить rag.purge_document (вектори + чанки + blob-и видаленого документа)."""
    from app.celery_app import celery_app
    from app.rag.ingestion.cleanup_tasks import PURGE_DOCUMENT_TASK
    from app.rag.ingestion.tasks import RAG_INGESTION_QUEUE

    result = celery_app.send_task(PURGE_DOCUMENT_TASK, args=[str(document_id)],
                                  queue=RAG_INGESTION_QUEUE)
    return result.id


def dispatch_purge_collection(collection_id: uuid.UUID) -> str | None:
    """Ставить rag.purge_collection (усі документи колекції, потім сама колекція)."""
    from app.celery_app import celery_app
    from app.rag.ingestion.cleanup_tasks import PURGE_COLLECTION_TASK
    from app.rag.ingestion.tasks import RAG_INGESTION_QUEUE

    result = celery_app.send_task(PURGE_COLLECTION_TASK, args=[str(collection_id)],
                                  queue=RAG_INGESTION_QUEUE)
    return result.id