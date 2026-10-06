from __future__ import annotations

import json
import time
import uuid

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import StreamingResponse

from app.ai.container import AiContainer
from app.ai.task_api import CreateTaskRequest, TaskCreateResponse, TaskOut
from app.ai.tasks.artifact_repo import ArtifactRepository
from app.ai.tasks.domain import TERMINAL_TASK_STATUSES
from app.ai.tasks.ports import DataSourceRef
from app.api.deps import (
    PERM_AI_TASKS_CREATE, PERM_AI_TASKS_MANAGE, PERM_AI_TASKS_READ,
    get_current_user,
)
from app.models.users.user_model import User

from .._deps import container

router = APIRouter(tags=["ai: tasks"])

_task_read = get_current_user([PERM_AI_TASKS_READ])
_task_create = get_current_user([PERM_AI_TASKS_CREATE])
_task_manage = get_current_user([PERM_AI_TASKS_MANAGE])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",          # Nginx: не буферизувати SSE
}


def sse(event_id: str | None, event: str, data: str) -> str:
    head = f"id: {event_id}\n" if event_id else ""
    return f"{head}event: {event}\ndata: {data}\n\n"


@router.post("/tasks", response_model=TaskCreateResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_task(body: CreateTaskRequest, user: User = Depends(_task_create),
                      c: AiContainer = Depends(container)):
    t = await c.task_service.create(
        user,
        instruction=body.instruction,
        task_type=body.type,
        title=body.title,
        config={**body.config, "output": body.output.model_dump()},
        sources=[DataSourceRef(type=x.type, id=x.id, metadata=x.metadata) for x in body.sources],
    )
    return TaskCreateResponse(task_id=t.id, status=t.status)


@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0),
                     user: User = Depends(_task_read), c: AiContainer = Depends(container)):
    return await c.task_service.list(user, limit, offset)


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, user: User = Depends(_task_read),
                   c: AiContainer = Depends(container)):
    return await c.task_service.get(user, task_id)


@router.post("/tasks/{task_id}/cancel", response_model=TaskOut, status_code=status.HTTP_202_ACCEPTED)
async def cancel_task(task_id: uuid.UUID, user: User = Depends(_task_manage),
                      c: AiContainer = Depends(container)):
    return await c.task_service.cancel(user, task_id)


@router.post("/tasks/{task_id}/resume", response_model=TaskOut, status_code=status.HTTP_202_ACCEPTED)
async def resume_task(task_id: uuid.UUID, user: User = Depends(_task_manage),
                      c: AiContainer = Depends(container)):
    return await c.task_service.resume(user, task_id)


@router.get("/tasks/{task_id}/artifacts")
async def list_artifacts(task_id: uuid.UUID, user: User = Depends(_task_read),
                         c: AiContainer = Depends(container)):
    await c.task_service.get(user, task_id)  # перевірка доступу до задачі
    async with c.session_factory() as db:
        return await ArtifactRepository(db).list_for_task(task_id)


@router.get("/tasks/{task_id}/events")
async def task_events(
    task_id: uuid.UUID,
    last_id: str | None = Query(None),
    last_event_id: str | None = Header(None, alias="Last-Event-ID"),
    user: User = Depends(_task_read),
    c: AiContainer = Depends(container),
):
    """SSE. `id:` = id запису в Redis Stream → після reconnect UI дочитує події без втрат."""
    task = await c.task_service.get(user, task_id)
    start = last_event_id or last_id

    async def stream():
        yield "retry: 2000\n\n"
        if task.status in TERMINAL_TASK_STATUSES and not await c.task_bus.exists(task_id):
            yield sse(None, "task." + task.status.value,
                      json.dumps({"task_id": str(task_id), "status": task.status.value}))
            return
        async for item in c.task_bus.subscribe(task_id, start, keepalive_s=15):
            if item is None:
                yield f": keepalive {int(time.time())}\n\n"
                continue
            sid, ev = item
            yield sse(sid, ev.type, ev.model_dump_json())

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
