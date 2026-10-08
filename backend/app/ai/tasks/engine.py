from __future__ import annotations

import logging
import uuid
from typing import Any, Callable, Literal, cast

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.tasks.domain import StageKind, TaskStatus
from app.ai.tasks.events import (
    TaskArtifactCreated,
    TaskCheckpointSaved,
    TaskEvent,
    TaskFinished,
    TaskProgress,
    TaskStageStarted,
    TaskStarted,
)
from app.ai.tasks.ports import (
    DataSourceRef,
    DataSourceType,
    SUPPORTED_DATA_SOURCE_TYPES,
    TaskCancelStore,
    TaskContext,
    TaskEventBus,
    TaskHandler,
    TaskProgressState,
)
from app.ai.tasks.repository import TaskRepository
from app.models.rag.rag_base import utcnow
from app.models.users.user_model import User

logger = logging.getLogger(__name__)

FinishedEventType = Literal["task.completed", "task.cancelled"]


def _progress_int(data: dict[str, object], key: str) -> int:
    value = data.get(key, 0)
    return value if isinstance(value, int) else 0


def _progress_float(data: dict[str, object], key: str) -> float:
    value = data.get(key, 0.0)
    return float(value) if isinstance(value, (int, float)) else 0.0


def _data_source_ref(value: dict[str, object]) -> DataSourceRef:
    source_type = value.get("type")
    source_id = value.get("id")
    metadata = value.get("metadata", {})
    if not isinstance(source_type, str) or source_type not in SUPPORTED_DATA_SOURCE_TYPES:
        raise ValueError(f"Unsupported persisted data source type: {source_type!r}")
    return DataSourceRef(
        type=cast(DataSourceType, source_type),
        id=source_id if isinstance(source_id, str) else "",
        metadata=metadata if isinstance(metadata, dict) else {},
    )


class TaskCancelled(Exception):
    """Signal raised by a task handler when it observes cancellation."""


class TaskEngine:
    """Domain-level long-running task engine. Celery only invokes `execute()`."""

    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        *,
        bus: TaskEventBus,
        cancel_store: TaskCancelStore,
        handlers: dict[str, TaskHandler],
    ) -> None:
        self.sf = session_factory
        self.bus = bus
        self.cancel = cancel_store
        self.handlers = handlers

    async def execute(self, task_id: uuid.UUID) -> None:
        async with self.sf() as db:
            repo = TaskRepository(db)
            task = await repo.get(task_id)
            if task is None or not await repo.claim_for_start(task_id):
                return
            await db.commit()
            task = await repo.get(task_id)
            if task is None:
                return
            user = await db.get(User, task.user_id)

        if user is None:
            await self._fail(task_id, "owner_missing", "Task owner not found")
            return

        await self.bus.publish(task_id, TaskStarted(task_id=task_id))
        handler = self.handlers.get(task.type.value)
        if handler is None:
            await self._fail(
                task_id,
                "handler_missing",
                f"No handler registered for task type {task.type.value}",
            )
            return

        progress_data = task.progress
        progress = TaskProgressState(
            processed=_progress_int(progress_data, "processed"),
            total=_progress_int(progress_data, "total"),
            successful=_progress_int(progress_data, "successful"),
            failed=_progress_int(progress_data, "failed"),
            skipped=_progress_int(progress_data, "skipped"),
            percent=_progress_float(progress_data, "percent"),
            current_operation=(
                str(progress_data["current_operation"])
                if progress_data.get("current_operation") is not None
                else None
            ),
            stage=StageKind(task.current_stage) if task.current_stage else None,
        )

        async def emit(event: TaskEvent) -> None:
            await self.bus.publish(task_id, event)
            values: dict[str, Any] = {}
            if isinstance(event, TaskStageStarted):
                values = {
                    "current_stage": event.stage.value,
                    "stage_index": event.stage_index,
                    "total_stages": event.total_stages,
                }
            elif isinstance(event, TaskProgress):
                values = {
                    "progress": {
                        "stage": event.stage.value if event.stage else None,
                        "processed": event.processed,
                        "total": event.total,
                        "percent": event.percent,
                        "successful": event.successful,
                        "failed": event.failed,
                        "skipped": event.skipped,
                        "current_operation": event.current_operation,
                    }
                }
            if isinstance(event, TaskCheckpointSaved):
                values["checkpoint"] = ctx.checkpoint
            if values:
                async with self.sf() as db:
                    await TaskRepository(db).set_state(
                        task_id, **values, heartbeat_at=utcnow()
                    )
                    await db.commit()

        async def cancellation() -> bool:
            if await self.cancel.requested(task_id):
                return True
            async with self.sf() as db:
                current = await TaskRepository(db).get(task_id)
                return bool(current and current.cancellation_requested)

        async def checkpoint() -> None:
            async with self.sf() as db:
                await TaskRepository(db).set_state(
                    task_id,
                    checkpoint=ctx.checkpoint,
                    progress={
                        "stage": progress.stage.value if progress.stage else None,
                        "processed": progress.processed,
                        "total": progress.total,
                        "successful": progress.successful,
                        "failed": progress.failed,
                        "skipped": progress.skipped,
                        "percent": (
                            progress.processed / progress.total * 100
                            if progress.total
                            else 0
                        ),
                        "current_operation": progress.current_operation,
                    },
                    heartbeat_at=utcnow(),
                )
                await db.commit()
            await emit(
                TaskCheckpointSaved(task_id=task_id, processed=progress.processed)
            )

        ctx = TaskContext(
            task_id=task_id,
            user=user,
            instruction=task.instruction,
            config=task.config,
            sources=tuple(_data_source_ref(source) for source in task.sources),
            progress=progress,
            checkpoint=dict(task.checkpoint),
            cancellation_requested=cancellation,
            emit=emit,
        )

        try:
            result = await handler.execute(ctx)
            if await cancellation():
                await self._finish(task_id, TaskStatus.CANCELLED)
                return
            first_artifact = result[0] if result else None
            artifact_id = (
                uuid.UUID(str(first_artifact["id"]))
                if first_artifact and first_artifact.get("id")
                else None
            )
            await self._finish(
                task_id,
                TaskStatus.COMPLETED,
                result_artifact_id=artifact_id,
            )
            for artifact in result or []:
                try:
                    await emit(
                        TaskArtifactCreated(
                            task_id=task_id,
                            artifact_id=uuid.UUID(str(artifact["id"])),
                            name=str(artifact.get("name", "artifact")),
                        )
                    )
                except Exception:
                    pass
        except TaskCancelled:
            await self._finish(task_id, TaskStatus.CANCELLED)
        except Exception as exc:
            logger.exception("AI task failed %s", task_id)
            await self._fail(task_id, "task_failed", str(exc))
        finally:
            await self.cancel.clear(task_id)

    async def _finish(
        self,
        task_id: uuid.UUID,
        status: Literal[TaskStatus.COMPLETED, TaskStatus.CANCELLED],
        *,
        result_artifact_id: uuid.UUID | None = None,
    ) -> None:
        async with self.sf() as db:
            await TaskRepository(db).finish(
                task_id, status, result_artifact_id=result_artifact_id
            )
            await db.commit()
        event_type: FinishedEventType = (
            "task.completed"
            if status == TaskStatus.COMPLETED
            else "task.cancelled"
        )
        await self.bus.publish(
            task_id,
            TaskFinished(task_id=task_id, status=status, type=event_type),
        )
        await self.bus.finish(task_id)

    async def _fail(self, task_id: uuid.UUID, code: str, message: str) -> None:
        async with self.sf() as db:
            await TaskRepository(db).finish(
                task_id, TaskStatus.FAILED, error=message[:4000]
            )
            await db.commit()
        await self.bus.publish(
            task_id,
            TaskFinished(
                task_id=task_id,
                status=TaskStatus.FAILED,
                type="task.failed",
                error_code=code,
                error_message=message[:4000],
            ),
        )
        await self.bus.finish(task_id)
