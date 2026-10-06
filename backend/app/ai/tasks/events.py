from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Literal, Annotated, Union
from uuid import UUID
from pydantic import BaseModel, Field
from .domain import ItemStatus, StageKind, TaskStatus

def _now() -> datetime:
    return datetime.now(timezone.utc)

class TaskEvent(BaseModel):
    task_id: UUID
    seq: int = 0
    ts: datetime = Field(default_factory=_now)

class TaskCreated(TaskEvent):
    type: Literal["task.created"] = "task.created"

class TaskStarted(TaskEvent):
    type: Literal["task.started"] = "task.started"

class TaskStageStarted(TaskEvent):
    type: Literal["task.stage.started"] = "task.stage.started"
    stage: StageKind
    stage_index: int
    total_stages: int

class TaskProgress(TaskEvent):
    type: Literal["task.progress"] = "task.progress"
    stage: StageKind | None = None
    processed: int = 0
    total: int = 0
    percent: float = 0.0
    successful: int = 0
    failed: int = 0
    skipped: int = 0
    current_operation: str | None = None

class TaskItemFailed(TaskEvent):
    type: Literal["task.item.failed"] = "task.item.failed"
    item_key: str
    error: str
    attempt: int

class TaskCheckpointSaved(TaskEvent):
    type: Literal["task.checkpoint.saved"] = "task.checkpoint.saved"
    processed: int

class TaskStageCompleted(TaskEvent):
    type: Literal["task.stage.completed"] = "task.stage.completed"
    stage: StageKind
    stage_index: int
    total_stages: int

class TaskArtifactCreated(TaskEvent):
    type: Literal["task.artifact.created"] = "task.artifact.created"
    artifact_id: UUID
    name: str

class TaskCancelRequested(TaskEvent):
    type: Literal["task.cancel.requested"] = "task.cancel.requested"

class TaskFinished(TaskEvent):
    type: Literal["task.completed", "task.failed", "task.cancelled"] = "task.completed"
    status: TaskStatus
    error_code: str | None = None
    error_message: str | None = None

EVENT_TYPES = (TaskCreated, TaskStarted, TaskStageStarted, TaskProgress, TaskItemFailed,
               TaskCheckpointSaved, TaskStageCompleted, TaskArtifactCreated, TaskCancelRequested,
               TaskFinished)
TaskEventUnion = Annotated[Union[TaskCreated, TaskStarted, TaskStageStarted, TaskProgress, TaskItemFailed,
                                 TaskCheckpointSaved, TaskStageCompleted, TaskArtifactCreated,
                                 TaskCancelRequested, TaskFinished], Field(discriminator="type")]

def event_from_json(data: str | bytes) -> TaskEvent:
    from pydantic import TypeAdapter
    return TypeAdapter(TaskEventUnion).validate_json(data)
