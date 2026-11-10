"""Background purging of deleted evaluator bindings, one replica at a time.

See ``phoenix.server.evaluators.services.purge`` for what a purge removes.
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from contextlib import suppress
from secrets import token_hex
from typing import Any, Optional

from phoenix.server.evaluators.services.purge import StopPurge, purge_deleted_bindings
from phoenix.server.online_eval.leases import SCAN_LEASE_TTL_SECONDS, ScanLease
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 5 * 60
_JITTER_SECONDS = 30
_RENEW_INTERVAL_SECONDS = SCAN_LEASE_TTL_SECONDS / 3


class EvaluatorPurger(DaemonTask):
    """Purges deleted evaluator bindings when woken by a delete, and on a slow timer to catch
    any a restart or another replica left behind. A scan lease keeps one replica at a time
    purging."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._woken = asyncio.Event()
        self._lease = ScanLease(
            db, name="evaluator-purger", holder=f"evaluator-purger-{token_hex(8)}"
        )
        self._renewed_at = 0.0

    def wake(self) -> None:
        """Start a purge soon, without waiting for the timer."""
        self._woken.set()

    async def _run(self) -> None:
        while self._running:
            self._woken.clear()
            try:
                await self.purge_deleted_bindings()
            except Exception:
                logger.exception("Failed to purge deleted evaluators")
            await self._sleep()

    async def _sleep(self) -> None:
        with suppress(asyncio.TimeoutError):
            await asyncio.wait_for(
                self._woken.wait(),
                _SLEEP_SECONDS + random.uniform(-_JITTER_SECONDS, _JITTER_SECONDS),
            )

    async def purge_deleted_bindings(self) -> None:
        """Purge every deleted binding if this replica gets the lease."""
        if self._db.should_not_insert_or_update:
            return
        if not await self._lease.acquire():
            return
        self._renewed_at = time.monotonic()
        try:
            await purge_deleted_bindings(self._db, heartbeat=self._heartbeat)
        except StopPurge:
            pass
        finally:
            await self._lease.release()

    async def _heartbeat(self) -> None:
        if time.monotonic() - self._renewed_at < _RENEW_INTERVAL_SECONDS:
            return
        if not await self._lease.renew():
            raise StopPurge
        self._renewed_at = time.monotonic()


def wake_evaluator_purger(state: Any) -> None:
    """Wake the app's evaluator purger, if it runs one."""
    purger: Optional[EvaluatorPurger] = getattr(state, "evaluator_purger", None)
    if purger is not None:
        purger.wake()
