from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.online_eval.evaluation_activity import (
    EvaluationLag,
    load_evaluation_lags,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_producer import _seed_criteria

_NOON = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)


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
