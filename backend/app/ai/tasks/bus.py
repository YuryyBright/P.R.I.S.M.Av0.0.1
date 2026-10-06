from __future__ import annotations
import uuid
from typing import AsyncIterator
from app.ai.settings import BusSettings
from .events import TaskEvent, TaskEventUnion

def stream_key(task_id: uuid.UUID) -> str: return f"ai:task:{task_id}"
class RedisTaskEventBus:
    def __init__(self, cfg: BusSettings, *, redis=None):
        if redis is None:
            from redis import asyncio as aioredis
            redis = aioredis.from_url(cfg.redis_url, decode_responses=True)
        self._r, self.cfg = redis, cfg
    @property
    def redis(self): return self._r
    async def publish(self, task_id, event):
        return await self._r.xadd(stream_key(task_id), {"d": event.model_dump_json()}, maxlen=self.cfg.stream_maxlen, approximate=True)
    def subscribe(self, task_id, last_id=None, *, keepalive_s=15.0):
        async def gen():
            last = last_id or "0-0"; key=stream_key(task_id)
            from pydantic import TypeAdapter
            adapter=TypeAdapter(TaskEventUnion)
            while True:
                res=await self._r.xread({key:last}, block=int(keepalive_s*1000), count=200)
                if not res: yield None; continue
                for _, entries in res:
                    for sid, fields in entries:
                        last=sid; ev=adapter.validate_json(fields["d"]); yield sid,ev
                        if ev.type in {"task.completed","task.failed","task.cancelled"}: return
        return gen()
    async def finish(self, task_id): await self._r.expire(stream_key(task_id), self.cfg.ttl_after_finish_s)
    async def exists(self, task_id): return bool(await self._r.exists(stream_key(task_id)))
    async def aclose(self): await self._r.aclose()

class MemoryTaskEventBus:
    def __init__(self): self._events={}; self._closed=set()
    async def publish(self, task_id, event):
        arr=self._events.setdefault(task_id,[]); sid=str(len(arr)+1); arr.append((sid,event)); return sid
    def subscribe(self, task_id, last_id=None, *, keepalive_s=15.0):
        async def gen():
            import asyncio
            pos=int(last_id or 0)
            while True:
                arr=self._events.get(task_id,[])
                while pos<len(arr):
                    sid,ev=arr[pos]; pos+=1; yield sid,ev
                    if ev.type in {"task.completed","task.failed","task.cancelled"}: return
                if task_id in self._closed: return
                await asyncio.sleep(keepalive_s); yield None
        return gen()
    async def finish(self, task_id): self._closed.add(task_id)
    async def exists(self, task_id): return task_id in self._events
    async def aclose(self): pass
