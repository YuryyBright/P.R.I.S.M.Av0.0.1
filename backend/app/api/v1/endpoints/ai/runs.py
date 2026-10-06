import time
import uuid

from fastapi import APIRouter, Depends, Header, Query, status
from fastapi.responses import StreamingResponse

from app.ai.container import AiContainer
from app.ai.domain.enums import TERMINAL_RUN_STATUSES
from app.ai.domain.events import RunFinished
from app.ai.schemas import RunOut, StartRunRequest, StartRunResponse, StepOut
from app.api.deps import (
    PERM_AI_RUNS_CREATE, PERM_AI_RUNS_MANAGE, PERM_AI_RUNS_READ,
    get_current_user,
)
from app.models.users.user_model import User

from ._deps import container

router = APIRouter(tags=["ai: runs"])

_run_read = get_current_user([PERM_AI_RUNS_READ])
_run_create = get_current_user([PERM_AI_RUNS_CREATE])
_run_manage = get_current_user([PERM_AI_RUNS_MANAGE])

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",          # Nginx: не буферизувати SSE
}


def sse(event_id: str | None, event: str, data: str) -> str:
    head = f"id: {event_id}\n" if event_id else ""
    return f"{head}event: {event}\ndata: {data}\n\n"


@router.post("/conversations/{conversation_id}/runs", response_model=StartRunResponse,
             status_code=status.HTTP_202_ACCEPTED)
async def start_run(conversation_id: uuid.UUID, body: StartRunRequest,
                    user: User = Depends(_run_create), c: AiContainer = Depends(container)):
    """Створює run (і user-повідомлення) та запускає його. Далі UI підключається до /events."""
    return await c.run_service.start_run(user, conversation_id, body)


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: uuid.UUID, user: User = Depends(_run_read), c: AiContainer = Depends(container)):
    return await c.run_service.get_run(user, run_id)


@router.get("/runs/{run_id}/steps", response_model=list[StepOut])
async def get_run_steps(run_id: uuid.UUID, user: User = Depends(_run_read),
                        c: AiContainer = Depends(container)):
    return await c.run_service.list_steps(user, run_id)


@router.post("/runs/{run_id}/cancel", response_model=RunOut, status_code=status.HTTP_202_ACCEPTED)
async def cancel_run(run_id: uuid.UUID, user: User = Depends(_run_manage), c: AiContainer = Depends(container)):
    return await c.run_service.cancel_run(user, run_id)


@router.get("/runs/{run_id}/events")
async def run_events(
    run_id: uuid.UUID,
    last_id: str | None = Query(None, description="Те саме, що Last-Event-ID (для fetch-клієнтів)"),
    last_event_id: str | None = Header(None, alias="Last-Event-ID"),
    user: User = Depends(_run_read), c: AiContainer = Depends(container),
):
    """SSE. `id:` = id запису в Redis Stream → після reconnect UI дочитує події без втрат."""
    run = await c.run_service.get_run(user, run_id)
    start = last_event_id or last_id
    bus = c.bus

    async def stream():
        # Стрім уже прострочений (TTL), а run завершено → віддаємо лише run.finished; решту — через REST.
        if run.status in TERMINAL_RUN_STATUSES and not await bus.exists(run_id):
            fin = RunFinished(run_id=run_id, status=run.status, message_id=run.assistant_message_id,
                              error_code=run.error_code, error_message=run.error_message,
                              usage=run.usage or {})
            yield sse(None, fin.type, fin.model_dump_json())
            return
        yield "retry: 2000\n\n"
        async for item in bus.subscribe(run_id, start, keepalive_s=15.0):
            if item is None:
                yield f": keepalive {int(time.time())}\n\n"
                continue
            sid, ev = item
            yield sse(sid, ev.type, ev.model_dump_json())

    return StreamingResponse(stream(), media_type="text/event-stream", headers=SSE_HEADERS)
