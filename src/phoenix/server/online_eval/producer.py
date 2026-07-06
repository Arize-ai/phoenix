"""Online-eval producer daemon.

Materializes span-grain eval work units from enabled project evaluator criteria.
The producer runs on every replica but self-elects each tick via the
``eval_work_cursors`` CAS lease, so exactly one replica per (grain, consumer_group)
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
    get_env_online_eval_max_pending,
    get_env_online_eval_pending_ttl_seconds,
    get_env_online_eval_retention_seconds,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.online_eval.db_coordinator import MAX_ATTEMPTS
from phoenix.server.online_eval.derivation import (
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
        input_mapping = evaluator.input_mapping.model_dump()
    elif isinstance(evaluator, models.BuiltinEvaluator):
        version_ref = [evaluator.key, evaluator.synced_at.isoformat()]
    else:
        return None
    if version_ref is None:
        return None
    return ResolvedCriteria(
        criteria_id=criteria.id,
        annotation_name=criteria.name.root,
        evaluator_id=evaluator.id,
        version_ref=version_ref,
        output_configs=[config.model_dump() for config in evaluator.output_configs],
        input_mapping=input_mapping,
        filter_condition=criteria.filter_condition,
        sampling_rate=criteria.sampling_rate,
    )


@dataclass(frozen=True)
class _ActiveCriteria:
    criteria_id: int
    project_id: int
    evaluator_id: int
    annotation_name: str
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

    def sampled(self, span_ids: list[int]) -> list[int]:
        return [sid for sid in span_ids if sample_key(sid) < self.sampling_rate]


class OnlineEvalProducer(DaemonTask):
    """Single-active-producer daemon materializing online-eval work units."""

    def __init__(
        self,
        db: DbSessionFactory,
        *,
        consumer_group: str = "default",
        tick_interval_seconds: float = TICK_INTERVAL_SECONDS,
    ) -> None:
        super().__init__()
        self._db = db
        self._grain: models.EvalWorkGrain = "SPAN"
        self._consumer_group = consumer_group
        self._tick_interval_seconds = tick_interval_seconds
        self._producer_id = f"producer-{token_hex(8)}"
        self._frontier_lag_seconds = get_env_online_eval_frontier_lag_seconds()
        self._backstop_interval_seconds = get_env_online_eval_backstop_interval_seconds()
        self._backstop_lookback_span_ids = get_env_online_eval_backstop_lookback_span_ids()
        self._pending_ttl_seconds = get_env_online_eval_pending_ttl_seconds()
        self._retention_seconds = get_env_online_eval_retention_seconds()
        self._max_pending = get_env_online_eval_max_pending()
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
        now = datetime.now(timezone.utc)
        if not await self._acquire_lease(now):
            return
        cursor = await self._read_cursor()
        if cursor is None:
            return
        produced_through = cursor.produced_through_id

        await self._reap(now, produced_through)

        pending_observation = (
            cursor.observed_high_water_id is not None
            and cursor.observed_at is not None
            and cursor.observed_high_water_id > produced_through
        )
        frontier: Optional[int] = None
        if (
            pending_observation
            and cursor.observed_at is not None
            and (now - cursor.observed_at).total_seconds() >= self._frontier_lag_seconds
        ):
            frontier = cursor.observed_high_water_id

        gate_open = await self._admission_gate_open()
        active = await self._load_active_criteria() if gate_open else []

        advanced = False
        if gate_open and frontier is not None:
            advanced = await self._materialize_and_advance(active, produced_through, frontier)
            if advanced:
                produced_through = frontier

        if not pending_observation or advanced:
            await self._record_observation(produced_through, now)

        if gate_open and time.monotonic() - self._last_backstop_at >= (
            self._backstop_interval_seconds
        ):
            self._last_backstop_at = time.monotonic()
            await self._backstop_sweep(active, produced_through)

    async def _acquire_lease(self, now: datetime) -> bool:
        stale = now - timedelta(seconds=CURSOR_LEASE_TTL_SECONDS)
        for _ in range(2):
            async with self._db() as session:
                claimed = await session.scalar(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.grain == self._grain,
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        or_(
                            models.EvalWorkCursor.claimed_by.is_(None),
                            models.EvalWorkCursor.claimed_by == self._producer_id,
                            models.EvalWorkCursor.claimed_at < stale,
                        ),
                    )
                    .values(claimed_by=self._producer_id, claimed_at=now)
                    .returning(models.EvalWorkCursor.id)
                )
            if claimed is not None:
                self._lease_held = True
                return True
            async with self._db() as session:
                row_exists = await session.scalar(
                    select(models.EvalWorkCursor.id).where(
                        models.EvalWorkCursor.grain == self._grain,
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                    )
                )
                if row_exists is not None:
                    break
                await session.execute(
                    insert_on_conflict(
                        {
                            "grain": self._grain,
                            "consumer_group": self._consumer_group,
                            "produced_through_id": 0,
                        },
                        table=models.EvalWorkCursor,
                        dialect=self._db.dialect,
                        unique_by=("grain", "consumer_group"),
                        on_conflict=OnConflict.DO_NOTHING,
                    )
                )
        self._lease_held = False
        return False

    async def _release_lease(self) -> None:
        if not self._lease_held:
            return
        self._lease_held = False
        try:
            async with self._db() as session:
                await session.execute(
                    update(models.EvalWorkCursor)
                    .where(
                        models.EvalWorkCursor.grain == self._grain,
                        models.EvalWorkCursor.consumer_group == self._consumer_group,
                        models.EvalWorkCursor.claimed_by == self._producer_id,
                    )
                    .values(claimed_by=None, claimed_at=None)
                )
        except Exception:
            logger.exception("Failed to release online-eval producer lease")

    async def _read_cursor(self) -> Optional[models.EvalWorkCursor]:
        async with self._db() as session:
            cursor: Optional[models.EvalWorkCursor] = await session.scalar(
                select(models.EvalWorkCursor).where(
                    models.EvalWorkCursor.grain == self._grain,
                    models.EvalWorkCursor.consumer_group == self._consumer_group,
                )
            )
        return cursor

    async def _reap(self, now: datetime, produced_through_id: int) -> None:
        pending_cutoff = now - timedelta(seconds=self._pending_ttl_seconds)
        retention_cutoff = now - timedelta(seconds=self._retention_seconds)
        # Terminal rows inside the backstop lookback window are never deleted,
        # regardless of age — they must remain to block backstop resurrection.
        reap_floor = produced_through_id - self._backstop_lookback_span_ids
        async with self._db() as session:
            await session.execute(
                update(models.EvalWorkUnit)
                .where(
                    models.EvalWorkUnit.status == "PENDING",
                    models.EvalWorkUnit.created_at < pending_cutoff,
                )
                .values(status="EXPIRED")
            )
            await session.execute(
                delete(models.EvalWorkUnit).where(
                    or_(
                        models.EvalWorkUnit.status.in_(("DONE", "EXPIRED")),
                        and_(
                            models.EvalWorkUnit.status == "ERROR",
                            models.EvalWorkUnit.attempts >= MAX_ATTEMPTS,
                        ),
                    ),
                    models.EvalWorkUnit.updated_at < retention_cutoff,
                    models.EvalWorkUnit.span_rowid < reap_floor,
                )
            )

    async def _admission_gate_open(self) -> bool:
        async with self._db() as session:
            pending_count = (
                await session.scalar(
                    select(func.count())
                    .select_from(models.EvalWorkUnit)
                    .where(models.EvalWorkUnit.status == "PENDING")
                )
                or 0
            )
        if pending_count > self._max_pending:
            logger.warning(
                f"Online-eval producer admission gate closed: "
                f"{pending_count} pending work units exceeds {self._max_pending}"
            )
            return False
        return True

    async def _load_active_criteria(self) -> list[_ActiveCriteria]:
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
                    .where(models.ProjectEvaluatorCriteria.enabled)
                )
            ).all()
            for criteria, evaluator in rows:
                try:
                    resolved = await resolve_criteria(session, criteria, evaluator)
                    if resolved is None:
                        logger.warning(
                            f"Skipping criteria {criteria.id}: "
                            f"no resolvable version for evaluator {evaluator.id}"
                        )
                        continue
                    span_filter = SpanFilter(resolved.filter_condition)
                except Exception:
                    logger.exception(f"Skipping criteria {criteria.id}")
                    continue
                fingerprint = config_fingerprint(resolved)
                active.append(
                    _ActiveCriteria(
                        criteria_id=criteria.id,
                        project_id=criteria.project_id,
                        evaluator_id=criteria.evaluator_id,
                        annotation_name=resolved.annotation_name,
                        sampling_rate=criteria.sampling_rate,
                        fingerprint=fingerprint,
                        identifier=annotation_identifier(fingerprint),
                        span_filter=span_filter,
                    )
                )
        return active

    async def _materialize_and_advance(
        self,
        active: list[_ActiveCriteria],
        low_exclusive: int,
        frontier: int,
    ) -> bool:
        async with self._db() as session:
            for criteria in active:
                span_ids = list(await session.scalars(criteria.scan_stmt(low_exclusive, frontier)))
                await self._insert_work_units(session, criteria, criteria.sampled(span_ids))
            advanced = await session.scalar(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.grain == self._grain,
                    models.EvalWorkCursor.consumer_group == self._consumer_group,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(produced_through_id=frontier)
                .returning(models.EvalWorkCursor.id)
            )
        if advanced is None:
            logger.warning("Online-eval producer lost its lease; watermark not advanced")
            return False
        return True

    async def _record_observation(self, produced_through_id: int, now: datetime) -> None:
        async with self._db() as session:
            high_water = await session.scalar(select(func.max(models.Span.id)))
            if high_water is None or high_water <= produced_through_id:
                return
            await session.execute(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.grain == self._grain,
                    models.EvalWorkCursor.consumer_group == self._consumer_group,
                    models.EvalWorkCursor.claimed_by == self._producer_id,
                )
                .values(observed_high_water_id=high_water, observed_at=now)
            )

    async def _backstop_sweep(self, active: list[_ActiveCriteria], watermark: int) -> None:
        if watermark <= 0:
            return
        # Window is [watermark - lookback, watermark], matching the reaper's floor
        # exactly so every retained terminal row is inside the swept range.
        low_exclusive = max(watermark - self._backstop_lookback_span_ids - 1, 0)
        async with self._db() as session:
            for criteria in active:
                stmt = criteria.scan_stmt(low_exclusive, watermark).where(
                    ~exists(
                        select(1).where(
                            models.SpanAnnotation.span_rowid == models.Span.id,
                            models.SpanAnnotation.name == criteria.annotation_name,
                            models.SpanAnnotation.identifier == criteria.identifier,
                        )
                    ),
                    ~exists(
                        select(1).where(
                            models.EvalWorkUnit.span_rowid == models.Span.id,
                            models.EvalWorkUnit.evaluator_id == criteria.evaluator_id,
                            models.EvalWorkUnit.config_fingerprint == criteria.fingerprint,
                        )
                    ),
                )
                span_ids = list(await session.scalars(stmt))
                await self._insert_work_units(session, criteria, criteria.sampled(span_ids))

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
            await session.execute(
                insert_on_conflict(
                    *records[start : start + _INSERT_BATCH_SIZE],
                    table=models.EvalWorkUnit,
                    dialect=self._db.dialect,
                    unique_by=_WORK_UNIT_UNIQUE_BY,
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
