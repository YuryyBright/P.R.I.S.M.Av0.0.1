"""Celery-задачі AI: виконання агента + sweeper.

Підключення (як для rag): додайте `app.ai.agent.tasks` в include/autodiscover celery_app.py
за тим самим `if enabled`, що й rag; чергу `ai_agent` — у список черг воркера
(`-Q default,rag_ingestion,ai_agent`) і в celery_config. Для sweeper потрібен запущений beat.

ВАЖЛИВО:
  * acks_late=False і max_retries=0: tool-виклики НЕ ідемпотентні, повторювати run не можна.
    Захист від дубля — атомарний claim QUEUED→RUNNING у RunRepository.claim_for_start.
  * Загублений воркер: heartbeat протухає → sweeper ставить failed(worker_lost) і публікує
    run.finished у bus, щоб UI не висів.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import timedelta
from typing import Any

from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel.ext.asyncio.session import AsyncSession

from app.celery_app import celery_app
from app.core.config import settings           # очікується settings.ASYNC_DATABASE_URI

from app.ai.domain.enums import RunMode
from app.ai.domain.events import RunFinished
from app.ai.domain.enums import RunStatus
from app.ai.repositories.run_repo import RunRepository
from app.ai.settings import get_ai_settings
from app.models.rag.rag_base import utcnow

logger = logging.getLogger(__name__)

_cfg = get_ai_settings().agent
AI_AGENT_QUEUE = _cfg.queue
RUN_AGENT_TASK = "ai.run_agent"
SWEEP_TASK = "ai.sweep_stale_runs"

_session_factory: async_sessionmaker | None = None


def _get_session_factory() -> async_sessionmaker:
    """NullPool: кожен asyncio.run() має власний event loop (як у rag.ingestion.tasks)."""
    global _session_factory
    if _session_factory is None:
        engine = create_async_engine(str(settings.ASYNC_DATABASE_URI), poolclass=NullPool)
        _session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return _session_factory


async def _execute(run_id: uuid.UUID) -> None:
    from app.ai.container import build_ai_container    # lazy: цикл імпортів container ↔ tasks

    container = build_ai_container(_get_session_factory())     # свіжий (клієнти прив'язані до loop)
    try:
        await container.runner.execute(run_id)
    finally:
        await container.aclose()


async def _fail_timeout(run_id: uuid.UUID) -> None:
    from app.ai.container import build_ai_container

    container = build_ai_container(_get_session_factory())
    try:
        async with _get_session_factory()() as db:
            await RunRepository(db).finish(run_id, RunStatus.FAILED, assistant_message_id=None, usage={},
                                           error_code="timeout", error_message="Run exceeded the time limit")
            await db.commit()
        await container.bus.publish(run_id, RunFinished(
            run_id=run_id, status=RunStatus.FAILED, error_code="timeout",
            error_message="Run exceeded the time limit"))
        await container.bus.finish(run_id)
    finally:
        await container.aclose()


@celery_app.task(
    bind=True, name=RUN_AGENT_TASK, queue=AI_AGENT_QUEUE, acks_late=False, max_retries=0,
    soft_time_limit=_cfg.wall_clock_s + _cfg.soft_time_limit_grace_s,
    time_limit=(
        _cfg.wall_clock_s
        + _cfg.soft_time_limit_grace_s
        + _cfg.hard_time_limit_grace_s
    ),
)
def run_agent(self: Any, run_id: str) -> dict[str, str]:
    rid = uuid.UUID(run_id)
    try:
        asyncio.run(_execute(rid))
    except SoftTimeLimitExceeded:
        asyncio.run(_fail_timeout(rid))
        return {"status": "failed", "error_code": "timeout", "run_id": run_id}
    return {"status": "done", "run_id": run_id}


# ---- sweeper -------------------------------------------------------------------------

async def _sweep(factory: async_sessionmaker, limit: int = 100) -> dict[str, int]:
    from app.ai.agent.launcher import dispatch_run
    from app.ai.container import build_ai_container

    lost: list[tuple[uuid.UUID, str, str]] = []
    redispatched = 0
    async with factory() as db:
        repo = RunRepository(db)
        for run in await repo.claim_stale_running(
                older_than=utcnow() - timedelta(seconds=_cfg.stale_after_s), limit=limit):
            repo.mark_failed_in_place(run, "worker_lost", "Run executor stopped responding")
            lost.append((run.id, "worker_lost", "Run executor stopped responding"))
        for run in await repo.claim_undispatched(
                older_than=utcnow() - timedelta(seconds=_cfg.undispatched_after_s), limit=limit):
            if run.mode == RunMode.AGENT:
                try:
                    run.celery_task_id = dispatch_run(run.id)
                    redispatched += 1
                except Exception:
                    logger.exception("redispatch failed run=%s", run.id)
            else:       # chat виконується inline: QUEUED без запуску = dispatch загублено
                repo.mark_failed_in_place(run, "dispatch_lost", "Run was never started")
                lost.append((run.id, "dispatch_lost", "Run was never started"))
        await db.commit()

    if lost:
        container = build_ai_container(factory)
        try:
            for rid, code, msg in lost:
                try:
                    await container.bus.publish(rid, RunFinished(
                        run_id=rid, status=RunStatus.FAILED, error_code=code, error_message=msg))
                    await container.bus.finish(rid)
                except Exception:
                    logger.warning("sweeper: bus publish failed run=%s", rid, exc_info=True)
        finally:
            await container.aclose()
    return {"failed": len(lost), "redispatched": redispatched}


@celery_app.task(name=SWEEP_TASK, queue=AI_AGENT_QUEUE)
def sweep_stale_runs() -> dict[str, int]:
    return asyncio.run(_sweep(_get_session_factory()))


AI_BEAT_SCHEDULE = {
    "ai-sweep-stale-runs": {
        "task": SWEEP_TASK,
        "schedule": float(_cfg.sweep_interval_s),
        "options": {"queue": AI_AGENT_QUEUE},
    },
}
celery_app.conf.beat_schedule = {**(celery_app.conf.beat_schedule or {}), **AI_BEAT_SCHEDULE}
