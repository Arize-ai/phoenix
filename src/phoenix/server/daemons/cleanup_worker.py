"""Background daemon that drains tombstoned rows in bounded batches."""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Optional

from phoenix.server.cleanup.coordinator import CleanupCoordinator
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_IDLE_POLL_SECONDS = 5.0
_JITTER_SECONDS = 0.5


class CleanupWorker(DaemonTask):
    """Executes bounded cleanup steps on tombstoned rows, including during storage lockout."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        idle_poll_seconds: float = _IDLE_POLL_SECONDS,
    ) -> None:
        super().__init__()
        self._coordinator = CleanupCoordinator(db)
        self._idle_poll_seconds = idle_poll_seconds

    @property
    def coordinator(self) -> CleanupCoordinator:
        return self._coordinator

    async def _run(self) -> None:
        while self._running:
            next_delay_seconds: Optional[float] = None
            try:
                while self._running:
                    ran_step, next_delay_seconds = await self._coordinator.step_or_next_delay()
                    if not ran_step:
                        break
                    await asyncio.sleep(0)
            except Exception:
                logger.exception("Unexpected error in cleanup worker loop")
            if self._running:
                await self._sleep(self._compute_sleep_delay_seconds(next_delay_seconds))

    def _compute_sleep_delay_seconds(self, next_delay_seconds: Optional[float] = None) -> float:
        idle_delay = max(
            0.05,
            self._idle_poll_seconds + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS),
        )
        if next_delay_seconds is None:
            return idle_delay
        return min(idle_delay, max(0.01, next_delay_seconds))

    async def _sleep(self, delay_seconds: float) -> None:
        await asyncio.sleep(delay_seconds)
