from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.online_eval.evaluation_activity import (
    ActivityBinGroup,
    ActivityGroup,
    EvaluationLag,
    load_evaluation_activity,
    load_evaluation_lags,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_producer import _seed_criteria

_NOON = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
_HOURLY = TimeBucketSpec()


def _at(hour: int, minute: int = 0) -> datetime:
    return _NOON.replace(hour=hour, minute=minute)


def _approx(value: float) -> Any:
    return pytest.approx(value)


def _lag(p50: float, p95: float, p99: float) -> EvaluationLag:
    return EvaluationLag(
        p50_seconds=_approx(p50), p95_seconds=_approx(p95), p99_seconds=_approx(p99)
    )


@dataclass(frozen=True)
class _Seeded:
    first_project_id: int
    second_project_id: int
    span_evaluator_id: int
    trace_evaluator_id: int
    session_evaluator_id: int


async def _seed(db: DbSessionFactory) -> _Seeded:
    """Two projects: the first with a span and a trace evaluator, the second with a session
    evaluator. Times are on 2026-10-01; queued -> result in each comment."""
    async with db() as session:
        first, second = await _add_project(session), await _add_project(session)
    _, span_evaluator_id = await _seed_criteria(db, first.id)
    _, trace_evaluator_id = await _seed_criteria(db, first.id, evaluation_target="TRACE")
    _, session_evaluator_id = await _seed_criteria(db, second.id, evaluation_target="SESSION")

    async with db() as session:
        trace = await _add_trace(session, first)

        async def span_unit(
            status: str, created_at: datetime, updated_at: Optional[datetime] = None
        ) -> models.EvalWorkUnit:
            return models.EvalWorkUnit(
                span_rowid=(await _add_span(session, trace)).id,
                project_evaluator_id=span_evaluator_id,
                status=status,
                created_at=created_at,
                updated_at=updated_at or created_at,
            )

        async def trace_unit(
            status: str, created_at: datetime, updated_at: Optional[datetime] = None
        ) -> models.EvalTraceWorkUnit:
            return models.EvalTraceWorkUnit(
                trace_rowid=(await _add_trace(session, first)).id,
                project_evaluator_id=trace_evaluator_id,
                evaluated_through=created_at,
                status=status,
                created_at=created_at,
                updated_at=updated_at or created_at,
            )

        async def session_unit(
            status: str, created_at: datetime, updated_at: datetime
        ) -> models.EvalSessionWorkUnit:
            return models.EvalSessionWorkUnit(
                project_session_rowid=(await _add_project_session(session, second)).id,
                project_evaluator_id=session_evaluator_id,
                evaluated_through=created_at,
                status=status,
                created_at=created_at,
                updated_at=updated_at,
            )

        session.add_all(
            [
                await span_unit("DONE", _at(11, 50), _at(12, 10)),  # 1200 s
                await span_unit("DONE", _at(12, 20), _at(13, 5)),  # 2700 s
                await span_unit("FAILED", _at(13, 10), _at(13, 20)),  # 600 s
                await span_unit("PENDING", _at(14, 30)),
                await span_unit("RUNNING", _at(11)),
                # Cleared before it ran: in the queue for 10 minutes, but never evaluated.
                await span_unit("DROPPED", _at(12, 40), _at(12, 50)),
                await trace_unit("DONE", _at(12, 5), _at(12, 15)),  # 600 s
                # Declined when scheduled: never in the queue.
                await trace_unit("SAMPLED_OUT", _at(12, 30)),
                await trace_unit("ERROR", _at(14, 10)),
                await session_unit("EXPIRED", _at(13, 30), _at(14, 30)),  # 3600 s
                # Completed after the range.
                await session_unit("DONE", _at(15, 30), _at(15, 40)),
            ]
        )
        await session.flush()

        trace_project_ids = {
            project_evaluator.id: project_evaluator.trace_project_id
            for project_evaluator in [
                await session.get_one(models.ProjectEvaluator, span_evaluator_id),
                await session.get_one(models.ProjectEvaluator, session_evaluator_id),
            ]
        }
        for project_evaluator_id, started_at, costs in (
            (span_evaluator_id, _at(12, 30), (0.5, 0.25)),
            (span_evaluator_id, _at(14, 10), (1.0,)),
            (span_evaluator_id, _at(11), (100.0,)),
            (session_evaluator_id, _at(13, 15), (2.0,)),
        ):
            evaluator_trace = models.Trace(
                trace_id=f"{project_evaluator_id}-{started_at.isoformat()}",
                project_rowid=trace_project_ids[project_evaluator_id],
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
    return _Seeded(
        first_project_id=first.id,
        second_project_id=second.id,
        span_evaluator_id=span_evaluator_id,
        trace_evaluator_id=trace_evaluator_id,
        session_evaluator_id=session_evaluator_id,
    )


async def test_lag_percentiles_over_evaluations_that_ran(db: DbSessionFactory) -> None:
    seeded = await _seed(db)
    lags = await load_evaluation_lags(
        db,
        [seeded.span_evaluator_id, seeded.trace_evaluator_id, seeded.session_evaluator_id],
        _at(12),
        _at(15),
    )
    assert lags == {
        # 600, 1200, 2700: the DROPPED, queued, and running evaluations have no lag.
        seeded.span_evaluator_id: _lag(1200, 2550, 2670),
        seeded.trace_evaluator_id: _lag(600, 600, 600),
        seeded.session_evaluator_id: _lag(3600, 3600, 3600),
    }
    # Completed at 13:05 and 13:20; the range end is exclusive.
    assert await load_evaluation_lags(db, [seeded.span_evaluator_id], _at(13), _at(13, 20)) == {
        seeded.span_evaluator_id: _lag(2700, 2700, 2700)
    }


async def test_project_activity_is_grouped_by_evaluator(db: DbSessionFactory) -> None:
    seeded = await _seed(db)
    activity = await load_evaluation_activity(
        db, project_id=seeded.first_project_id, start=_at(12), end=_at(15), time_bins=_HOURLY
    )
    project_id = seeded.first_project_id
    span, trace = seeded.span_evaluator_id, seeded.trace_evaluator_id

    assert (activity.evaluated_count, activity.failed_count) == (3, 1)
    assert activity.lag == _lag(900, 2475, 2655)
    assert activity.cost == _approx(1.75)
    assert activity.groups == (
        ActivityGroup(project_id, span, 2, 1, _lag(1200, 2550, 2670), _approx(1.75)),
        ActivityGroup(project_id, trace, 1, 0, _lag(600, 600, 600), None),
    )
    assert [activity_bin.timestamp for activity_bin in activity.series] == [
        _at(12),
        _at(13),
        _at(14),
    ]
    assert [activity_bin.groups for activity_bin in activity.series] == [
        (
            ActivityBinGroup(project_id, span, 1, 0, 2, _approx(1200), _approx(0.75), 2),
            ActivityBinGroup(project_id, trace, 1, 0, 1, _approx(600), None, 0),
        ),
        (ActivityBinGroup(project_id, span, 1, 1, 1, _approx(2595), None, 1),),
        (
            ActivityBinGroup(project_id, span, 0, 0, 1, None, _approx(1.0), 2),
            ActivityBinGroup(project_id, trace, 0, 0, 1, None, None, 1),
        ),
    ]


async def test_server_activity_is_grouped_by_project(db: DbSessionFactory) -> None:
    seeded = await _seed(db)
    activity = await load_evaluation_activity(
        db, project_id=None, start=_at(12), end=_at(15), time_bins=_HOURLY
    )
    first, second = seeded.first_project_id, seeded.second_project_id

    assert (activity.evaluated_count, activity.failed_count) == (3, 2)
    assert activity.lag == _lag(1200, 3420, 3564)
    assert activity.cost == _approx(3.75)
    assert activity.groups == (
        ActivityGroup(first, None, 3, 1, _lag(900, 2475, 2655), _approx(1.75)),
        ActivityGroup(second, None, 0, 1, _lag(3600, 3600, 3600), _approx(2.0)),
    )
    assert [activity_bin.groups for activity_bin in activity.series] == [
        (ActivityBinGroup(first, None, 2, 0, 3, _approx(1170), _approx(0.75), 2),),
        (
            ActivityBinGroup(first, None, 1, 1, 1, _approx(2595), None, 1),
            ActivityBinGroup(second, None, 0, 0, 1, None, _approx(2.0), 1),
        ),
        (
            ActivityBinGroup(first, None, 0, 0, 2, None, _approx(1.0), 3),
            ActivityBinGroup(second, None, 0, 1, 0, _approx(3600), None, 0),
        ),
    ]


@pytest.mark.parametrize(
    "time_bins",
    [
        pytest.param(TimeBucketSpec(unit="minute", units_per_bin=30), id="30-minute"),
        pytest.param(TimeBucketSpec(unit="hour", utc_offset_minutes=330), id="hour-utc+5:30"),
        pytest.param(TimeBucketSpec(unit="day", utc_offset_minutes=-300), id="day-utc-5"),
    ],
)
async def test_activity_bins_follow_the_time_bin_config(
    db: DbSessionFactory, time_bins: TimeBucketSpec
) -> None:
    seeded = await _seed(db)
    activity = await load_evaluation_activity(
        db, project_id=seeded.first_project_id, start=_at(12), end=_at(15), time_bins=time_bins
    )
    assert [activity_bin.timestamp for activity_bin in activity.series] == list(
        time_bins.timestamps(_at(12), _at(15))
    )
    bin_groups = [group for activity_bin in activity.series for group in activity_bin.groups]
    assert sum(group.evaluated_count for group in bin_groups) == activity.evaluated_count == 3
    assert sum(group.failed_count for group in bin_groups) == activity.failed_count == 1
    # Queued in the range: two span evaluations at 12:20 and 12:40, one at 13:10 and one at
    # 14:30; trace evaluations at 12:05 and 14:10.
    assert sum(group.queued_count for group in bin_groups) == 6
    assert sum(group.cost or 0 for group in bin_groups) == _approx(1.75)
    # Queued or running at 15:00: one PENDING and one RUNNING span evaluation, one trace
    # evaluation awaiting a retry.
    assert {
        group.project_evaluator_id: group.queue_size for group in activity.series[-1].groups
    } == {seeded.span_evaluator_id: 2, seeded.trace_evaluator_id: 1}


async def test_activity_over_an_empty_range(db: DbSessionFactory) -> None:
    seeded = await _seed(db)
    activity = await load_evaluation_activity(
        db, project_id=seeded.first_project_id, start=_at(10), end=_at(11), time_bins=_HOURLY
    )
    assert (activity.evaluated_count, activity.failed_count) == (0, 0)
    assert (activity.lag, activity.cost) == (None, None)
    assert [(group.project_evaluator_id, group.evaluated_count) for group in activity.groups] == [
        (seeded.span_evaluator_id, 0),
        (seeded.trace_evaluator_id, 0),
    ]
    assert [(activity_bin.timestamp, activity_bin.groups) for activity_bin in activity.series] == [
        (_at(10), ())
    ]


async def test_evaluation_activity_graphql(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    seeded = await _seed(db)
    time_range = {"start": _at(12).isoformat(), "end": _at(15).isoformat()}
    response = await gql_client.execute(
        """query ($projectId: ID!, $timeRange: TimeRange!) {
            evaluationActivity(timeRange: $timeRange) {
                evaluatedCount
                groups { project { id } projectEvaluator { id } }
            }
            project: node(id: $projectId) {
                ... on Project {
                    evaluationActivity(timeRange: $timeRange, timeBinConfig: {scale: HOUR}) {
                        evaluatedCount
                        failedCount
                        lag { p50Seconds p95Seconds p99Seconds }
                        cost
                        groups { projectEvaluator { id } evaluatedCount failedCount cost }
                        series {
                            timestamp
                            groups {
                                projectEvaluator { id }
                                queuedCount
                                queueSize
                                lagP95Seconds
                            }
                        }
                    }
                }
            }
        }""",
        {
            "projectId": str(GlobalID("Project", str(seeded.first_project_id))),
            "timeRange": time_range,
        },
    )
    assert not response.errors and response.data
    span = str(GlobalID("ProjectEvaluator", str(seeded.span_evaluator_id)))
    trace = str(GlobalID("ProjectEvaluator", str(seeded.trace_evaluator_id)))

    server = response.data["evaluationActivity"]
    assert server["evaluatedCount"] == 3
    assert server["groups"] == [
        {"project": {"id": str(GlobalID("Project", str(project_id)))}, "projectEvaluator": None}
        for project_id in (seeded.first_project_id, seeded.second_project_id)
    ]

    project: dict[str, Any] = response.data["project"]["evaluationActivity"]
    assert project["lag"] == {
        "p50Seconds": _approx(900),
        "p95Seconds": _approx(2475),
        "p99Seconds": _approx(2655),
    }
    assert (project["evaluatedCount"], project["failedCount"]) == (3, 1)
    assert project["cost"] == _approx(1.75)
    assert project["groups"] == [
        {"projectEvaluator": {"id": span}, "evaluatedCount": 2, "failedCount": 1, "cost": 1.75},
        {"projectEvaluator": {"id": trace}, "evaluatedCount": 1, "failedCount": 0, "cost": None},
    ]
    assert [
        datetime.fromisoformat(activity_bin["timestamp"]) for activity_bin in project["series"]
    ] == [_at(12), _at(13), _at(14)]
    assert project["series"][2]["groups"] == [
        {"projectEvaluator": {"id": span}, "queuedCount": 1, "queueSize": 2, "lagP95Seconds": None},
        {
            "projectEvaluator": {"id": trace},
            "queuedCount": 1,
            "queueSize": 1,
            "lagP95Seconds": None,
        },
    ]


async def test_project_evaluator_lag_graphql(
    db: DbSessionFactory,
    gql_client: AsyncGraphQLClient,
) -> None:
    seeded = await _seed(db)
    response = await gql_client.execute(
        """query ($id: ID!, $timeRange: TimeRange!) {
            node(id: $id) {
                ... on ProjectEvaluator {
                    lag(timeRange: $timeRange) { p50Seconds p95Seconds p99Seconds }
                    recent: lag { p50Seconds }
                }
            }
        }""",
        {
            "id": str(GlobalID("ProjectEvaluator", str(seeded.span_evaluator_id))),
            "timeRange": {"start": _at(12).isoformat(), "end": _at(15).isoformat()},
        },
    )
    assert not response.errors and response.data
    assert response.data["node"] == {
        "lag": {
            "p50Seconds": _approx(1200),
            "p95Seconds": _approx(2550),
            "p99Seconds": _approx(2670),
        },
        # Nothing completed in the last hour.
        "recent": None,
    }
