from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ai.tasks.domain import TaskStatus, TaskType
from app.ai.tasks.ports import DataSourceType


class TaskSourceIn(BaseModel):
    type: DataSourceType
    id: str = Field(min_length=1, max_length=512)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id")
    @classmethod
    def validate_uuid(cls, value: str) -> str:
        return str(UUID(value))


class TaskOutputConfig(BaseModel):
    formats: list[str] = Field(default_factory=lambda: ["markdown"])


class CreateTaskRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=32_000)
    type: TaskType = TaskType.ANALYSIS
    title: str | None = Field(default=None, max_length=255)
    sources: list[TaskSourceIn] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)
    output: TaskOutputConfig = Field(default_factory=TaskOutputConfig)


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    type: TaskType
    status: TaskStatus
    title: str
    instruction: str
    config: dict[str, Any]
    sources: list[TaskSourceIn]
    progress: dict[str, Any]
    current_stage: str | None
    stage_index: int
    total_stages: int
    checkpoint: dict[str, Any]
    celery_task_id: str | None
    result_artifact_id: UUID | None
    error: str | None
    started_at: datetime | None
    finished_at: datetime | None
    heartbeat_at: datetime | None
    cancellation_requested: bool
    created_at: datetime


class TaskCreateResponse(BaseModel):
    task_id: UUID
    status: TaskStatus
