"""CeleryLauncher: агент виконується у воркері (черга ai_agent), а не в API-процесі.

Dispatch ПІСЛЯ commit. Якщо брокер недоступний — run лишається QUEUED без celery_task_id,
його підхопить sweeper (claim_undispatched) — як в ingestion.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.repositories.run_repo import RunRepository

logger = logging.getLogger(__name__)


def dispatch_run(run_id: uuid.UUID) -> str | None:
    """Sync-виклик брокера (з async-коду — через to_thread)."""
    from app.celery_app import celery_app
    from app.ai.agent.tasks import AI_AGENT_QUEUE, RUN_AGENT_TASK   # єдине джерело назв

    return celery_app.send_task(RUN_AGENT_TASK, args=[str(run_id)], queue=AI_AGENT_QUEUE).id


class CeleryLauncher:
    def __init__(self, session_factory: Callable[[], AsyncSession]) -> None:
        self._sf = session_factory

    async def dispatch(self, run_id: uuid.UUID) -> None:
        try:
            task_id = await asyncio.to_thread(dispatch_run, run_id)
        except Exception:
            logger.exception("agent dispatch failed run=%s (sweeper will redispatch)", run_id)
            return
        async with self._sf() as db:
            await RunRepository(db).set_celery_task_id(run_id, task_id)
            await db.commit()
