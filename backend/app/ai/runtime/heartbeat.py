"""Sidecar run-а: heartbeat у БД + опитування прапорця скасування.

Один фоновий таск на run. Heartbeat потрібен sweeper-у (RUNNING без heartbeat → worker_lost);
cancel_event будить раннер, навіть якщо LLM «мовчить» і подій нема.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Callable

from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.domain.ports import CancelStore
from app.ai.repositories.run_repo import RunRepository

logger = logging.getLogger(__name__)


async def run_sidecar(*, run_id: uuid.UUID, session_factory: Callable[[], AsyncSession],
                      cancel_store: CancelStore, cancel_event: asyncio.Event,
                      heartbeat_s: float, poll_s: float = 1.0) -> None:
    last_hb = time.monotonic()
    while True:
        await asyncio.sleep(poll_s)
        try:
            if not cancel_event.is_set() and await cancel_store.is_requested(run_id):
                cancel_event.set()
            if time.monotonic() - last_hb >= heartbeat_s:
                async with session_factory() as db:
                    await RunRepository(db).touch_heartbeat(run_id)
                    await db.commit()
                last_hb = time.monotonic()
        except asyncio.CancelledError:
            raise
        except Exception:                                  # sidecar не має валити run
            logger.warning("sidecar tick failed run=%s", run_id, exc_info=True)
