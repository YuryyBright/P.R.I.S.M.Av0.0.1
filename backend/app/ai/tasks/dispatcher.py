from __future__ import annotations

import asyncio
import uuid
from typing import Any

from app.ai.settings import get_ai_settings


class CeleryTaskDispatcher:
    def __init__(self, queue: str | None = None) -> None:
        self.queue = queue or get_ai_settings().tasks.queue

    async def dispatch(self, task_id: uuid.UUID) -> str | None:
        def send() -> str:
            from app.celery_app import celery_app

            result: Any = celery_app.send_task(
                "ai.task_execute",
                args=[str(task_id)],
                queue=self.queue,
            )
            return str(result.id)

        try:
            return await asyncio.to_thread(send)
        except Exception:
            return None
