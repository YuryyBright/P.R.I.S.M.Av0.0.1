"""EventBus поверх Redis Stream `ai:run:{id}`.

id запису Redis Stream = SSE `id:` → Last-Event-ID дає точне дочитування.
Токени живуть лише тут (короткий TTL після завершення) і в БД не потрапляють.
"""
from __future__ import annotations

import uuid
from typing import Any, AsyncIterator

from app.ai.domain.events import parse_event
from app.ai.domain.records import AnyEvent
from app.ai.settings import BusSettings


def stream_key(run_id: uuid.UUID) -> str:
    return f"ai:run:{run_id}"


class RedisStreamBus:
    def __init__(self, cfg: BusSettings, *, redis: Any | None = None) -> None:
        if redis is None:
            from redis import asyncio as aioredis
            redis = aioredis.from_url(cfg.redis_url, decode_responses=True)
        self._r = redis
        self.cfg = cfg

    @property
    def redis(self) -> Any:
        return self._r

    async def publish(self, run_id: uuid.UUID, event: AnyEvent) -> str:
        return await self._r.xadd(
            stream_key(run_id), {"d": event.model_dump_json()},
            maxlen=self.cfg.stream_maxlen, approximate=True)

    async def subscribe(self, run_id: uuid.UUID, last_id: str | None = None, *,
                        keepalive_s: float = 15.0) -> AsyncIterator[tuple[str, AnyEvent] | None]:
        key, last = stream_key(run_id), last_id or "0-0"
        while True:
            res = await self._r.xread({key: last}, block=int(keepalive_s * 1000), count=200)
            if not res:
                yield None
                continue
            for _, entries in res:
                for sid, fields in entries:
                    last = sid
                    ev = parse_event(fields["d"])
                    yield sid, ev
                    if ev.type == "run.finished":
                        return

    async def finish(self, run_id: uuid.UUID) -> None:
        await self._r.expire(stream_key(run_id), self.cfg.ttl_after_finish_s)

    async def exists(self, run_id: uuid.UUID) -> bool:
        return bool(await self._r.exists(stream_key(run_id)))

    async def aclose(self) -> None:
        await self._r.aclose()
