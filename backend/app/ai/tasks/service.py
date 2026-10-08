from __future__ import annotations

import uuid
from typing import Any, Callable, Sequence

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.exceptions import ForbiddenError, InvalidInputError, NotFoundError
from app.ai.tasks.domain import TaskStatus, TaskType
from app.ai.tasks.events import TaskCancelRequested, TaskCreated, TaskFinished
from app.ai.tasks.models import AiTask
from app.ai.tasks.ports import (
    DataSourceRef,
    DataSourceResolver,
    TaskCancelStore,
    TaskEventBus,
    TaskExecutionAdapter,
)
from app.ai.tasks.repository import TaskRepository


class TaskService:
    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        *,
        bus: TaskEventBus,
        cancel_store: TaskCancelStore,
        source_resolver: DataSourceResolver | None = None,
        dispatcher: TaskExecutionAdapter | None = None,
    ) -> None:
        self._sf = session_factory
        self._bus = bus
        self._cancel = cancel_store
        self._resolver = source_resolver
        self._dispatcher = dispatcher

    async def create(
        self,
        user: Any,
        *,
        instruction: str,
        task_type: TaskType,
        title: str | None,
        config: dict[str, Any],
        sources: Sequence[DataSourceRef],
    ) -> AiTask:
        if self._resolver is not None:
            await self._resolver.resolve(user, sources)

        task = AiTask(
            user_id=user.id,
            type=task_type,
            status=TaskStatus.QUEUED,
            title=title or instruction[:255],
            instruction=instruction,
            config=config,
            sources=[
                {"type": source.type, "id": source.id, "metadata": source.metadata}
                for source in sources
            ],
            progress={
                "processed": 0,
                "total": 0,
                "percent": 0.0,
                "successful": 0,
                "failed": 0,
                "skipped": 0,
            },
        )
        async with self._sf() as db:
            TaskRepository(db).add(task)
            await db.commit()
            await db.refresh(task)

        await self._bus.publish(task.id, TaskCreated(task_id=task.id))
        if self._dispatcher is not None:
            celery_id = await self._dispatcher.dispatch(task.id)
            if celery_id:
                async with self._sf() as db:
                    await TaskRepository(db).set_celery_task_id(task.id, celery_id)
                    await db.commit()
        return await self.get(user, task.id)

    async def get(self, user: Any, task_id: uuid.UUID) -> AiTask:
        async with self._sf() as db:
            task = await TaskRepository(db).get(task_id)
        if task is None or (
            task.user_id != user.id and not getattr(user, "is_superuser", False)
        ):
            raise NotFoundError("Task not found")
        return task

    async def list(
        self, user: Any, limit: int = 50, offset: int = 0
    ) -> list[AiTask]:
        async with self._sf() as db:
            return await TaskRepository(db).list_for_user(
                user.id, limit=limit, offset=offset
            )

    async def cancel(self, user: Any, task_id: uuid.UUID) -> AiTask:
        task = await self.get(user, task_id)
        if task.user_id != user.id and not getattr(user, "is_superuser", False):
            raise ForbiddenError("Only task owner can cancel it")

        cancellable = {
            TaskStatus.QUEUED,
            TaskStatus.RUNNING,
            TaskStatus.PAUSED,
            TaskStatus.WAITING_FOR_TOOL,
            TaskStatus.WAITING_FOR_INPUT,
        }
        if task.status in cancellable:
            async with self._sf() as db:
                await TaskRepository(db).request_cancel(task_id)
                await db.commit()
            await self._cancel.request(task_id)
            await self._bus.publish(task_id, TaskCancelRequested(task_id=task_id))
            current = await self.get(user, task_id)
            if current.status == TaskStatus.CANCELLED:
                await self._bus.publish(
                    task_id,
                    TaskFinished(
                        task_id=task_id,
                        status=TaskStatus.CANCELLED,
                        type="task.cancelled",
                    ),
                )
                await self._bus.finish(task_id)
        return await self.get(user, task_id)

    async def resume(self, user: Any, task_id: uuid.UUID) -> AiTask:
        task = await self.get(user, task_id)
        resumable = {TaskStatus.CANCELLED, TaskStatus.FAILED, TaskStatus.PAUSED}
        if task.status not in resumable:
            raise InvalidInputError("Only cancelled, failed or paused tasks can be resumed")

        async with self._sf() as db:
            await TaskRepository(db).set_state(
                task_id,
                status=TaskStatus.QUEUED,
                cancellation_requested=False,
                error=None,
                finished_at=None,
            )
            await db.commit()
        await self._cancel.clear(task_id)
        if self._dispatcher is not None:
            celery_id = await self._dispatcher.dispatch(task_id)
            if celery_id:
                async with self._sf() as db:
                    await TaskRepository(db).set_celery_task_id(task_id, celery_id)
                    await db.commit()
        return await self.get(user, task_id)
