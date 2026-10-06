from __future__ import annotations
import uuid

def key(task_id: uuid.UUID) -> str: return f"ai:task:{task_id}:cancel"
class RedisTaskCancelStore:
    def __init__(self, redis, ttl_s=3600): self.r,self.ttl=redis,ttl_s
    async def request(self, task_id): await self.r.set(key(task_id),"1",ex=self.ttl)
    async def requested(self, task_id): return bool(await self.r.exists(key(task_id)))
    async def clear(self, task_id): await self.r.delete(key(task_id))
class MemoryTaskCancelStore:
    def __init__(self): self._set=set()
    async def request(self, task_id): self._set.add(task_id)
    async def requested(self, task_id): return task_id in self._set
    async def clear(self, task_id): self._set.discard(task_id)
