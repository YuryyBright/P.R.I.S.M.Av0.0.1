"""In-memory EventBus (тести / один процес)."""
from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from typing import AsyncIterator

from app.ai.domain.records import AnyEvent


class MemoryBus:
    def __init__(self, *_: object) -> None:
        self._events: dict[uuid.UUID, list[tuple[str, AnyEvent]]] = defaultdict(list)
        self._cond: dict[uuid.UUID, asyncio.Condition] = defaultdict(asyncio.Condition)
        self._finished: set[uuid.UUID] = set()

    async def publish(self, run_id: uuid.UUID, event: AnyEvent) -> str:
        async with self._cond[run_id]:
            sid = f"{len(self._events[run_id]) + 1}-0"
            self._events[run_id].append((sid, event))
            self._cond[run_id].notify_all()
        return sid

    @staticmethod
    def _after(last_id: str | None) -> int:
        return int(last_id.split("-")[0]) if last_id else 0

    async def subscribe(self, run_id: uuid.UUID, last_id: str | None = None, *,
                        keepalive_s: float = 15.0) -> AsyncIterator[tuple[str, AnyEvent] | None]:
        pos = self._after(last_id)
        while True:
            cond = self._cond[run_id]
            async with cond:
                if pos >= len(self._events[run_id]):
                    try:
                        await asyncio.wait_for(cond.wait(), timeout=keepalive_s)
                    except asyncio.TimeoutError:
                        pass
                batch = self._events[run_id][pos:]
            if not batch:
                yield None
                continue
            for sid, ev in batch:
                pos += 1
                yield sid, ev
                if ev.type == "run.finished":
                    return

    async def finish(self, run_id: uuid.UUID) -> None:
        self._finished.add(run_id)

    async def exists(self, run_id: uuid.UUID) -> bool:
        return run_id in self._events

    async def aclose(self) -> None:
        return None
