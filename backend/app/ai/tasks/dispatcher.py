from __future__ import annotations
import asyncio, uuid
class CeleryTaskDispatcher:
    def __init__(self, queue="ai_tasks"): self.queue=queue
    async def dispatch(self, task_id: uuid.UUID) -> str | None:
        def send():
            from app.celery_app import celery_app
            return celery_app.send_task("ai.task_execute",args=[str(task_id)],queue=self.queue).id
        try: return await asyncio.to_thread(send)
        except Exception: return None
