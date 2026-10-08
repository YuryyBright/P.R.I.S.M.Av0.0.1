from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta
from typing import Any, Callable

from app.celery_app import celery_app
from app.core.config import settings
from app.ai.settings import get_ai_settings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel.ext.asyncio.session import AsyncSession
from app.ai.container import build_ai_container
from app.ai.tasks.repository import TaskRepository
from app.ai.tasks.domain import TaskStatus
from app.models.rag.rag_base import utcnow

_cfg = get_ai_settings().tasks
TASK_QUEUE = _cfg.queue
SessionFactory = Callable[[], AsyncSession]
_worker_factory: Callable[[SessionFactory], Any] | None = None


def configure_worker(factory: Callable[[SessionFactory], Any]) -> None:
    """Set the PRISMA integration factory used by Celery workers.

    factory(session_factory) -> AiContainer and must provide analysis_catalog/artifact_store
    when those task types are enabled.
    """
    global _worker_factory
    _worker_factory = factory


def _session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine(str(settings.ASYNC_DATABASE_URI), poolclass=NullPool)
    return async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def _container(sf: async_sessionmaker[AsyncSession]) -> Any:
    def session_factory() -> AsyncSession:
        return sf()

    return (
        _worker_factory(session_factory)
        if _worker_factory is not None
        else build_ai_container(session_factory)
    )


@celery_app.task(name="ai.task_execute", bind=True, acks_late=True, max_retries=_cfg.max_retries)
def execute_task(self: Any, task_id: str) -> None:
    async def run() -> None:
        sf = _session_factory()
        c = _container(sf)
        try:
            await c.task_engine.execute(uuid.UUID(task_id))
        finally:
            await c.aclose()

    try:
        asyncio.run(run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=_cfg.retry_backoff_s)


@celery_app.task(name="ai.task_sweep", queue=TASK_QUEUE)
def sweep_tasks() -> None:
    async def run() -> None:
        sf = _session_factory()
        now = utcnow()
        stale_before = now - timedelta(seconds=_cfg.stale_after_s)
        undispatched_before = now - timedelta(seconds=_cfg.undispatched_after_s)
        async with sf() as db:
            repo = TaskRepository(db)
            stale = await repo.claim_stale(older_than=stale_before)
            undispatched = await repo.claim_undispatched(older_than=undispatched_before)
            for task in stale:
                task.status = TaskStatus.QUEUED
                task.celery_task_id = None
                task.error = "worker_lost: resumed from checkpoint"
            await db.commit()
        from app.ai.tasks.dispatcher import CeleryTaskDispatcher
        dispatcher = CeleryTaskDispatcher(TASK_QUEUE)
        for task in [*stale, *undispatched]:
            tid = await dispatcher.dispatch(task.id)
            if tid:
                async with sf() as db:
                    await TaskRepository(db).set_celery_task_id(task.id, tid)
                    await db.commit()
    asyncio.run(run())


AI_TASK_BEAT_SCHEDULE = {
    "ai-sweep-tasks": {
        "task": "ai.task_sweep",
        "schedule": float(_cfg.sweep_interval_s),
        "options": {"queue": TASK_QUEUE},
    },
}
celery_app.conf.beat_schedule = {
    **(celery_app.conf.beat_schedule or {}),
    **AI_TASK_BEAT_SCHEDULE,
}
