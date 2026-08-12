"""Consumer-side coordination seam for online-eval work distribution: claim,
heartbeat, completion, failure, expiration, and queue-lag observability. Producer-side
operations (cursor lease, watermark advance, and work-row materialization) are not part
of this interface.

Work-unit lifecycle:

    PENDING --claim--> RUNNING --complete--> DONE
                       RUNNING --fail-----> ERROR
                       RUNNING --expire---> EXPIRED
                       RUNNING --release--> PENDING
    RUNNING (lease lapsed) --> reclaimable
    ERROR (cooldown elapsed, attempts remain) --> retried
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.online_eval.failure_policy import FailureDisposition

LEASE_TTL_SECONDS = 90
HEARTBEAT_INTERVAL_SECONDS = 30
LEASE_ATTEMPTS_EXHAUSTED_ERROR = "lease lapsed with attempts exhausted"

PublicationWrite = Callable[[AsyncSession], Awaitable[None]]
"""Writes one unit's results, inside the transaction that fenced its publication."""


class PublicationClaimLostError(Exception):
    """A work unit stopped being publishable before its results could be written."""

    online_eval_disposition = FailureDisposition(
        count_attempt=True,
        terminal=True,
        code="PUBLICATION_CLAIM_LOST",
    )


@dataclass(frozen=True)
class ClaimedWorkUnit:
    """A leased work unit with an idempotent annotation identifier."""

    work_unit_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    evaluator_id: int
    criteria_id: int
    config_fingerprint: str
    identifier: str
    attempts: int
    claimed_by: str
    lease_expires_at: datetime


@dataclass(frozen=True)
class QueueLag:
    """Observable backlog; all counts are zero when no work rows exist.
    ``oldest_actionable_age_seconds`` covers PENDING and retryable ERROR work and is
    None when that backlog is empty."""

    pending_count: int
    running_count: int
    retryable_error_count: int
    exhausted_error_count: int
    expired_count: int
    oldest_actionable_age_seconds: Optional[float]


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

    async def publish(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        write: PublicationWrite,
        coverage_watermark: Optional[datetime] = None,
    ) -> None:
        """Fence a claimed unit for publication and run ``write`` in that transaction.

        The fence is stricter than a lifecycle transition's: the unit must still be
        owned and RUNNING, *and* its criteria still enabled — a result must not be
        published under a configuration that has since been turned off. Where the target
        keeps a coverage watermark, it records how much of the target the published
        result actually read and is written in the same transaction; a watermark that
        outlived its annotation would claim coverage no result describes.

        Raises ``PublicationClaimLostError`` when the fence fails. Does not complete the
        unit — publication and completion are separate steps, so a lost acknowledgement
        re-runs an idempotent write rather than a lost result."""
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
        error: str,
    ) -> bool:
        """Transition a claimed unit RUNNING -> EXPIRED with a stable terminal reason."""
        ...

    async def release(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Return a still-owned RUNNING unit to PENDING without incrementing attempts."""
        ...

    async def lag(self) -> QueueLag:
        """Report current queue backlog. Returns zeroed metrics when the queue is empty."""
        ...
