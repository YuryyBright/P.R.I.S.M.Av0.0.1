"""Відправка задач у Celery (sync-виклик брокера; з async-коду — через to_thread)."""
import uuid


def dispatch_parse(job_id: uuid.UUID) -> str | None:
    """Ставить rag.parse_document у чергу; повертає celery task id."""
    from app.celery_app import celery_app
    from app.rag.ingestion.tasks import PARSE_TASK, RAG_INGESTION_QUEUE   # єдине джерело назв

    result = celery_app.send_task(PARSE_TASK, args=[str(job_id)], queue=RAG_INGESTION_QUEUE)
    return result.id