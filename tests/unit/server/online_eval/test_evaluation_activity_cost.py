"""The evaluator activity's cost: the same totals and per-bin costs as joining the project
evaluators to their trace projects' costs, read without that join."""

from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union

import sqlalchemy as sa
from pytest import approx

from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.online_eval.evaluation_activity import (
    ActivityBinGroup,
    ActivityGroup,
    load_evaluation_activity,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span
from .test_span_producer import _seed_code_criteria, _seed_criteria

_NOON = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
_HOURLY = TimeBucketSpec()


def _at(hour: int, minute: int = 0) -> datetime:
    return _NOON.replace(hour=hour, minute=minute)


async def _seed_evaluator_costs(db: DbSessionFactory) -> tuple[int, int]:
    """Two projects whose evaluators' trace projects hold every case the cost read must
    match: costs in two bins, a cost row without a cost, traces without cost rows, no traces,
    traces outside the range, two evaluators sharing a trace project, and tracing off."""
    async with db() as session:
        first, second = await _add_project(session), await _add_project(session)
    with_costs = (await _seed_criteria(db, first.id))[1]
    without_cost_value = (await _seed_code_criteria(db, first.id))[1]
    without_cost_rows = (await _seed_criteria(db, first.id))[1]
    await _seed_criteria(db, first.id)
    sharing = (await _seed_criteria(db, first.id))[1]
    tracing_off = (await _seed_criteria(db, first.id))[1]
    other_project = (await _seed_criteria(db, second.id))[1]
    async with db() as session:
        evaluators = {
            project_evaluator.id: project_evaluator
            for project_evaluator in await session.scalars(sa.select(models.ProjectEvaluator))
        }
        evaluators[sharing].trace_project_id = evaluators[with_costs].trace_project_id
        evaluators[tracing_off].tracing_enabled = False
        await session.flush()
        for project_evaluator_id, started_at, costs in (
            (with_costs, _at(12, 30), (0.5, 0.25)),
            (with_costs, _at(14, 10), (1.0,)),
            (with_costs, _at(11), (100.0,)),
            (with_costs, _at(15), (100.0,)),
            (without_cost_value, _at(13, 15), (None,)),
            (without_cost_rows, _at(13, 20), ()),
            (tracing_off, _at(12, 5), (0.125,)),
            (other_project, _at(13, 45), (2.0, 4.0)),
        ):
            evaluator_trace = models.Trace(
                trace_id=f"{project_evaluator_id}-{started_at.isoformat()}",
                project_rowid=evaluators[project_evaluator_id].trace_project_id,
                start_time=started_at,
                end_time=started_at + timedelta(seconds=1),
            )
            session.add(evaluator_trace)
            await session.flush()
            for cost in costs:
                span = await _add_span(session, evaluator_trace, start_time=started_at)
                session.add(
                    models.SpanCost(
                        span_rowid=span.id,
                        trace_rowid=evaluator_trace.id,
                        span_start_time=started_at,
                        total_cost=cost,
                    )
                )
    return first.id, second.id


async def _costs_joined_from_evaluators(
    db: DbSessionFactory, project_id: Optional[int]
) -> tuple[dict[int, float], dict[tuple[int, datetime], float]]:
    """Each group's cost and its cost per bin, read the way the activity read them before
    reading trace projects directly: joined from the project evaluators in scope."""
    trace, project_evaluator = models.Trace, models.ProjectEvaluator
    group = project_evaluator.project_id if project_id is None else project_evaluator.id
    bucket = _HOURLY.truncate(db.dialect, trace.start_time)
    scope = sa.select(project_evaluator.id)
    if project_id is not None:
        scope = scope.where(project_evaluator.project_id == project_id)
    totals: dict[int, float] = {}
    bins: dict[tuple[int, datetime], float] = {}
    async with db() as session:
        for key, timestamp, cost in await session.execute(
            sa.select(group, bucket, sa.func.sum(models.SpanCost.total_cost))
            .select_from(project_evaluator)
            .join(trace, trace.project_rowid == project_evaluator.trace_project_id)
            .join(models.SpanCost, models.SpanCost.trace_rowid == trace.id)
            .where(
                project_evaluator.id.in_(scope),
                trace.start_time >= _at(12),
                trace.start_time < _at(15),
            )
            .group_by(group, bucket)
        ):
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp)
            bin_start = normalize_datetime(timestamp, timezone.utc)
            assert bin_start is not None
            bins[(key, bin_start)] = float(cost or 0)
            totals[key] = totals.get(key, 0) + float(cost or 0)
    return totals, bins


async def test_cost_equals_the_evaluator_join_and_is_read_by_trace_project(
    db: DbSessionFactory,
) -> None:
    """The cost the evaluator charts show, per group and per bin, equals what joining the
    evaluators to their trace projects' costs gives, for a project and for the server; the
    read names the trace projects instead of joining the evaluators."""
    first_project_id, _ = await _seed_evaluator_costs(db)
    cost_reads: list[str] = []

    def record_cost_read(
        _conn: Any, _cursor: Any, statement: str, *_args: Any, **_kwargs: Any
    ) -> None:
        if models.SpanCost.__tablename__ in statement:
            cost_reads.append(statement)

    for project_id in (first_project_id, None):
        cost_reads.clear()
        async with db() as session:
            bind = session.get_bind()
        sa.event.listen(bind, "before_cursor_execute", record_cost_read)
        try:
            activity = await load_evaluation_activity(
                db, project_id=project_id, start=_at(12), end=_at(15), time_bins=_HOURLY
            )
        finally:
            sa.event.remove(bind, "before_cursor_execute", record_cost_read)
        expected_totals, expected_bins = await _costs_joined_from_evaluators(db, project_id)

        def key(group: Union[ActivityGroup, ActivityBinGroup]) -> int:
            group_key = group.project_id if project_id is None else group.project_evaluator_id
            assert group_key is not None
            return group_key

        assert {key(group): group.cost for group in activity.groups} == {
            key(group): (
                approx(expected_totals[key(group)]) if key(group) in expected_totals else None
            )
            for group in activity.groups
        }
        assert {
            (key(group), activity_bin.timestamp): group.cost
            for activity_bin in activity.series
            for group in activity_bin.groups
            if group.cost is not None
        } == {bin_key: approx(cost) for bin_key, cost in expected_bins.items()}
        assert len(cost_reads) == 1
        assert models.ProjectEvaluator.__tablename__ not in cost_reads[0]
