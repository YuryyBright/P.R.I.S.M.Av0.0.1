from __future__ import annotations

import uuid
from typing import Any


def key(task_id: uuid.UUID) -> str:
    return f"ai:task:{task_id}:cancel"


class RedisTaskCancelStore:
    def __init__(self, redis: Any, ttl_s: int = 3600) -> None:
        self.r = redis
        self.ttl = ttl_s

    async def request(self, task_id: uuid.UUID) -> None:
        await self.r.set(key(task_id), "1", ex=self.ttl)

    async def requested(self, task_id: uuid.UUID) -> bool:
        return bool(await self.r.exists(key(task_id)))

    async def clear(self, task_id: uuid.UUID) -> None:
        await self.r.delete(key(task_id))


class MemoryTaskCancelStore:
    def __init__(self) -> None:
        self._set: set[uuid.UUID] = set()

    async def request(self, task_id: uuid.UUID) -> None:
        self._set.add(task_id)

    async def requested(self, task_id: uuid.UUID) -> bool:
        return task_id in self._set

    async def clear(self, task_id: uuid.UUID) -> None:
        self._set.discard(task_id)
