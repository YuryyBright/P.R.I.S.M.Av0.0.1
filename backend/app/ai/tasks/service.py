from __future__ import annotations
import uuid
from typing import Any, Sequence, Callable
from app.ai.domain.exceptions import ForbiddenError, NotFoundError, InvalidInputError
from app.ai.tasks.domain import TaskStatus, TaskType
from app.ai.tasks.models import AiTask
from app.ai.tasks.ports import DataSourceRef, DataSourceResolver, TaskEventBus
from app.ai.tasks.repository import TaskRepository
from app.ai.tasks.events import TaskCancelRequested, TaskCreated, TaskFinished

class TaskService:
    def __init__(self, session_factory: Callable, *, bus: TaskEventBus, cancel_store: Any,
                 source_resolver: DataSourceResolver | None = None, dispatcher: Any = None):
        self._sf,self._bus,self._cancel,self._resolver,self._dispatcher=session_factory,bus,cancel_store,source_resolver,dispatcher
    async def create(self, user: Any, *, instruction: str, task_type: TaskType, title: str | None,
                     config: dict[str,Any], sources: Sequence[DataSourceRef]) -> AiTask:
        if self._resolver is not None: await self._resolver.resolve(user, sources)
        task=AiTask(user_id=user.id,type=task_type,status=TaskStatus.QUEUED,title=title or instruction[:255],instruction=instruction,config=config,sources=[{"type":s.type,"id":s.id,"metadata":s.metadata} for s in sources],progress={"processed":0,"total":0,"percent":0.0,"successful":0,"failed":0,"skipped":0})
        async with self._sf() as db:
            TaskRepository(db).add(task); await db.commit(); await db.refresh(task)
        await self._bus.publish(task.id, TaskCreated(task_id=task.id))
        if self._dispatcher:
            celery_id = await self._dispatcher.dispatch(task.id)
            if celery_id:
                async with self._sf() as db:
                    await TaskRepository(db).set_celery_task_id(task.id, celery_id); await db.commit()
        return await self.get(user, task.id)
    async def get(self,user,task_id):
        async with self._sf() as db: task=await TaskRepository(db).get(task_id)
        if task is None or (task.user_id!=user.id and not getattr(user,"is_superuser",False)): raise NotFoundError("Task not found")
        return task
    async def list(self,user,limit=50,offset=0):
        async with self._sf() as db: return await TaskRepository(db).list_for_user(user.id,limit=limit,offset=offset)
    async def cancel(self,user,task_id):
        task=await self.get(user,task_id)
        if task.user_id!=user.id and not getattr(user,"is_superuser",False): raise ForbiddenError("Only task owner can cancel it")
        if task.status in (TaskStatus.QUEUED,TaskStatus.RUNNING,TaskStatus.PAUSED,TaskStatus.WAITING_FOR_TOOL,TaskStatus.WAITING_FOR_INPUT):
            async with self._sf() as db: await TaskRepository(db).request_cancel(task_id); await db.commit()
            await self._cancel.request(task_id); await self._bus.publish(task_id,TaskCancelRequested(task_id=task_id))
            current=await self.get(user,task_id)
            if current.status==TaskStatus.CANCELLED:
                await self._bus.publish(task_id,TaskFinished(task_id=task_id,status=TaskStatus.CANCELLED,type="task.cancelled")); await self._bus.finish(task_id)
        return await self.get(user,task_id)
    async def resume(self,user,task_id):
        task=await self.get(user,task_id)
        if task.status not in (TaskStatus.CANCELLED,TaskStatus.FAILED,TaskStatus.PAUSED): raise InvalidInputError("Only cancelled, failed or paused tasks can be resumed")
        async with self._sf() as db: await TaskRepository(db).set_state(task_id,status=TaskStatus.QUEUED,cancellation_requested=False,error=None,finished_at=None); await db.commit()
        await self._cancel.clear(task_id)
        if self._dispatcher:
            celery_id=await self._dispatcher.dispatch(task_id)
            if celery_id:
                async with self._sf() as db:
                    await TaskRepository(db).set_celery_task_id(task_id,celery_id); await db.commit()
        return await self.get(user,task_id)
