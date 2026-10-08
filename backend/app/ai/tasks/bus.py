from __future__ import annotations

import asyncio
import uuid
from typing import Any, AsyncIterator

from app.ai.settings import BusSettings
from app.ai.tasks.events import TaskEvent, event_from_json


def stream_key(task_id: uuid.UUID) -> str:
    return f"ai:task:{task_id}"


class RedisTaskEventBus:
    def __init__(self, cfg: BusSettings, *, redis: Any | None = None) -> None:
        if redis is None:
            from redis import asyncio as aioredis

            redis = aioredis.from_url(cfg.redis_url, decode_responses=True)
        self._r: Any = redis
        self.cfg = cfg

    @property
    def redis(self) -> Any:
        return self._r

    async def publish(self, task_id: uuid.UUID, event: TaskEvent) -> str:
        stream_id = await self._r.xadd(
            stream_key(task_id),
            {"d": event.model_dump_json()},
            maxlen=self.cfg.stream_maxlen,
            approximate=True,
        )
        return str(stream_id)

    def subscribe(
        self,
        task_id: uuid.UUID,
        last_id: str | None = None,
        *,
        keepalive_s: float = 15.0,
    ) -> AsyncIterator[tuple[str, TaskEvent] | None]:
        async def gen() -> AsyncIterator[tuple[str, TaskEvent] | None]:
            last = last_id or "0-0"
            key = stream_key(task_id)
            while True:
                result = await self._r.xread(
                    {key: last}, block=int(keepalive_s * 1000), count=200
                )
                if not result:
                    yield None
                    continue
                for _, entries in result:
                    for stream_id, fields in entries:
                        last = str(stream_id)
                        event = event_from_json(fields["d"])
                        yield last, event
                        if getattr(event, "type", None) in {
                            "task.completed",
                            "task.failed",
                            "task.cancelled",
                        }:
                            return

        return gen()

    async def finish(self, task_id: uuid.UUID) -> None:
        await self._r.expire(stream_key(task_id), self.cfg.ttl_after_finish_s)

    async def exists(self, task_id: uuid.UUID) -> bool:
        return bool(await self._r.exists(stream_key(task_id)))

    async def aclose(self) -> None:
        await self._r.aclose()


class MemoryTaskEventBus:
    def __init__(self) -> None:
        self._events: dict[uuid.UUID, list[tuple[str, TaskEvent]]] = {}
        self._closed: set[uuid.UUID] = set()

    async def publish(self, task_id: uuid.UUID, event: TaskEvent) -> str:
        events = self._events.setdefault(task_id, [])
        stream_id = str(len(events) + 1)
        events.append((stream_id, event))
        return stream_id

    def subscribe(
        self,
        task_id: uuid.UUID,
        last_id: str | None = None,
        *,
        keepalive_s: float = 15.0,
    ) -> AsyncIterator[tuple[str, TaskEvent] | None]:
        async def gen() -> AsyncIterator[tuple[str, TaskEvent] | None]:
            position = int(last_id or 0)
            while True:
                events = self._events.get(task_id, [])
                while position < len(events):
                    stream_id, event = events[position]
                    position += 1
                    yield stream_id, event
                    if getattr(event, "type", None) in {
                        "task.completed",
                        "task.failed",
                        "task.cancelled",
                    }:
                        return
                if task_id in self._closed:
                    return
                await asyncio.sleep(keepalive_s)
                yield None

        return gen()

    async def finish(self, task_id: uuid.UUID) -> None:
        self._closed.add(task_id)

    async def exists(self, task_id: uuid.UUID) -> bool:
        return task_id in self._events

    async def aclose(self) -> None:
        return None
