"""InlineLauncher: виконує run як asyncio-таск у процесі API.

Таск тримається у наборі зі strong references (інакше GC може його зібрати посеред виконання).
Run НЕ залежить від SSE-з'єднання: клієнт може відключитися — run допише відповідь у БД.
Після рестарту API «осиротілі» run-и закриває sweeper (heartbeat протух → worker_lost).
"""
from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)


class InlineLauncher:
    def __init__(
        self, execute: Callable[[uuid.UUID], Coroutine[Any, Any, None]]
    ) -> None:
        self._execute = execute
        self._tasks: set[asyncio.Task[None]] = set()

    async def dispatch(self, run_id: uuid.UUID) -> None:
        task: asyncio.Task[None] = asyncio.create_task(
            self._execute(run_id), name=f"ai-run-{run_id}"
        )
        self._tasks.add(task)
        task.add_done_callback(self._done)

    def _done(self, task: asyncio.Task) -> None:
        self._tasks.discard(task)
        if not task.cancelled() and task.exception() is not None:
            logger.error("inline run crashed: %r", task.exception(), exc_info=task.exception())

    @property
    def active(self) -> int:
        return len(self._tasks)

    async def aclose(self, *, timeout: float = 10.0) -> None:
        """Shutdown API: дати run-ам шанс завершитись, далі скасувати (раннер закриє їх як interrupted)."""
        if not self._tasks:
            return
        _, pending = await asyncio.wait(self._tasks, timeout=timeout)
        for t in pending:
            t.cancel()
        if pending:
            with contextlib.suppress(Exception):
                await asyncio.gather(*pending, return_exceptions=True)
