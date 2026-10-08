"""Доступ до БД для AiRun. Без commit (окрім явно зазначеного)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.enums import ACTIVE_RUN_STATUSES, RunMode, RunStatus
from app.models.ai.ai_run import AiRun
from app.models.rag.rag_base import utcnow

class RunRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, run: AiRun) -> None:
        self.db.add(run)

    async def get(self, run_id: uuid.UUID) -> AiRun | None:
        return await self.db.get(AiRun, run_id)

    async def active_for_conversation(self, conversation_id: uuid.UUID) -> AiRun | None:
        return (await self.db.exec(
            select(AiRun).where(AiRun.conversation_id == conversation_id,
                                AiRun.status.in_(ACTIVE_RUN_STATUSES))
            .order_by(AiRun.created_at.desc()))).first()

    async def list_for_conversation(self, conversation_id: uuid.UUID, *, limit: int = 50) -> list[AiRun]:
        rows = await self.db.exec(select(AiRun).where(AiRun.conversation_id == conversation_id)
                                  .order_by(AiRun.created_at.desc()).limit(limit))
        return list(rows.all())

    # ---- state transitions -------------------------------------------------------

    async def claim_for_start(self, run_id: uuid.UUID) -> bool:
        """Атомарно QUEUED → RUNNING. Захищає від повторного запуску (дубль Celery-задачі,
        redispatch, гонка двох воркерів): виконає лише той, хто виграв UPDATE."""
        now = utcnow()
        res = await self.db.exec(update(AiRun).where(
            AiRun.id == run_id, AiRun.status == RunStatus.QUEUED
        ).values(status=RunStatus.RUNNING, started_at=now, heartbeat_at=now))
        return (getattr(res, "rowcount", 0) or 0) == 1

    async def touch_heartbeat(self, run_id: uuid.UUID) -> None:
        await self.db.exec(update(AiRun).where(
            AiRun.id == run_id, AiRun.status == RunStatus.RUNNING).values(heartbeat_at=utcnow()))

    async def set_celery_task_id(self, run_id: uuid.UUID, task_id: str | None) -> None:
        await self.db.exec(update(AiRun).where(AiRun.id == run_id).values(celery_task_id=task_id))

    async def finish(self, run_id: uuid.UUID, status: RunStatus, *, assistant_message_id: uuid.UUID | None,
                     usage: dict[str, int], error_code: str | None, error_message: str | None) -> bool:
        """→ термінальний статус; не перезаписує вже термінальний (напр. від sweeper-а)."""
        res = await self.db.exec(update(AiRun).where(
            AiRun.id == run_id, AiRun.status.in_(ACTIVE_RUN_STATUSES)
        ).values(status=status, finished_at=utcnow(), assistant_message_id=assistant_message_id,
                 usage=usage, error_code=error_code, error_message=(error_message or "")[:2000] or None))
        return (getattr(res, "rowcount", 0) or 0) == 1

    # ---- sweeper -----------------------------------------------------------------

    async def claim_stale_running(self, *, older_than: datetime, limit: int) -> list[AiRun]:
        rows = await self.db.exec(select(AiRun).where(
            AiRun.status == RunStatus.RUNNING,
            AiRun.heartbeat_at.is_not(None), AiRun.heartbeat_at < older_than,
        ).order_by(AiRun.heartbeat_at).limit(limit).with_for_update(skip_locked=True))
        return list(rows.all())

    async def claim_undispatched(self, *, older_than: datetime, limit: int,
                                 mode: RunMode | None = None) -> list[AiRun]:
        stmt = select(AiRun).where(
            AiRun.status == RunStatus.QUEUED, AiRun.celery_task_id.is_(None),
            AiRun.created_at <= older_than)
        if mode is not None:
            stmt = stmt.where(AiRun.mode == mode)
        rows = await self.db.exec(stmt.order_by(AiRun.created_at).limit(limit).with_for_update(skip_locked=True))
        return list(rows.all())

    def mark_failed_in_place(self, run: AiRun, code: str, message: str) -> None:
        """Для sweeper-а (рядок уже заблоковано FOR UPDATE)."""
        run.status, run.finished_at = RunStatus.FAILED, utcnow()
        run.error_code, run.error_message = code[:64], message[:2000]

    @staticmethod
    def usage_dict(prompt: int, completion: int) -> dict[str, Any]:
        return {"prompt_tokens": prompt, "completion_tokens": completion}
