from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.tasks.domain import ACTIVE_TASK_STATUSES, TaskStatus
from app.ai.tasks.models import AiTask
from app.models.ai.ai_task_item import AiTaskItem
from app.models.rag.rag_base import utcnow


class TaskRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def add(self, task: AiTask) -> None:
        self.db.add(task)

    async def get(self, task_id: uuid.UUID) -> AiTask | None:
        return await self.db.get(AiTask, task_id)

    async def list_for_user(
        self, user_id: uuid.UUID, *, limit: int = 50, offset: int = 0
    ) -> list[AiTask]:
        statement = (
            select(AiTask)
            .where(AiTask.user_id == user_id)
            .order_by(AiTask.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.exec(statement)
        return list(result.all())

    async def claim_for_start(self, task_id: uuid.UUID) -> bool:
        result = await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id, AiTask.status == TaskStatus.QUEUED)
            .values(
                status=TaskStatus.RUNNING,
                started_at=utcnow(),
                heartbeat_at=utcnow(),
                cancellation_requested=False,
            )
        )
        return (result.rowcount or 0) == 1

    async def touch(self, task_id: uuid.UUID) -> None:
        await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id, AiTask.status == TaskStatus.RUNNING)
            .values(heartbeat_at=utcnow())
        )

    async def set_celery_task_id(
        self, task_id: uuid.UUID, celery_task_id: str | None
    ) -> None:
        await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id)
            .values(celery_task_id=celery_task_id)
        )

    async def request_cancel(self, task_id: uuid.UUID) -> bool:
        result = await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id, AiTask.status == TaskStatus.QUEUED)
            .values(
                cancellation_requested=True,
                status=TaskStatus.CANCELLED,
                finished_at=utcnow(),
            )
        )
        if (result.rowcount or 0) == 1:
            return True

        result = await self.db.exec(
            update(AiTask)
            .where(
                AiTask.id == task_id,
                AiTask.status.in_(
                    (
                        TaskStatus.RUNNING,
                        TaskStatus.PAUSED,
                        TaskStatus.WAITING_FOR_TOOL,
                        TaskStatus.WAITING_FOR_INPUT,
                    )
                ),
            )
            .values(cancellation_requested=True, status=TaskStatus.CANCELLING)
        )
        return (result.rowcount or 0) == 1

    async def set_state(self, task_id: uuid.UUID, **values: Any) -> None:
        await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id)
            .values(**values)
        )

    async def finish(
        self,
        task_id: uuid.UUID,
        status: TaskStatus,
        *,
        error: str | None = None,
        result_artifact_id: uuid.UUID | None = None,
    ) -> bool:
        result = await self.db.exec(
            update(AiTask)
            .where(AiTask.id == task_id, AiTask.status.in_(ACTIVE_TASK_STATUSES))
            .values(
                status=status,
                finished_at=utcnow(),
                error=error,
                result_artifact_id=result_artifact_id,
            )
        )
        return (result.rowcount or 0) == 1

    async def claim_stale(
        self, *, older_than: datetime, limit: int = 20
    ) -> list[AiTask]:
        statement = (
            select(AiTask)
            .where(
                AiTask.status == TaskStatus.RUNNING,
                AiTask.heartbeat_at.is_not(None),
                AiTask.heartbeat_at < older_than,
            )
            .order_by(AiTask.heartbeat_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self.db.exec(statement)
        return list(result.all())

    async def claim_undispatched(
        self, *, older_than: datetime, limit: int = 20
    ) -> list[AiTask]:
        statement = (
            select(AiTask)
            .where(
                AiTask.status == TaskStatus.QUEUED,
                AiTask.celery_task_id.is_(None),
                AiTask.created_at <= older_than,
            )
            .order_by(AiTask.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        result = await self.db.exec(statement)
        return list(result.all())

    async def save_item(self, item: AiTaskItem) -> None:
        self.db.add(item)
