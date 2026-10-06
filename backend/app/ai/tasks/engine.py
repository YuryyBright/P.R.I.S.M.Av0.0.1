from __future__ import annotations
import logging
import uuid
from typing import Any, Callable
from app.ai.tasks.domain import TaskStatus, TaskType, StageKind
from app.ai.tasks.events import TaskStarted, TaskStageStarted, TaskStageCompleted, TaskProgress, TaskCheckpointSaved, TaskItemFailed, TaskFinished, TaskArtifactCreated
from app.ai.tasks.ports import TaskContext, TaskProgressState, TaskEventBus
from app.ai.tasks.repository import TaskRepository
from app.ai.tasks.cancel import RedisTaskCancelStore
from app.models.users.user_model import User
from sqlmodel.ext.asyncio.session import AsyncSession

logger=logging.getLogger(__name__)

class TaskCancelled(Exception): pass

class TaskEngine:
    """Domain-level long-running task engine. Celery only invokes `execute()`."""
    def __init__(self, session_factory: Callable[[], AsyncSession], *, bus: TaskEventBus,
                 cancel_store: Any, handlers: dict[str, Any]):
        self.sf,self.bus,self.cancel,self.handlers=session_factory,bus,cancel_store,handlers
    async def execute(self, task_id: uuid.UUID) -> None:
        async with self.sf() as db:
            repo=TaskRepository(db); task=await repo.get(task_id)
            if task is None or not await repo.claim_for_start(task_id): return
            await db.commit(); task=await repo.get(task_id)
            user=await db.get(User, task.user_id)
        if user is None:
            await self._fail(task_id,"owner_missing","Task owner not found"); return
        await self.bus.publish(task_id,TaskStarted(task_id=task_id))
        handler=self.handlers.get(task.type.value)
        if handler is None:
            await self._fail(task_id,"handler_missing",f"No handler registered for task type {task.type.value}"); return
        progress=TaskProgressState(**{k:task.progress.get(k,0) for k in ("processed","total","successful","failed","skipped")}, stage=StageKind(task.current_stage) if task.current_stage else None)
        async def emit(event):
            await self.bus.publish(task_id,event)
            values={}
            if getattr(event,"type",None)=="task.stage.started":
                values={"current_stage":event.stage.value,"stage_index":event.stage_index,"total_stages":event.total_stages}
            elif getattr(event,"type",None)=="task.progress":
                values={"progress":{"stage":event.stage.value if event.stage else None,"processed":event.processed,"total":event.total,"percent":event.percent,"successful":event.successful,"failed":event.failed,"skipped":event.skipped,"current_operation":event.current_operation}}
            if getattr(event,"type",None)=="task.checkpoint.saved":
                values={**values,"checkpoint":ctx.checkpoint}
            if values:
                async with self.sf() as db:
                    await TaskRepository(db).set_state(task_id,**values,heartbeat_at=__import__('app.models.rag.rag_base',fromlist=['utcnow']).utcnow())
                    await db.commit()
        async def cancellation():
            if await self.cancel.requested(task_id): return True
            async with self.sf() as db:
                current=await TaskRepository(db).get(task_id); return bool(current and current.cancellation_requested)
        async def checkpoint():
            async with self.sf() as db:
                await TaskRepository(db).set_state(task_id, checkpoint=ctx.checkpoint, progress={"stage": progress.stage.value if progress.stage else None, "processed": progress.processed, "total": progress.total, "successful": progress.successful, "failed": progress.failed, "skipped": progress.skipped, "percent": (progress.processed / progress.total * 100 if progress.total else 0), "current_operation": progress.current_operation}, heartbeat_at=__import__('app.models.rag.rag_base',fromlist=['utcnow']).utcnow())
                await db.commit()
            await emit(TaskCheckpointSaved(task_id=task_id,processed=progress.processed))
        ctx=TaskContext(task_id=task_id,user=user,instruction=task.instruction,config=task.config,sources=tuple(__import__('app.ai.tasks.ports',fromlist=['DataSourceRef']).DataSourceRef(**x) for x in task.sources),progress=progress,checkpoint=dict(task.checkpoint),cancellation_requested=cancellation,emit=emit)
        try:
            result=await handler.execute(ctx)
            if await cancellation():
                await self._finish(task_id,TaskStatus.CANCELLED)
                return
            first_artifact = (result or [None])[0]
            artifact_id = uuid.UUID(str(first_artifact["id"])) if first_artifact and first_artifact.get("id") else None
            await self._finish(task_id,TaskStatus.COMPLETED,result_artifact_id=artifact_id)
            for artifact in result or []:
                try: await emit(TaskArtifactCreated(task_id=task_id,artifact_id=uuid.UUID(str(artifact["id"])),name=str(artifact.get("name","artifact"))))
                except Exception: pass
        except TaskCancelled:
            await self._finish(task_id,TaskStatus.CANCELLED)
        except Exception as exc:
            logger.exception("AI task failed %s",task_id)
            await self._fail(task_id,"task_failed",str(exc))
        finally:
            await self.cancel.clear(task_id)
    async def _finish(self,task_id,status,*,result_artifact_id=None):
        async with self.sf() as db: await TaskRepository(db).finish(task_id,status,result_artifact_id=result_artifact_id); await db.commit()
        ev_type={TaskStatus.COMPLETED:"task.completed",TaskStatus.CANCELLED:"task.cancelled"}[status]
        await self.bus.publish(task_id,TaskFinished(task_id=task_id,status=status,type=ev_type)); await self.bus.finish(task_id)
    async def _fail(self,task_id,code,msg):
        async with self.sf() as db: await TaskRepository(db).finish(task_id,TaskStatus.FAILED,error=msg[:4000]); await db.commit()
        await self.bus.publish(task_id,TaskFinished(task_id=task_id,status=TaskStatus.FAILED,type="task.failed",error_code=code,error_message=msg[:4000])); await self.bus.finish(task_id)
