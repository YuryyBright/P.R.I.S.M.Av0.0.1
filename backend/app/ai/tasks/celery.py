from __future__ import annotations
import asyncio, uuid
from datetime import timedelta
from celery import shared_task
from app.celery_app import celery_app
from app.core.config import settings
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.pool import NullPool
from app.ai.container import build_ai_container
from app.ai.tasks.repository import TaskRepository
from app.ai.tasks.domain import TaskStatus
from app.models.rag.rag_base import utcnow

TASK_QUEUE="ai_tasks"
_worker_factory=None

def configure_worker(factory):
    """Set the PRISMA integration factory used by Celery workers.

    factory(session_factory) -> AiContainer and must provide analysis_catalog/artifact_store
    when those task types are enabled.
    """
    global _worker_factory; _worker_factory=factory

def _session_factory():
    engine=create_async_engine(settings.ASYNC_DATABASE_URI,poolclass=NullPool)
    return async_sessionmaker(engine,expire_on_commit=False,class_=AsyncSession)

def _container(sf):
    return _worker_factory(sf) if _worker_factory is not None else build_ai_container(sf)

@celery_app.task(name="ai.task_execute",bind=True,acks_late=True,max_retries=3)
def execute_task(self,task_id:str):
    async def run():
        sf=_session_factory(); c=_container(sf)
        try: await c.task_engine.execute(uuid.UUID(task_id))
        finally: await c.aclose()
    try: asyncio.run(run())
    except Exception as exc: raise self.retry(exc=exc,countdown=30)

@celery_app.task(name="ai.task_sweep")
def sweep_tasks():
    async def run():
        sf=_session_factory(); now=utcnow(); stale_before=now-timedelta(seconds=90); undispatched_before=now-timedelta(seconds=30)
        async with sf() as db:
            repo=TaskRepository(db); stale=await repo.claim_stale(older_than=stale_before); undispatched=await repo.claim_undispatched(older_than=undispatched_before)
            for task in stale: task.status=TaskStatus.QUEUED; task.celery_task_id=None; task.error="worker_lost: resumed from checkpoint"
            await db.commit()
        from app.ai.tasks.dispatcher import CeleryTaskDispatcher
        d=CeleryTaskDispatcher(TASK_QUEUE)
        for task in [*stale,*undispatched]:
            tid=await d.dispatch(task.id)
            if tid:
                async with sf() as db: await TaskRepository(db).set_celery_task_id(task.id,tid); await db.commit()
    asyncio.run(run())
