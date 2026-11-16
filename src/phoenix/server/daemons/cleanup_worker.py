"""Background daemon that drains ``cleanup_tasks`` in bounded batches."""

from __future__ import annotations

import asyncio
import logging
import random
from contextlib import suppress
from typing import Optional

from phoenix.server.cleanup.coordinator import CleanupCoordinator
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import CanPutItem, DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_IDLE_POLL_SECONDS = 5.0
_JITTER_SECONDS = 0.5


class CleanupWorker(DaemonTask):
    """Claims and executes bounded ``cleanup_tasks`` steps, including during storage lockout."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: Optional[CanPutItem[DmlEvent]] = None,
        idle_poll_seconds: float = _IDLE_POLL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._coordinator = CleanupCoordinator(db, event_queue=event_queue)
        self._woken = asyncio.Event()
        self._idle_poll_seconds = idle_poll_seconds

    @property
    def coordinator(self) -> CleanupCoordinator:
        return self._coordinator

    def wake(self) -> None:
        """Prompt the worker to check for eligible cleanup tasks immediately."""
        self._woken.set()

    async def _run(self) -> None:
        while self._running:
            self._woken.clear()
            try:
                while self._running and await self._coordinator.run_one_step():
                    await asyncio.sleep(0)
            except Exception:
                logger.exception("Unexpected error in cleanup worker loop")
            if self._running and not self._woken.is_set():
                await self._sleep()

    async def _sleep(self) -> None:
        delay = max(
            0.05,
            self._idle_poll_seconds + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS),
        )
        with suppress(asyncio.TimeoutError):
            await asyncio.wait_for(self._woken.wait(), delay)
