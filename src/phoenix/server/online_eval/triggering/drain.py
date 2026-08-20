"""Lease event matching, request filing, and acknowledgment in bounded ticks."""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from datetime import timedelta
from secrets import token_hex
from typing import Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import (
    get_env_online_eval_event_drain_page_size,
    get_env_online_eval_event_retention_seconds,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.leases import DatabaseLease, LeaseLost
from phoenix.server.online_eval.requests import (
    EvaluationAsk,
    RejectedAsk,
    RequestRejection,
    SessionTarget,
    request_evaluations,
)
from phoenix.server.online_eval.triggering.log import (
    DrainedEvent,
    acknowledge,
    drain_page,
    purge_acknowledged,
)
from phoenix.server.online_eval.triggering.matching import match_events
from phoenix.server.online_eval.triggering.rules import load_rules
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

EVENT_DRAIN_INTERVAL_SECONDS = 5.0
EVENT_DRAIN_LEASE_TTL_SECONDS = 90.0
EVENT_PURGE_INTERVAL_SECONDS = 3600.0

MAX_PAGES_PER_TICK = 4

_LEASE_NAME = "online-eval-event-drain"
_REQUESTED_BY = "trigger"

# Adding a target here means adding an ask target beside `SessionTarget` in
# `phoenix.server.online_eval.requests` in the same change.
_DELIVERABLE_TARGETS: frozenset[models.EvaluationTarget] = frozenset({"SESSION"})

# Only rejections that cannot become deliverable while the drain is running belong here.
_CONSUMED_NO_OP_REJECTIONS = frozenset(
    {
        RequestRejection.RUNTIME_DISABLED,
        RequestRejection.CRITERIA_NOT_FOUND,
        RequestRejection.CRITERIA_TARGET_MISMATCH,
        RequestRejection.SESSION_NOT_FOUND,
        RequestRejection.PROJECT_MISMATCH,
        RequestRejection.SESSION_CONTENT_INCOMPLETE,
        RequestRejection.SESSION_CONTENT_IDENTITY_MISSING,
    }
)


class EventNotConsumable(Exception):
    """A rejection that says nothing about the event's target, so its page must stand."""

    def __init__(self, rejection: RequestRejection) -> None:
        super().__init__(rejection.value)
        self.rejection = rejection


class EventDrain(DaemonTask):
    """Decide what the logged events demand, and demand it."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = EVENT_DRAIN_INTERVAL_SECONDS,
        purge_interval_seconds: float = EVENT_PURGE_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._tick_interval_seconds = tick_interval_seconds
        self._purge_interval_seconds = purge_interval_seconds
        self._page_size = get_env_online_eval_event_drain_page_size()
        self._retention_seconds = get_env_online_eval_event_retention_seconds()
        self._drain_id = f"event-drain-{token_hex(8)}"
        self._last_purge_at: Optional[float] = None
        self._lease = DatabaseLease(
            db,
            entity=models.EvalWorkLease,
            key=(models.EvalWorkLease.name == _LEASE_NAME,),
            holder_column=models.EvalWorkLease.holder,
            heartbeat_column=models.EvalWorkLease.heartbeat_at,
            holder_id=self._drain_id,
            ttl_seconds=EVENT_DRAIN_LEASE_TTL_SECONDS,
        )

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Online-eval event drain tick failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            await self._release_lease()

    async def _tick(self) -> None:
        mutations_allowed = not self._db.should_not_insert_or_update
        lease_id: Optional[int] = await self._lease.acquire(
            models.EvalWorkLease.id,
            bootstrap=self._insert_lease if mutations_allowed else None,
        )
        if lease_id is None:
            return
        try:
            if not mutations_allowed:
                await self._lease.renew()
                return
            started_while_running = self._running
            for page_number in range(MAX_PAGES_PER_TICK):
                events_processed = await self._drain()
                if (
                    events_processed < self._page_size
                    or (started_while_running and not self._running)
                    or page_number + 1 == MAX_PAGES_PER_TICK
                ):
                    break
                await self._lease.renew()
            await self._purge_if_due()
        except LeaseLost:
            logger.warning("Online-eval event drain tick aborted after losing its lease")

    async def _insert_lease(self, session: AsyncSession) -> None:
        await session.execute(
            insert_on_conflict(
                {"name": _LEASE_NAME},
                table=models.EvalWorkLease,
                dialect=self._db.dialect,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )

    async def _drain(self) -> int:
        """Decide one page of events, returning how many events were processed. Project evaluators
        rows are read first, matching the lock order `request_evaluations` takes."""
        async with self._db() as session:
            events = await drain_page(session, limit=self._page_size)
            if not events:
                await self._lease.fence(session)
                return 0
            deliverable = _deliverable(events)
            keys = match_events(deliverable, await load_rules(session))
            asks = [
                EvaluationAsk(
                    target=SessionTarget(project_session_rowid=key.target_rowid),
                    project_evaluator_id=key.project_evaluator_id,
                    requested_by=_REQUESTED_BY,
                )
                for key in keys
            ]
            outcome = await request_evaluations(session, asks)
            _consume_rejections(outcome.rejected)
            await acknowledge(session, [event.event_id for event in events])
            await self._lease.fence(session)
        return len(events)

    async def _purge_if_due(self) -> int:
        if (
            self._last_purge_at is not None
            and time.monotonic() - self._last_purge_at < self._purge_interval_seconds
        ):
            return 0
        async with self._db() as session:
            now = await self._lease.database_now(session)
            purged = await purge_acknowledged(
                session,
                acknowledged_before=now - timedelta(seconds=self._retention_seconds),
            )
            await self._lease.fence(session)
        self._last_purge_at = time.monotonic()
        return purged

    async def _release_lease(self) -> None:
        try:
            await self._lease.release()
        except Exception:
            logger.exception("Failed to release online-eval event drain lease")


def _deliverable(events: Sequence[DrainedEvent]) -> list[DrainedEvent]:
    """Return the occurrences this drain can ask for, naming the ones it cannot."""
    deliverable = [event for event in events if event.evaluation_target in _DELIVERABLE_TARGETS]
    if undeliverable := len(events) - len(deliverable):
        counts = Counter(
            event.evaluation_target
            for event in events
            if event.evaluation_target not in _DELIVERABLE_TARGETS
        )
        logger.info(
            f"Event drain consumed {undeliverable} occurrences it cannot request "
            f"evaluations for: {dict(counts)}. Requesting one needs an ask target "
            f"beside SessionTarget in phoenix.server.online_eval.requests."
        )
    return deliverable


def _consume_rejections(rejected: Sequence[RejectedAsk]) -> None:
    """Raise unless every rejection is one the drain may consume."""
    for entry in rejected:
        if entry.rejection not in _CONSUMED_NO_OP_REJECTIONS:
            raise EventNotConsumable(entry.rejection)
    if rejected:
        counts = Counter(entry.rejection.value for entry in rejected)
        logger.debug(f"Event drain consumed {len(rejected)} asks without requesting: {counts}")

