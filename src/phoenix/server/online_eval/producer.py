"""Online-eval producer daemon.

Materializes span-level eval work units from enabled project evaluator criteria.
The producer runs on every replica but self-elects each tick via the
``eval_work_cursors`` CAS lease, so exactly one replica per evaluation target
scans spans and writes work rows at a time. Each tick: renew the lease, reap
expired/aged work rows, scan the lag-gated span id window per criteria, and
idempotently insert surviving (span, evaluator, config) work units. A slow-cadence
backstop sweep re-covers a bounded id window behind the watermark to catch spans
that became visible after their window was scanned.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

from sqlalchemy import Select, and_, delete, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import with_polymorphic

from phoenix.config import (
    get_env_online_eval_backstop_interval_seconds,
    get_env_online_eval_backstop_lookback_span_ids,
    get_env_online_eval_frontier_lag_seconds,
    get_env_online_eval_max_outstanding,
    get_env_online_eval_max_span_ids_per_tick,
    get_env_online_eval_pending_ttl_seconds,
    get_env_online_eval_retention_seconds,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.db_coordinator import (
    STALE_FINGERPRINT_ERROR,
    work_unit_lease_lapsed,
)
from phoenix.server.online_eval.derivation import (
    MAX_ATTEMPTS,
    ResolvedCriteria,
    annotation_identifier,
    config_fingerprint,
    sample_key,
)
from phoenix.server.types import DaemonTask, DbSessionFactory
from phoenix.trace.dsl.filter import SpanFilter

logger = logging.getLogger(__name__)

CURSOR_LEASE_TTL_SECONDS = 90.0
TICK_INTERVAL_SECONDS = 10.0

_INSERT_BATCH_SIZE = 1000
_WORK_UNIT_UNIQUE_BY = ("span_rowid", "evaluator_id", "config_fingerprint")
_SESSION_ACTIVITY_UNIQUE_BY = ("project_session_rowid",)
_CONSUMER_GROUP = "default"
_PENDING_TTL_EXCEEDED_ERROR = "pending ttl exceeded"


class _CursorLeaseLost(Exception):
    pass


async def resolve_criteria(
    session: AsyncSession,
    criteria: models.ProjectEvaluatorCriteria,
    evaluator: models.Evaluator,
) -> Optional[ResolvedCriteria]:
    """Resolve one criteria row's fingerprint inputs, pinning mutable pointers to
    immutable version identities: the tagged (or latest) PromptVersion id for LLM
    evaluators, the latest CodeEvaluatorVersion id for CODE, and (key, synced_at)
    for BUILTIN. Returns None when no version is resolvable.

    The consumer's staleness guard must recompute fingerprints through this same
    function — an independent resolution recipe re-materializes the backlog.
    """
    version_ref: Any
    input_mapping: Any = None
    sandbox_config_id: Optional[int] = None
    if isinstance(evaluator, models.LLMEvaluator):
        if evaluator.prompt_version_tag_id is not None:
            version_ref = await session.scalar(
                select(models.PromptVersionTag.prompt_version_id).where(
                    models.PromptVersionTag.id == evaluator.prompt_version_tag_id
                )
            )
        else:
            version_ref = await session.scalar(
                select(models.PromptVersion.id)
                .where(models.PromptVersion.prompt_id == evaluator.prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
    elif isinstance(evaluator, models.CodeEvaluator):
        version_ref = await session.scalar(
            select(models.CodeEvaluatorVersion.id)
            .where(models.CodeEvaluatorVersion.code_evaluator_id == evaluator.id)
            .order_by(models.CodeEvaluatorVersion.id.desc())
            .limit(1)
        )
        sandbox_config_id = evaluator.sandbox_config_id
    elif isinstance(evaluator, models.BuiltinEvaluator):
        version_ref = [evaluator.key, evaluator.synced_at.isoformat()]
    else:
        return None
    if version_ref is None:
        return None
    effective_input_mapping = criteria.input_mapping
    if effective_input_mapping is None and isinstance(evaluator, models.CodeEvaluator):
        effective_input_mapping = evaluator.input_mapping
    if effective_input_mapping is not None:
        input_mapping = effective_input_mapping.model_dump()
    return ResolvedCriteria(
        criteria_id=criteria.id,
        name=criteria.name.root,
        evaluator_id=evaluator.id,
        version_ref=version_ref,
        output_configs=[config.model_dump() for config in evaluator.output_configs],
        input_mapping=input_mapping,
        evaluation_target=criteria.evaluation_target,
        sandbox_config_id=sandbox_config_id,
        filter_condition=criteria.filter_condition,
        sampling_rate=criteria.sampling_rate,
    )


@dataclass(frozen=True)
class _ActiveCriteria:
    criteria_id: int
    project_id: int
    evaluator_id: int
    name: str
    sampling_rate: float
    fingerprint: str
    identifier: str
    span_filter: SpanFilter

    def scan_stmt(self, low_exclusive: int, high_inclusive: int) -> Select[tuple[int]]:
        stmt = (
            select(models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == self.project_id)
            .where(models.Span.id > low_exclusive, models.Span.id <= high_inclusive)
        )
        return self.span_filter(stmt)

    def materializable_scan_stmt(
        self, low_exclusive: int, high_inclusive: int
    ) -> Select[tuple[int]]:
        return self.scan_stmt(low_exclusive, high_inclusive).where(
            ~exists(
                select(1).where(
                    models.SpanAnnotation.span_rowid == models.Span.id,
                    models.SpanAnnotation.name == self.name,
                    models.SpanAnnotation.identifier == self.identifier,
                )
            ),
            or_(
                ~exists(
                    select(1).where(
                        models.EvalWorkUnit.span_rowid == models.Span.id,
                        models.EvalWorkUnit.evaluator_id == self.evaluator_id,
                        models.EvalWorkUnit.config_fingerprint == self.fingerprint,
                    )
                ),
                exists(
                    select(1).where(
                        models.EvalWorkUnit.span_rowid == models.Span.id,
                        models.EvalWorkUnit.evaluator_id == self.evaluator_id,
                        models.EvalWorkUnit.config_fingerprint == self.fingerprint,
                        models.EvalWorkUnit.status == "EXPIRED",
                        models.EvalWorkUnit.error == STALE_FINGERPRINT_ERROR,
                    )
                ),
            ),
        )

    def sampled(self, span_ids: list[int]) -> list[int]:
        return [sid for sid in span_ids if sample_key(sid) < self.sampling_rate]


class OnlineEvalProducer(DaemonTask):
    """Materialize online-eval work from the span arrival log.

    For each evaluation target, ``produced_through_id`` is a position in the span arrival
    log; trace and session producers consume the same log before applying their
    readiness rules.
    """

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._evaluation_target: models.EvaluationTarget = "SPAN"
        self._tick_interval_seconds = tick_interval_seconds
        self._producer_id = f"producer-{token_hex(8)}"
        self._frontier_lag_seconds = get_env_online_eval_frontier_lag_seconds()
        self._backstop_interval_seconds = get_env_online_eval_backstop_interval_seconds()
        self._backstop_lookback_span_ids = get_env_online_eval_backstop_lookback_span_ids()
        self._max_span_ids_per_tick = get_env_online_eval_max_span_ids_per_tick()
        # Disabled by default because expiry is terminal and blocks backstop re-materialization.
        self._pending_ttl_seconds = get_env_online_eval_pending_ttl_seconds()
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._max_outstanding = get_env_online_eval_max_outstanding()
        self._last_backstop_at = time.monotonic()
        self._lease_held = False

    async def _run(self) -> None:
        try:
            while self._running:
                try:
                    await self._tick()
                except Exception:
                    logger.exception("Online-eval producer tick failed")
                await asyncio.sleep(self._tick_interval_seconds)
        finally:
            await self._release_lease()

    async def _tick(self) -> None:
        try:
            now = datetime.now(timezone.utc)
            cursor = await self._acquire_cursor(now)
            if cursor is None:
                return
            cursor = await self._clamp_cursor(cursor)
            if cursor is None:
                return
            produced_through_id = cursor.produced_through_id

            await self._reap(now, produced_through_id)
            await self._renew_lease(datetime.now(timezone.utc))

            observed_high_water_id = cursor.observed_high_water_id
            pending_observation = (
                observed_high_water_id is not None
                and cursor.observed_at is not None
                and observed_high_water_id > produced_through_id
            )
            frontier: Optional[int] = None
            if (
                pending_observation
                and observed_high_water_id is not None
                and cursor.observed_at is not None
                and (now - cursor.observed_at).total_seconds() >= self._frontier_lag_seconds
            ):
                frontier = min(
                    observed_high_water_id,
                    produced_through_id + self._max_span_ids_per_tick,
                )

            budget = await self._admission_budget()
            active = await self._load_active_criteria() if budget > 0 else []
            session_activity_project_ids = (
                await self._load_session_activity_project_ids() if budget > 0 else []
            )

            advanced = False
            if budget > 0 and frontier is not None:
                await self._renew_lease(datetime.now(timezone.utc))
                advanced, budget = await self._materialize_and_advance(
                    active,
                    session_activity_project_ids,
                    produced_through_id,
                    frontier,
                    budget,
                )
                if advanced:
                    produced_through_id = frontier

            observation_consumed = advanced and frontier == observed_high_water_id
            if not pending_observation or observation_consumed:
                await self._record_observation(produced_through_id)

            if budget > 0 and time.monotonic() - self._last_backstop_at >= (
                self._backstop_interval_seconds
            ):
                await self._renew_lease(datetime.now(timezone.utc))
                await self._backstop_sweep(active, produced_through_id, budget)
                self._last_backstop_at = time.monotonic()
        except _CursorLeaseLost:
            logger.warning("Online-eval producer tick aborted after losing its lease")

    async def _acquire_cursor(self, now: datetime) -> Optional[models.EvalWorkCursor]:
        stale = now - timedelta(seconds=CURSOR_LEASE_TTL_SECONDS)
        for _ in range(2):
            async with self._db() as session:
                cursor: Optional[models.EvalWorkCursor] = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                        models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                        or_(
                            models.EvalWorkCursor.claimed_by.is_(None),
                            models.EvalWorkCursor.claimed_by == self._producer_id,
                            models.EvalWorkCursor.claimed_at < stale,
                        ),
                    )
                    .values(claimed_by=self._producer_id, claimed_at=now)
                    .returning(models.EvalWorkCursor)
                )
            if cursor is not None:
                self._lease_held = True
                return cursor
            async with self._db() as session:
                row_exists = await session.scalar(
                    select(models.EvalWorkCursor.id).where(
                        models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                        models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                    )
                )
                if row_exists is not None:
                    break
                produced_through_id = await session.scalar(select(func.max(models.Span.id))) or 0
                await session.execute(
                    insert_on_conflict(
                        {
                            "evaluation_target": self._evaluation_target,
                            "consumer_group": _CONSUMER_GROUP,
                            "produced_through_id": produced_through_id,
                        },
                        table=models.EvalWorkCursor,
                        dialect=self._db.dialect,
                        unique_by=("evaluation_target", "consumer_group"),
                        on_conflict=OnConflict.DO_NOTHING,
                    )
                )
        self._lease_held = False
        return None

    async def _clamp_cursor(self, cursor: models.EvalWorkCursor) -> Optional[models.EvalWorkCursor]:
        async with self._db() as session:
            max_span_id = await session.scalar(select(func.max(models.Span.id))) or 0
            if max_span_id >= cursor.produced_through_id:
                return cursor
            clamped: Optional[models.EvalWorkCursor] = await session.scalar(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.id == cursor.id,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(
                    produced_through_id=max_span_id,
                    observed_high_water_id=None,
                    observed_at=None,
                )
                .returning(models.EvalWorkCursor)
            )
        if clamped is None:
            self._lease_held = False
            logger.warning("Online-eval producer lost its lease; cursor not clamped")
        return clamped

    async def _release_lease(self) -> None:
        if not self._lease_held:
            return
        self._lease_held = False
        try:
            async with self._db() as session:
                await session.execute(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                        models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                        models.EvalWorkCursor.claimed_by == self._producer_id,
                    )
                    .values(claimed_by=None, claimed_at=None)
                )
        except Exception:
            logger.exception("Failed to release online-eval producer lease")

    async def _renew_lease(self, now: datetime) -> None:
        async with self._db() as session:
            renewed = await session.scalar(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                    models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(claimed_at=now)
                .returning(models.EvalWorkCursor.id)
            )
        if renewed is None:
            self._lease_held = False
            raise _CursorLeaseLost

    async def _reap(self, now: datetime, produced_through_id: int) -> None:
        retention_cutoff = now - timedelta(seconds=self._retention_seconds)
        # Terminal rows inside the backstop lookback window are never deleted,
        # regardless of age — they must remain to block backstop resurrection.
        reap_floor = produced_through_id - self._backstop_lookback_span_ids
        async with self._db() as session:
            await session.execute(
                update(models.EvalWorkUnit)
                .where(
                    models.EvalWorkUnit.status == "RUNNING",
                    models.EvalWorkUnit.attempts >= MAX_ATTEMPTS - 1,
                    work_unit_lease_lapsed(now),
                )
                .values(
                    status="ERROR",
                    attempts=MAX_ATTEMPTS,
                    error=func.coalesce(
                        models.EvalWorkUnit.error,
                        "lease lapsed with attempts exhausted",
                    ),
                )
            )
            if self._pending_ttl_seconds > 0:
                pending_cutoff = now - timedelta(seconds=self._pending_ttl_seconds)
                await session.execute(
                    update(models.EvalWorkUnit)
                    .where(
                        models.EvalWorkUnit.status == "PENDING",
                        models.EvalWorkUnit.created_at < pending_cutoff,
                    )
                    .values(
                        status="EXPIRED",
                        error=func.coalesce(
                            models.EvalWorkUnit.error,
                            _PENDING_TTL_EXCEEDED_ERROR,
                        ),
                    )
                )
            await session.execute(
                delete(models.EvalWorkUnit).where(
                    models.EvalWorkUnit.status.in_(("DONE", "EXPIRED")),
                    models.EvalWorkUnit.updated_at < retention_cutoff,
                    models.EvalWorkUnit.span_rowid < reap_floor,
                )
            )
            await session.execute(
                delete(models.EvalWorkUnit).where(
                    models.EvalWorkUnit.status == "ERROR",
                    models.EvalWorkUnit.attempts >= MAX_ATTEMPTS,
                    models.EvalWorkUnit.updated_at < retention_cutoff,
                    models.EvalWorkUnit.span_rowid < reap_floor,
                )
            )

    async def _admission_budget(self) -> int:
        # The gate bounds the backlog that will eventually demand consumer
        # capacity — every non-terminal row, not just PENDING: RUNNING rows are
        # claimed but unfinished, and retryable ERROR rows return to the claim
        # pool after cooldown. Under a provider outage the entire pending
        # population migrates into retryable ERROR; a PENDING-only count would
        # see an empty queue and keep materializing into the outage. Exhausted
        # ERROR rows are terminal (awaiting the reaper) and excluded.
        async with self._db() as session:
            outstanding_count = (
                await session.scalar(
                    select(func.count())
                    .select_from(models.EvalWorkUnit)
                    .where(
                        or_(
                            models.EvalWorkUnit.status.in_(("PENDING", "RUNNING")),
                            and_(
                                models.EvalWorkUnit.status == "ERROR",
                                models.EvalWorkUnit.attempts < MAX_ATTEMPTS,
                            ),
                        )
                    )
                )
                or 0
            )
        budget = max(0, self._max_outstanding - outstanding_count)
        if budget == 0:
            logger.warning(
                f"Online-eval producer admission gate closed: "
                f"{outstanding_count} outstanding work units reached "
                f"{self._max_outstanding}"
            )
        return budget

    async def _load_active_criteria(self) -> list[_ActiveCriteria]:
        """Load and resolve enabled criteria into scan-ready form.

        Skip policy: only *persistent* per-criteria conditions (no resolvable
        version, filter fails to compile) are logged and skipped, so one bad
        criteria cannot stall the shared cursor forever. Anything else — e.g. a
        transient DB error during version resolution — propagates and aborts
        the tick without advancing the cursor (fail closed): advancing is an
        implicit claim that every enabled criteria either materialized or
        deliberately skipped the window, and a criteria that failed to load
        transiently did neither.
        """
        polymorphic_evaluator = with_polymorphic(
            models.Evaluator,
            [models.LLMEvaluator, models.CodeEvaluator, models.BuiltinEvaluator],
        )
        active: list[_ActiveCriteria] = []
        async with self._db() as session:
            rows = (
                await session.execute(
                    select(models.ProjectEvaluatorCriteria, polymorphic_evaluator)
                    .join(
                        polymorphic_evaluator,
                        models.ProjectEvaluatorCriteria.evaluator_id == polymorphic_evaluator.id,
                    )
                    .where(
                        models.ProjectEvaluatorCriteria.enabled,
                        models.ProjectEvaluatorCriteria.evaluation_target == "SPAN",
                    )
                )
            ).all()
            for criteria, evaluator in rows:
                # NOT wrapped in a per-criteria except: an unexpected exception
                # here (e.g. a transient DB error on a version lookup) must
                # abort the tick so the cursor cannot advance past a window
                # this criteria never scanned. See the docstring's skip policy.
                resolved = await resolve_criteria(session, criteria, evaluator)
                if resolved is None:
                    logger.warning(
                        f"Skipping criteria {criteria.id}: "
                        f"no resolvable version for evaluator {evaluator.id}"
                    )
                    continue
                try:
                    span_filter = SpanFilter(resolved.filter_condition)
                except Exception:
                    # SpanFilter construction is pure parsing (no I/O), so a
                    # failure here is deterministic — a persistent condition,
                    # same as an unresolvable version: skip-and-advance rather
                    # than stalling every other criteria on one bad DSL string.
                    logger.exception(
                        f"Skipping criteria {criteria.id}: filter_condition failed to compile"
                    )
                    continue
                fingerprint = config_fingerprint(resolved)
                active.append(
                    _ActiveCriteria(
                        criteria_id=criteria.id,
                        project_id=criteria.project_id,
                        evaluator_id=criteria.evaluator_id,
                        name=resolved.name,
                        sampling_rate=criteria.sampling_rate,
                        fingerprint=fingerprint,
                        identifier=annotation_identifier(fingerprint),
                        span_filter=span_filter,
                    )
                )
        return active

    async def _load_session_activity_project_ids(self) -> list[int]:
        async with self._db() as session:
            return list(
                await session.scalars(
                    select(models.ProjectEvaluatorCriteria.project_id)
                    .where(
                        models.ProjectEvaluatorCriteria.enabled,
                        models.ProjectEvaluatorCriteria.evaluation_target == "SESSION",
                        models.ProjectEvaluatorCriteria.filter_condition == "",
                        models.ProjectEvaluatorCriteria.sampling_rate == 1.0,
                    )
                    .distinct()
                )
            )

    async def _materialize_and_advance(
        self,
        active: list[_ActiveCriteria],
        session_activity_project_ids: list[int],
        low_exclusive: int,
        frontier: int,
        budget: int,
    ) -> tuple[bool, int]:
        async with self._db() as session:
            for index, criteria in enumerate(active):
                span_ids = list(
                    await session.scalars(
                        criteria.materializable_scan_stmt(low_exclusive, frontier)
                    )
                )
                sampled_span_ids = criteria.sampled(span_ids)
                admitted_span_ids = sampled_span_ids[:budget]
                await self._insert_work_units(session, criteria, admitted_span_ids)
                budget -= len(admitted_span_ids)
                if len(admitted_span_ids) < len(sampled_span_ids) or (
                    budget == 0 and index < len(active) - 1
                ):
                    logger.warning(
                        f"Online-eval producer frontier truncated at insertion budget; "
                        f"{budget} budget remaining"
                    )
                    await self._fence_mutating_session(session)
                    return False, budget
            # Session activity must commit atomically with the watermark advance:
            # recording it on a truncated (non-advancing) pass would re-bump
            # observed_at on every re-scan of the same window.
            await self._record_session_activity(
                session,
                session_activity_project_ids,
                low_exclusive,
                frontier,
            )
            advanced = await session.scalar(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                    models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(produced_through_id=frontier)
                .returning(models.EvalWorkCursor.id)
            )
            if advanced is None:
                self._lease_held = False
                raise _CursorLeaseLost
        return True, budget

    async def _record_session_activity(
        self,
        session: AsyncSession,
        project_ids: list[int],
        low_exclusive: int,
        frontier: int,
    ) -> None:
        if not project_ids:
            return
        rows = (
            await session.execute(
                select(
                    models.Trace.project_session_rowid,
                    func.max(models.Span.id),
                )
                .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                .where(
                    models.Span.id > low_exclusive,
                    models.Span.id <= frontier,
                    models.Trace.project_rowid.in_(project_ids),
                    models.Trace.project_session_rowid.is_not(None),
                )
                .group_by(models.Trace.project_session_rowid)
            )
        ).all()
        records = [
            {
                "project_session_rowid": project_session_rowid,
                "last_seen_span_rowid": last_seen_span_rowid,
                "observed_at": func.now(),
            }
            for project_session_rowid, last_seen_span_rowid in rows
            if project_session_rowid is not None and last_seen_span_rowid is not None
        ]
        for start in range(0, len(records), _INSERT_BATCH_SIZE):
            await session.execute(
                insert_on_conflict(
                    *records[start : start + _INSERT_BATCH_SIZE],
                    table=models.EvalSessionActivity,
                    dialect=self._db.dialect,
                    unique_by=_SESSION_ACTIVITY_UNIQUE_BY,
                    on_conflict=OnConflict.DO_UPDATE,
                )
            )

    async def _record_observation(self, produced_through_id: int) -> None:
        async with self._db() as session:
            high_water = await session.scalar(select(func.max(models.Span.id)))
            if high_water is None or high_water <= produced_through_id:
                return
            # Stamp the observation with a timestamp taken AFTER the high-water
            # read, never the tick-start time: the reap/gate/materialize work
            # preceding this call can consume a large fraction of the frontier
            # lag (unboundedly so on a first-run backfill), and a stale stamp
            # makes the next tick over-age the observation — eroding the
            # commit-visibility guard that is the only defense against the
            # id-vs-commit-order race. A post-read stamp errs conservative.
            observed_at = datetime.now(timezone.utc)
            await session.execute(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                    models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(observed_high_water_id=high_water, observed_at=observed_at)
            )

    async def _backstop_sweep(
        self,
        active: list[_ActiveCriteria],
        watermark: int,
        budget: int,
    ) -> int:
        if watermark <= 0:
            return budget
        # Window is [watermark - lookback, watermark], matching the reaper's floor
        # exactly so every retained terminal row is inside the swept range.
        low_exclusive = max(watermark - self._backstop_lookback_span_ids - 1, 0)
        async with self._db() as session:
            for index, criteria in enumerate(active):
                stmt = criteria.materializable_scan_stmt(low_exclusive, watermark)
                span_ids = list(await session.scalars(stmt))
                sampled_span_ids = criteria.sampled(span_ids)
                admitted_span_ids = sampled_span_ids[:budget]
                await self._insert_work_units(session, criteria, admitted_span_ids)
                budget -= len(admitted_span_ids)
                if len(admitted_span_ids) < len(sampled_span_ids) or (
                    budget == 0 and index < len(active) - 1
                ):
                    logger.warning(
                        f"Online-eval producer backstop truncated at insertion budget; "
                        f"{budget} budget remaining"
                    )
                    break
            await self._fence_mutating_session(session)
        return budget

    async def _fence_mutating_session(self, session: AsyncSession) -> None:
        renewed = await session.scalar(
            update(models.EvalWorkCursor)
            .where(
                models.EvalWorkCursor.evaluation_target == self._evaluation_target,
                models.EvalWorkCursor.consumer_group == _CONSUMER_GROUP,
                models.EvalWorkCursor.claimed_by == self._producer_id,
            )
            .values(claimed_at=datetime.now(timezone.utc))
            .returning(models.EvalWorkCursor.id)
        )
        if renewed is None:
            self._lease_held = False
            raise _CursorLeaseLost

    async def _insert_work_units(
        self,
        session: AsyncSession,
        criteria: _ActiveCriteria,
        span_ids: list[int],
    ) -> None:
        records = [
            {
                "span_rowid": span_rowid,
                "evaluator_id": criteria.evaluator_id,
                "criteria_id": criteria.criteria_id,
                "config_fingerprint": criteria.fingerprint,
            }
            for span_rowid in span_ids
        ]
        for start in range(0, len(records), _INSERT_BATCH_SIZE):
            batch = records[start : start + _INSERT_BATCH_SIZE]
            batch_span_ids = [record["span_rowid"] for record in batch]
            await session.execute(
                update(models.EvalWorkUnit)
                .where(
                    models.EvalWorkUnit.span_rowid.in_(batch_span_ids),
                    models.EvalWorkUnit.evaluator_id == criteria.evaluator_id,
                    models.EvalWorkUnit.config_fingerprint == criteria.fingerprint,
                    models.EvalWorkUnit.status == "EXPIRED",
                    models.EvalWorkUnit.error == STALE_FINGERPRINT_ERROR,
                    ~exists(
                        select(1).where(
                            models.SpanAnnotation.span_rowid == models.EvalWorkUnit.span_rowid,
                            models.SpanAnnotation.name == criteria.name,
                            models.SpanAnnotation.identifier == criteria.identifier,
                        )
                    ),
                )
                .values(
                    status="PENDING",
                    attempts=0,
                    error=None,
                    claimed_by=None,
                    claimed_at=None,
                    cooldown_until=None,
                )
            )
            await session.execute(
                insert_on_conflict(
                    *batch,
                    table=models.EvalWorkUnit,
                    dialect=self._db.dialect,
                    unique_by=_WORK_UNIT_UNIQUE_BY,
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
