"""Database-backed ``EvalWorkCoordinator`` for span and session work units.

Claiming is dialect-split: PostgreSQL locks candidate rows with ``FOR UPDATE SKIP
LOCKED`` so competing consumers never block on each other's claims; SQLite (no row
locks) claims each candidate with a per-id compare-and-swap and keeps only the rows
whose update landed. Every post-claim transition (heartbeat / complete / fail /
expire) is fenced by ``claimed_by == me AND status == 'RUNNING'`` and reports a lost
claim as False via the update rowcount.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import and_, case, func, or_, select, type_coerce, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.coordinator import (
    LEASE_ATTEMPTS_EXHAUSTED_ERROR,
    LEASE_TTL_SECONDS,
    ClaimedWorkUnit,
    PublicationClaimLostError,
    PublicationWrite,
    QueueLag,
)
from phoenix.server.online_eval.derivation import MAX_ATTEMPTS, annotation_identifier
from phoenix.server.types import DbSessionFactory

TRANSIENT_RETRY_MAX_AGE_SECONDS = 86_400.0

_WorkUnitModel = type[models.EvalWorkUnit] | type[models.EvalSessionWorkUnit]
_DATABASE_NOW = object()


async def _database_now(session: AsyncSession) -> datetime:
    if session.get_bind().dialect.name == "postgresql":
        clock = func.statement_timestamp()
    else:
        clock = func.strftime("%Y-%m-%d %H:%M:%f", "now")
    now = await session.scalar(select(type_coerce(clock, models.UtcTimeStamp())))
    if now is None:
        raise RuntimeError("Database did not return its current time")
    return now


def work_unit_lease_lapsed(
    now: datetime | ColumnElement[datetime],
    work_unit_model: _WorkUnitModel = models.EvalWorkUnit,
) -> ColumnElement[bool]:
    return work_unit_model.claimed_at < now - timedelta(seconds=LEASE_TTL_SECONDS)


async def reap_lapsed_leases(
    session: AsyncSession,
    work_unit_model: _WorkUnitModel,
) -> None:
    """Terminalize RUNNING work whose lease lapsed with no attempts left.

    Consumers give a claim back themselves on every path they survive; this covers the
    ones they do not — a replica killed mid-evaluation leaves a RUNNING row that no
    consumer will ever reclaim, because reclaiming it would exceed the retry budget.
    Reaping is lifecycle work, so it is spelled here rather than in each materializer;
    the materializers call it from their own tick because they already hold the
    single-writer lease that makes it safe to run unguarded.
    """
    now = await _database_now(session)
    await session.execute(
        update(work_unit_model)
        .where(
            work_unit_model.status == "RUNNING",
            work_unit_model.attempts >= MAX_ATTEMPTS - 1,
            work_unit_lease_lapsed(now, work_unit_model),
        )
        .values(
            status="ERROR",
            attempts=MAX_ATTEMPTS,
            error=func.coalesce(work_unit_model.error, LEASE_ATTEMPTS_EXHAUSTED_ERROR),
        )
    )


class DbEvalWorkCoordinator:
    """Coordinates online-eval consumers through the selected work-unit table."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        evaluation_target: models.EvaluationTarget = "SPAN",
        max_attempts: int = MAX_ATTEMPTS,
    ) -> None:
        self._db = db
        self._evaluation_target = evaluation_target
        self._max_attempts = max_attempts
        # Only SESSION work carries a coverage watermark: a span is evaluated whole,
        # while a session is evaluated up to the content the transcript actually read.
        self._coverage_column: Optional[InstrumentedAttribute[Optional[datetime]]] = None
        if evaluation_target == "SPAN":
            self._work_unit_model: _WorkUnitModel = models.EvalWorkUnit
            self._target_row_column: InstrumentedAttribute[int] = models.EvalWorkUnit.span_rowid
        elif evaluation_target == "SESSION":
            self._work_unit_model = models.EvalSessionWorkUnit
            self._target_row_column = models.EvalSessionWorkUnit.project_session_rowid
            self._coverage_column = models.EvalSessionWorkUnit.transcript_covered_through
        else:
            raise ValueError(
                "Online evaluation work coordination supports SPAN and SESSION targets"
            )

    def _claimable(self, now: datetime) -> ColumnElement[bool]:
        work_unit_model = self._work_unit_model
        return or_(
            work_unit_model.status == "PENDING",
            and_(
                work_unit_model.status == "RUNNING",
                work_unit_model.attempts < self._max_attempts - 1,
                work_unit_lease_lapsed(now, work_unit_model),
            ),
            and_(
                work_unit_model.status == "ERROR",
                work_unit_model.attempts < self._max_attempts,
                or_(
                    work_unit_model.cooldown_until.is_(None),
                    work_unit_model.cooldown_until <= now,
                ),
            ),
        )

    async def claim(
        self,
        *,
        claimed_by: str,
        limit: int,
    ) -> Sequence[ClaimedWorkUnit]:
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            now = await _database_now(session)
            candidates = select(work_unit_model.id).where(self._claimable(now))
            candidates = candidates.order_by(work_unit_model.id).limit(limit)
            claim_values = {
                "status": "RUNNING",
                "claimed_at": now,
                "claimed_by": claimed_by,
                # A straggler outliving the stop() drain is counted.
                "attempts": case(
                    (
                        work_unit_model.status == "RUNNING",
                        work_unit_model.attempts + 1,
                    ),
                    else_=work_unit_model.attempts,
                ),
            }
            claimed_ids: list[int] = []
            if self._db.dialect is SupportedSQLDialect.POSTGRESQL:
                locked_ids = (
                    await session.scalars(candidates.with_for_update(skip_locked=True))
                ).all()
                if locked_ids:
                    await session.execute(
                        update(work_unit_model)
                        .where(work_unit_model.id.in_(locked_ids))
                        .values(**claim_values)
                    )
                    claimed_ids = list(locked_ids)
            else:
                for unit_id in (await session.scalars(candidates)).all():
                    cas = await session.execute(
                        update(work_unit_model)
                        .where(work_unit_model.id == unit_id, self._claimable(now))
                        .values(**claim_values)
                    )
                    if cas.rowcount == 1:  # type: ignore[attr-defined]
                        claimed_ids.append(unit_id)
            rows = (
                (
                    await session.execute(
                        select(
                            work_unit_model.id,
                            self._target_row_column.label("target_rowid"),
                            work_unit_model.evaluator_id,
                            work_unit_model.criteria_id,
                            work_unit_model.config_fingerprint,
                            work_unit_model.attempts,
                        )
                        .where(work_unit_model.id.in_(claimed_ids))
                        .order_by(work_unit_model.id)
                    )
                ).all()
                if claimed_ids
                else []
            )
            await session.commit()
        lease_expires_at = now + timedelta(seconds=LEASE_TTL_SECONDS)
        return [
            ClaimedWorkUnit(
                work_unit_id=row.id,
                evaluation_target=self._evaluation_target,
                target_rowid=row.target_rowid,
                evaluator_id=row.evaluator_id,
                criteria_id=row.criteria_id,
                config_fingerprint=row.config_fingerprint,
                identifier=annotation_identifier(row.config_fingerprint),
                attempts=row.attempts,
                claimed_by=claimed_by,
                lease_expires_at=lease_expires_at,
            )
            for row in rows
        ]

    async def heartbeat(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            claimed_at=_DATABASE_NOW,
        )

    async def complete(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        """Complete a claimed unit, treating an already-DONE row as success."""
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            already_status="DONE",
            status="DONE",
        )

    async def publish(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        write: PublicationWrite,
        coverage_watermark: Optional[datetime] = None,
    ) -> None:
        work_unit_model = self._work_unit_model
        if coverage_watermark is not None and self._coverage_column is None:
            raise ValueError(
                f"{self._evaluation_target} work units do not carry a coverage watermark"
            )
        async with self._db() as session:
            identity_statement: Any
            if self._evaluation_target == "SESSION":
                identity_statement = select(
                    work_unit_model.criteria_id,
                    self._target_row_column.label("project_session_rowid"),
                ).where(work_unit_model.id == work_unit_id)
            else:
                identity_statement = (
                    select(
                        work_unit_model.criteria_id,
                        models.Trace.project_session_rowid,
                    )
                    .select_from(work_unit_model)
                    .join(models.Span, self._target_row_column == models.Span.id)
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(work_unit_model.id == work_unit_id)
                )
            identity = (await session.execute(identity_statement)).one_or_none()
            if identity is None:
                raise PublicationClaimLostError(f"work unit {work_unit_id} no longer exists")

            # Global lock order: criteria (C) -> session (S) -> work unit (W) -> write.
            # Publication takes C -> S -> W; SESSION materialization takes C -> S before
            # inserting W. Retention takes S -> W, and no path may invert either edge.
            criteria_enabled = await session.scalar(
                select(models.ProjectEvaluatorCriteria.enabled)
                .where(models.ProjectEvaluatorCriteria.id == identity.criteria_id)
                .with_for_update()
            )
            if criteria_enabled is not True:
                raise PublicationClaimLostError(
                    f"work unit {work_unit_id} criteria is disabled or missing"
                )
            project_session_rowid = identity.project_session_rowid
            if project_session_rowid is not None:
                content_complete = await session.scalar(
                    select(models.ProjectSession.content_complete)
                    .where(models.ProjectSession.id == project_session_rowid)
                    .with_for_update()
                )
                if content_complete is not True:
                    raise PublicationClaimLostError(
                        f"work unit {work_unit_id} session content is incomplete or missing"
                    )
            elif self._evaluation_target == "SESSION":
                raise PublicationClaimLostError(
                    f"work unit {work_unit_id} session content is missing"
                )

            fenced = await session.scalar(
                select(work_unit_model.id)
                .where(
                    work_unit_model.id == work_unit_id,
                    work_unit_model.claimed_by == claimed_by,
                    work_unit_model.status == "RUNNING",
                )
                .with_for_update()
            )
            if fenced is None:
                raise PublicationClaimLostError(
                    f"work unit {work_unit_id} is no longer owned and live"
                )
            if coverage_watermark is not None:
                assert self._coverage_column is not None
                await session.execute(
                    update(work_unit_model)
                    .where(work_unit_model.id == work_unit_id)
                    .values({self._coverage_column: coverage_watermark})
                )
            await write(session)

    async def fail(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
        cooldown_until: Optional[datetime] = None,
        count_attempt: bool = True,
    ) -> bool:
        values: dict[str, Any] = {
            "error": error,
            "cooldown_until": cooldown_until,
        }
        if count_attempt:
            values["attempts"] = self._work_unit_model.attempts + 1
        else:
            async with self._db.read() as session:
                database_now = await _database_now(session)
            retry_age_cutoff = database_now - timedelta(seconds=TRANSIENT_RETRY_MAX_AGE_SECONDS)
            values["attempts"] = case(
                (self._work_unit_model.created_at < retry_age_cutoff, self._max_attempts),
                else_=self._work_unit_model.attempts,
            )
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status="ERROR",
            **values,
        )

    async def expire(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
        error: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status="EXPIRED",
            error=error,
        )

    async def release(
        self,
        *,
        work_unit_id: int,
        claimed_by: str,
    ) -> bool:
        return await self._fenced_transition(
            work_unit_id=work_unit_id,
            claim_owner=claimed_by,
            status="PENDING",
            claimed_at=None,
            claimed_by=None,
            cooldown_until=None,
            error=None,
        )

    async def _fenced_transition(
        self,
        *,
        work_unit_id: int,
        claim_owner: str,
        already_status: Optional[str] = None,
        **values: Any,
    ) -> bool:
        work_unit_model = self._work_unit_model
        async with self._db() as session:
            if values.get("claimed_at") is _DATABASE_NOW:
                values["claimed_at"] = await _database_now(session)
            result = await session.execute(
                update(work_unit_model)
                .where(
                    work_unit_model.id == work_unit_id,
                    work_unit_model.claimed_by == claim_owner,
                    work_unit_model.status == "RUNNING",
                )
                .values(**values)
            )
            rowcount = result.rowcount  # type: ignore[attr-defined]
            transitioned = bool(rowcount == 1)
            if not transitioned and already_status is not None:
                status = await session.scalar(
                    select(work_unit_model.status).where(work_unit_model.id == work_unit_id)
                )
                transitioned = status == already_status
            await session.commit()
            return transitioned

    async def lag(self) -> QueueLag:
        now = datetime.now(timezone.utc)
        work_unit_model = self._work_unit_model
        async with self._db.read() as session:
            error_exhausted = case(
                (
                    and_(
                        work_unit_model.status == "ERROR",
                        work_unit_model.attempts >= self._max_attempts,
                    ),
                    True,
                ),
                else_=False,
            ).label("error_exhausted")
            counts: dict[tuple[str, bool], int] = {
                (status, exhausted): count
                for status, exhausted, count in (
                    await session.execute(
                        select(work_unit_model.status, error_exhausted, func.count())
                        .where(
                            work_unit_model.status.in_(["PENDING", "RUNNING", "ERROR", "EXPIRED"])
                        )
                        .group_by(work_unit_model.status, error_exhausted)
                    )
                ).all()
            }
            oldest_work_created_at = await session.scalar(
                select(work_unit_model.created_at)
                .where(
                    or_(
                        work_unit_model.status == "PENDING",
                        and_(
                            work_unit_model.status == "ERROR",
                            work_unit_model.attempts < self._max_attempts,
                        ),
                    )
                )
                .order_by(work_unit_model.created_at)
                .limit(1)
            )
        oldest_actionable_age_seconds = (
            max((now - oldest_work_created_at).total_seconds(), 0.0)
            if oldest_work_created_at is not None
            else None
        )
        return QueueLag(
            pending_count=counts.get(("PENDING", False), 0),
            running_count=counts.get(("RUNNING", False), 0),
            retryable_error_count=counts.get(("ERROR", False), 0),
            exhausted_error_count=counts.get(("ERROR", True), 0),
            expired_count=counts.get(("EXPIRED", False), 0),
            oldest_actionable_age_seconds=oldest_actionable_age_seconds,
        )
