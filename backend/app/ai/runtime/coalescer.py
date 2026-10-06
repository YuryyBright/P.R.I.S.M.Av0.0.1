"""Коалесинг token.delta: не робити XADD на кожен токен.

Скидання буфера: за інтервалом / за розміром / перед будь-якою іншою подією / наприкінці.
"""
from __future__ import annotations

import time
from typing import Awaitable, Callable

from app.ai.domain.events import TokenDelta
from app.ai.domain.records import AnyEvent

Publish = Callable[[AnyEvent], Awaitable[None]]


class DeltaCoalescer:
    def __init__(self, publish: Publish, *, interval_s: float, max_chars: int) -> None:
        self._publish = publish
        self._interval, self._max = interval_s, max_chars
        self._buf: list[str] = []
        self._size = 0
        self._last = time.monotonic()

    async def push(self, ev: AnyEvent) -> None:
        if isinstance(ev, TokenDelta):
            self._buf.append(ev.text)
            self._size += len(ev.text)
            if self._size >= self._max or (time.monotonic() - self._last) >= self._interval:
                await self.flush()
            return
        await self.flush()
        await self._publish(ev)

    async def flush(self) -> None:
        if self._buf:
            text, self._buf, self._size = "".join(self._buf), [], 0
            self._last = time.monotonic()
            await self._publish(TokenDelta(text=text))
