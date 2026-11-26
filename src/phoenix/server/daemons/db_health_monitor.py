"""Tracks whether the database is reachable, so health endpoints answer without querying it."""

from __future__ import annotations

import logging
from asyncio import sleep, timeout
from time import monotonic
from typing import Optional

from sqlalchemy import select

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_PROBE_INTERVAL_SECONDS = 5.0
_PROBE_TIMEOUT_SECONDS = 3.0
# Longer than two full probe cycles, so one slow probe does not take the server out of rotation.
_READINESS_MAX_STALENESS_SECONDS = 2 * (_PROBE_INTERVAL_SECONDS + _PROBE_TIMEOUT_SECONDS) + 4.0
# Long enough to ride out a managed-database failover or restart without a restart loop.
_LIVENESS_MAX_STALENESS_SECONDS = 300.0


class DbHealthMonitor(DaemonTask):
    """
    Probes the database on a fixed schedule and remembers when it last answered.

    Health endpoints read that timestamp instead of querying the database, so the
    number of health requests has no effect on database load: the only probe is the
    one this daemon issues, one at a time, each bounded by a timeout.

    Health is the age of the last successful probe rather than the outcome of the
    last probe, so a monitor that stops probing reports unhealthy instead of serving
    a stale answer.

    A probe that times out counts against readiness but not liveness. The probe
    shares the connection pool with requests, so a timeout can mean a busy pool
    rather than a lost database, and restarting a busy server would drop its work.

    SQLite is not probed. It runs in-process, so there is no connection to lose, and
    every session shares one connection, so a probe would measure write load.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._last_success_at: Optional[float] = None
        self._last_success_or_timeout_at: Optional[float] = None
        self._is_failing = False

    @property
    def is_ready(self) -> bool:
        """Whether the database answered recently enough to serve requests."""
        return _seconds_since(self._last_success_at) <= _READINESS_MAX_STALENESS_SECONDS

    @property
    def is_live(self) -> bool:
        """Whether the database has answered within the prolonged-outage grace period."""
        return _seconds_since(self._last_success_or_timeout_at) <= _LIVENESS_MAX_STALENESS_SECONDS

    async def _run(self) -> None:
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            return
        # Startup has just used the database, so the server starts out healthy.
        self._last_success_at = self._last_success_or_timeout_at = monotonic()
        self._is_failing = False
        while self._running:
            await self._sleep()
            try:
                async with timeout(_PROBE_TIMEOUT_SECONDS):
                    async with self._db() as session:
                        await session.execute(select(1))
            except TimeoutError:
                if not self._is_failing:
                    logger.warning("Database health probe timed out")
                self._is_failing = True
                self._last_success_or_timeout_at = monotonic()
            except Exception:
                # Deliberately broad: credential providers and drivers raise errors outside
                # SQLAlchemy's hierarchy, and letting one end this loop would report a
                # reachable database as down until the server restarts.
                if not self._is_failing:
                    logger.warning("Database is unreachable", exc_info=True)
                self._is_failing = True
            else:
                if self._is_failing:
                    logger.info(
                        "Database is reachable again after %.0f seconds",
                        _seconds_since(self._last_success_at),
                    )
                self._is_failing = False
                self._last_success_at = self._last_success_or_timeout_at = monotonic()

    async def _sleep(self) -> None:
        await sleep(_PROBE_INTERVAL_SECONDS)


def _seconds_since(moment: Optional[float]) -> float:
    return 0.0 if moment is None else monotonic() - moment
