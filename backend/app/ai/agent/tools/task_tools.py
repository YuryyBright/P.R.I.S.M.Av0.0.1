from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.ai.agent.tools.base import BaseTool, ToolOutput
from app.ai.domain.enums import ToolRisk
from app.ai.runtime.context import RunContext
from app.ai.tasks.domain import TaskType
from app.ai.tasks.ports import DataSourceRef
from app.ai.task_api import TaskSourceIn


class CreateTaskArgs(BaseModel):
    instruction: str = Field(
        min_length=5,
        max_length=32_000,
    )
    task_type: TaskType = Field(
        default=TaskType.ANALYSIS,
    )
    title: str | None = None
    sources: list[TaskSourceIn] = Field(
        default_factory=list,
    )
    config: dict[str, object] = Field(
        default_factory=dict,
    )


class CreateTaskTool(BaseTool):
    name = "create_task"
    description = (
        "Create a persistent long-running AI task. "
        "The task continues after the chat/run ends."
    )
    args_model = CreateTaskArgs

    def __init__(self, service: Any) -> None:
        self._service = service

    @property
    def service(self) -> Any:
        return self._service() if callable(self._service) else self._service

    async def run(
        self,
        ctx: RunContext,
        args: CreateTaskArgs,
    ) -> ToolOutput:
        refs = [
            DataSourceRef(
                type=source.type,
                id=source.id,
                metadata=source.metadata,
            )
            for source in args.sources
        ]

        task = await self.service.create(
            ctx.user,
            instruction=args.instruction,
            task_type=args.task_type,
            title=args.title,
            config=args.config,
            sources=refs,
        )

        return ToolOutput(
            for_llm=f"Task created: {task.id} ({task.status.value})",
            ui_summary=f"Started task {task.id}",
        )


class TaskIdArgs(BaseModel):
    task_id: UUID


class GetTaskStatusTool(BaseTool):
    name = "get_task_status"
    description = "Get persistent status and progress of a long-running task."
    args_model = TaskIdArgs

    def __init__(self, service: Any) -> None:
        self._service = service

    @property
    def service(self) -> Any:
        return self._service() if callable(self._service) else self._service

    async def run(
        self,
        ctx: RunContext,
        args: TaskIdArgs,
    ) -> ToolOutput:
        task = await self.service.get(ctx.user, args.task_id)
        progress = task.progress or {}

        text = (
            f"{task.id}: {task.status.value}; "
            f"stage={task.current_stage}; "
            f"{progress.get('processed', 0)}/"
            f"{progress.get('total', 0)} "
            f"({progress.get('percent', 0):.1f}%)"
        )

        return ToolOutput(
            for_llm=text,
            ui_summary=text,
        )


class CancelTaskTool(BaseTool):
    name = "cancel_task"
    risk = ToolRisk.WRITE
    description = "Request graceful cancellation of a long-running task."
    args_model = TaskIdArgs

    def __init__(self, service: Any) -> None:
        self._service = service

    @property
    def service(self) -> Any:
        return self._service() if callable(self._service) else self._service

    async def run(
        self,
        ctx: RunContext,
        args: TaskIdArgs,
    ) -> ToolOutput:
        task = await self.service.cancel(ctx.user, args.task_id)

        return ToolOutput(
            for_llm=f"Cancellation requested for {task.id}",
            ui_summary=f"Stopping task {task.id}",
        )
