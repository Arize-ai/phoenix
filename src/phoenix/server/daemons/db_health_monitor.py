"""Tracks whether the database is reachable, so health endpoints answer without querying it."""

from __future__ import annotations

import logging
from asyncio import sleep, timeout
from time import monotonic
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_PROBE_INTERVAL_SECONDS = 5.0
_PROBE_TIMEOUT_SECONDS = 3.0
# Two consecutive failed probes, so one slow probe does not take the server out of rotation.
_READINESS_MAX_STALENESS_SECONDS = 15.0
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

    SQLite is not probed. It runs in-process, so there is no connection to lose, and
    every session shares one connection, so a probe would measure write load.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__()
        self._db = db
        self._last_success_at: Optional[float] = None
        self._is_unreachable = False

    @property
    def is_ready(self) -> bool:
        """Whether the database answered recently enough to serve requests."""
        return self._seconds_since_last_success() <= _READINESS_MAX_STALENESS_SECONDS

    @property
    def is_live(self) -> bool:
        """Whether the database has answered within the prolonged-outage grace period."""
        return self._seconds_since_last_success() <= _LIVENESS_MAX_STALENESS_SECONDS

    def _seconds_since_last_success(self) -> float:
        if self._last_success_at is None:
            return 0.0
        return monotonic() - self._last_success_at

    async def _run(self) -> None:
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            return
        # Startup has just used the database, so the server starts out healthy.
        self._last_success_at = monotonic()
        self._is_unreachable = False
        while self._running:
            await self._sleep()
            try:
                async with timeout(_PROBE_TIMEOUT_SECONDS):
                    async with self._db() as session:
                        await session.execute(select(1))
            except (SQLAlchemyError, OSError, TimeoutError):
                if not self._is_unreachable:
                    logger.warning("Database is unreachable", exc_info=True)
                self._is_unreachable = True
            else:
                if self._is_unreachable:
                    logger.info(
                        "Database is reachable again after %.0f seconds",
                        self._seconds_since_last_success(),
                    )
                self._is_unreachable = False
                self._last_success_at = monotonic()

    async def _sleep(self) -> None:
        await sleep(_PROBE_INTERVAL_SECONDS)
