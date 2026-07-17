"""Consumer-side coordination seam for online-eval work distribution: claim,
heartbeat, completion, failure, expiration, and queue-lag observability. Producer-side
operations (cursor lease, watermark advance, and work-row materialization) are not part
of this interface.

Work-unit lifecycle:

    PENDING --claim--> RUNNING --complete--> DONE
                       RUNNING --fail-----> ERROR
                       RUNNING --expire---> EXPIRED
    RUNNING (lease lapsed) --> reclaimable
    ERROR (cooldown elapsed, attempts remain) --> retried
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Protocol

from phoenix.db import models

LEASE_TTL_SECONDS = 90
HEARTBEAT_INTERVAL_SECONDS = 30
LEASE_ATTEMPTS_EXHAUSTED_ERROR = "lease lapsed with attempts exhausted"


@dataclass(frozen=True)
class ClaimedWorkUnit:
    """A leased work unit with an idempotent annotation identifier; ``generation`` is None
    exactly for SPAN units and the zero-based session generation for SESSION units — a SESSION
    unit with ``generation=None`` is invalid.
    """

    work_unit_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    generation: Optional[int]
    evaluator_id: int
    criteria_id: int
    config_fingerprint: str
    identifier: str
    attempts: int
    claimed_by: str
    lease_expires_at: datetime


@dataclass(frozen=True)
class QueueLag:
    """Observable backlog; all fields are zero when no cursor or work rows exist.
    ``frontier_gap`` is the spans.id distance between the producer's eligible frontier
    and its watermark; ``oldest_pending_age_seconds`` covers PENDING and retryable ERROR
    work and is None when that backlog is empty."""

    pending_count: int
    running_count: int
    retryable_error_count: int
    exhausted_error_count: int
    frontier_gap: int
    oldest_pending_age_seconds: Optional[float]


class EvalWorkCoordinator(Protocol):
    """Coordinates online-eval work across replicas behind a swappable backend."""

    async def claim(
        self,
        *,
        claimed_by: str,
        limit: int,
    ) -> Sequence[ClaimedWorkUnit]:
        """Lease up to ``limit`` claimable work units for ``claimed_by``. A unit is
        claimable when it is PENDING, or RUNNING with a lapsed lease, or ERROR past
        its cooldown with attempts remaining. Returns an empty sequence when no
        claimable work exists."""
        ...

    async def heartbeat(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Renew the lease on a claimed unit. Returns False if the claim was lost —
        never silent success."""
        ...

    async def complete(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Transition a claimed unit RUNNING -> DONE. Returns True when the unit is
        already DONE so callers can safely retry an ambiguous commit. Returns False for
        any other lost claim."""
        ...

    async def fail(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        cooldown_until: Optional[datetime] = None,
        count_attempt: bool = True,
    ) -> bool:
        """Transition a claimed unit RUNNING -> ERROR, recording the error and setting an
        optional retry cooldown. ``count_attempt=True`` (the default) increments attempts,
        walking the unit toward the max-attempts claimability bar; pass False for transient
        infrastructure failures (provider outage, network timeout) so the unit retries after
        its cooldown without ever being exhausted by an outage. Returns False if the claim
        was lost."""
        ...

    async def expire(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Transition a claimed unit RUNNING -> EXPIRED. Terminal: for work that must
        never run (stale config fingerprint, missing or disabled criteria), unlike the
        retryable ERROR from ``fail``. Returns False if the claim was lost."""
        ...

    async def lag(self) -> QueueLag:
        """Report current queue backlog. Returns zeroed metrics when the queue is empty."""
        ...
