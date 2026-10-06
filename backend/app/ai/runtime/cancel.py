"""Прапорець скасування: Redis-ключ ai:run:{id}:cancel (API ставить — воркер/раннер читає)."""
from __future__ import annotations

import uuid


def cancel_key(run_id: uuid.UUID) -> str:
    return f"ai:run:{run_id}:cancel"


class RedisCancelStore:
    def __init__(self, redis, ttl_s: int = 3600) -> None:
        self._r, self._ttl = redis, ttl_s

    async def request(self, run_id: uuid.UUID) -> None:
        await self._r.set(cancel_key(run_id), "1", ex=self._ttl)

    async def is_requested(self, run_id: uuid.UUID) -> bool:
        return bool(await self._r.exists(cancel_key(run_id)))


class MemoryCancelStore:
    def __init__(self) -> None:
        self._set: set[uuid.UUID] = set()

    async def request(self, run_id: uuid.UUID) -> None:
        self._set.add(run_id)

    async def is_requested(self, run_id: uuid.UUID) -> bool:
        return run_id in self._set
