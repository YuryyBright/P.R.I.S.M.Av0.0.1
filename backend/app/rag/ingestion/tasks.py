"""Celery-задачі ingestion: PARSE → CHUNK → EMBED(+INDEX) → FINALIZE (+ REDISPATCH).

Підключення: додайте модуль до Celery `include`/autodiscover, а чергу
`RAG_INGESTION__QUEUE` (за замовчуванням rag_ingestion) — до списку черг worker-а
`prisma_rag_worker` (-Q default,rag_ingestion). Для redispatch потрібен запущений beat.

Черга, retry і backoff беруться з IngestionSettings (єдине джерело).
"""
import asyncio
import logging
from datetime import timedelta
import uuid
from typing import Awaitable, Callable

from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

# ПЕРЕВІРИТИ ПРИ ІНТЕГРАЦІЇ (єдині два місця, що залежать від існуючого коду):
from app.celery_app import celery_app          # ваш централізований Celery
from app.core.config import settings           # очікується settings.ASYNC_DATABASE_URI

from app.rag.ingestion.chunk_stage import fail_chunk_job, run_chunk_stage
from app.rag.ingestion.embed_stage import fail_embed_job, run_embed_stage
from app.rag.ingestion.finalize_stage import fail_finalize_job, run_finalize_stage
from app.rag.ingestion.parse_stage import fail_job, record_retry, run_parse_stage
from app.rag.settings import get_rag_settings
from app.models.rag.rag_base import utcnow

logger = logging.getLogger(__name__)

_cfg = get_rag_settings().ingestion
RAG_INGESTION_QUEUE = _cfg.queue
MAX_RETRIES = _cfg.task_max_retries
BACKOFF_S = _cfg.retry_backoff_s

PARSE_TASK = "rag.parse_document"
CHUNK_TASK = "rag.chunk_document"
EMBED_TASK = "rag.embed_chunks"
FINALIZE_TASK = "rag.finalize_document"
REDISPATCH_TASK = "rag.redispatch_undispatched"

_session_factory: async_sessionmaker | None = None


def _get_session_factory() -> async_sessionmaker:
    """NullPool: кожен asyncio.run() має власний event loop, а з'єднання з
    пулу не можна переносити між loop-ами."""
    global _session_factory
    if _session_factory is None:
        engine = create_async_engine(str(settings.ASYNC_DATABASE_URI), poolclass=NullPool)
        _session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return _session_factory


def _run_stage(
    task,
    job_id: str,
    *,
    label: str,
    run: Callable[..., Awaitable[dict]],
    fail: Callable[..., Awaitable[None]],
    ok_status: str,
    next_task: str | None,
    dispatch_next: bool,
) -> dict:
    """Спільна обгортка етапу: timeout → failed; тимчасові помилки → retry
    з backoff; після вичерпання retry → failed; успіх → наступна задача
    (збій її постановки теж ретраїться, а не лишає job у PROCESSING)."""
    jid = uuid.UUID(job_id)
    factory = _get_session_factory()
    try:
        result = asyncio.run(run(factory, jid))
    except SoftTimeLimitExceeded:
        asyncio.run(fail(factory, jid, "timeout", f"Stage {label} exceeded the time limit"))
        return {"status": "failed", "error_code": "timeout", "job_id": job_id}
    except Exception as exc:                       # тимчасові: I/O, БД, мережа
        attempt = task.request.retries
        if attempt < task.max_retries:
            logger.warning("%s retry %s/%s job=%s: %r",
                           label, attempt + 1, task.max_retries, job_id, exc)
            asyncio.run(record_retry(factory, jid, attempt + 1))
            raise task.retry(exc=exc, countdown=min(BACKOFF_S * 2 ** attempt, 600))
        logger.exception("%s failed permanently job=%s", label, job_id)
        code = f"{label}_unexpected_error"
        asyncio.run(fail(factory, jid, code, f"{type(exc).__name__}: {exc}"))
        return {"status": "failed", "error_code": code, "job_id": job_id}

    if result["status"] == ok_status and dispatch_next and next_task:
        try:
            celery_app.send_task(next_task, args=[job_id], queue=RAG_INGESTION_QUEUE)
        except Exception as exc:                   # брокер недоступний
            attempt = task.request.retries
            if attempt < task.max_retries:
                logger.warning("%s: enqueue %s failed (%r), retrying stage job=%s",
                               label, next_task, exc, job_id)
                raise task.retry(exc=exc, countdown=BACKOFF_S)   # етапи ідемпотентні
            asyncio.run(fail(factory, jid, "dispatch_failed", f"Cannot enqueue {next_task}: {exc}"))
            return {"status": "failed", "error_code": "dispatch_failed", "job_id": job_id}
    return result


@celery_app.task(
    bind=True, name=PARSE_TASK, queue=RAG_INGESTION_QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=600, time_limit=660,
)
def parse_document(self, job_id: str, dispatch_next: bool = True) -> dict:
    """Розібрати оригінал документа в CanonicalDocument (результат — у storage)."""
    return _run_stage(self, job_id, label="parse", run=run_parse_stage, fail=fail_job,
                      ok_status="parsed", next_task=CHUNK_TASK, dispatch_next=dispatch_next)


@celery_app.task(
    bind=True, name=CHUNK_TASK, queue=RAG_INGESTION_QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=300, time_limit=360,
)
def chunk_document(self, job_id: str, dispatch_next: bool = True) -> dict:
    """Нарізати CanonicalDocument на чанки й записати їх у document_chunks."""
    return _run_stage(self, job_id, label="chunk", run=run_chunk_stage, fail=fail_chunk_job,
                      ok_status="chunked", next_task=EMBED_TASK, dispatch_next=dispatch_next)


@celery_app.task(
    bind=True, name=EMBED_TASK, queue=RAG_INGESTION_QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=900, time_limit=960,
)
def embed_chunks(self, job_id: str, dispatch_next: bool = True) -> dict:
    """Порахувати embeddings чанків і записати їх у vector store."""
    return _run_stage(self, job_id, label="embed", run=run_embed_stage, fail=fail_embed_job,
                      ok_status="embedded", next_task=FINALIZE_TASK, dispatch_next=dispatch_next)


@celery_app.task(
    bind=True, name=FINALIZE_TASK, queue=RAG_INGESTION_QUEUE, acks_late=True,
    max_retries=MAX_RETRIES, soft_time_limit=60, time_limit=90,
)
def finalize_document(self, job_id: str, dispatch_next: bool = True) -> dict:
    """Job → COMPLETED, Document → READY."""
    return _run_stage(self, job_id, label="finalize", run=run_finalize_stage,
                      fail=fail_finalize_job, ok_status="finalized",
                      next_task=None, dispatch_next=dispatch_next)


# ---- перепостановка job-ів, чий dispatch впав ---------------------------------

async def _redispatch(factory: async_sessionmaker, limit: int = 100) -> int:
    from app.rag.repositories import IngestionJobRepository
    from app.rag.services.dispatch import dispatch_parse

    async with factory() as db:
        older_than = utcnow() - timedelta(seconds=_cfg.redispatch_min_age_s)
        jobs = await IngestionJobRepository(db).claim_undispatched(
            older_than=older_than, limit=limit)
        sent = 0
        for job in jobs:
            try:
                job.celery_task_id = dispatch_parse(job.id)
                sent += 1
            except Exception:
                logger.exception("redispatch failed job=%s", job.id)
        await db.commit()
        return sent


@celery_app.task(name=REDISPATCH_TASK, queue=RAG_INGESTION_QUEUE)
def redispatch_undispatched() -> int:
    """Періодично ставить у чергу job-и QUEUED без celery_task_id."""
    return asyncio.run(_redispatch(_get_session_factory()))


RAG_BEAT_SCHEDULE = {
    "rag-redispatch-undispatched": {
        "task": REDISPATCH_TASK,
        "schedule": float(_cfg.redispatch_interval_s),
        "options": {"queue": RAG_INGESTION_QUEUE},
    },
}
# Для in-config beat (PersistentScheduler). Якщо у вас DB-планувальник — додайте запис через нього.
celery_app.conf.beat_schedule = {**(celery_app.conf.beat_schedule or {}), **RAG_BEAT_SCHEDULE}