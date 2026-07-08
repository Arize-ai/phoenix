from ast import unparse
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.session_filter import SESSION_BINDINGS, SessionFilter
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace


@pytest.mark.parametrize(
    "condition,expected",
    [
        (
            "num_traces >= 5 and total_cost > 0.1",
            "and_(num_traces >= 5, total_cost > 0.1)",
        ),
        (
            "duration_ms > 1000 or session_id == 'abc'",
            "or_(duration_ms > 1000, session_id == 'abc')",
        ),
        # ratio predicate — no grammar change, just float-name bindings
        (
            "num_traces_with_error / num_traces > 0.2",
            "num_traces_with_error / num_traces > 0.2",
        ),
        # user.id / metadata read from the earliest root span via the attributes accessor
        (
            "user.id == 'u1'",
            "attributes[['user', 'id']].as_string() == 'u1'",
        ),
        (
            "metadata['tier'] == 'gold'",
            "attributes[['metadata', 'tier']].as_string() == 'gold'",
        ),
    ],
)
def test_session_filter_translated(condition: str, expected: str) -> None:
    assert unparse(SessionFilter(condition).translated).strip() == expected


@pytest.mark.parametrize(
    "condition,suggestion",
    [
        ("num_tracez > 5", 'did you mean "num_traces"?'),
        ("total_kost > 0.1", 'did you mean "total_cost"?'),
    ],
)
def test_session_filter_unknown_name_raises_did_you_mean(condition: str, suggestion: str) -> None:
    # An unbound bare name is a loud did-you-mean error, never a silent zero-match.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter(condition)
    assert suggestion in str(exc_info.value)


def test_session_bindings_flavor_audit() -> None:
    # Every session name keeps the SpanFilter flavor: `_ms` units-in-names, no per-grain drift.
    assert "duration_ms" in SESSION_BINDINGS.float_names
    assert not any(name.endswith("_seconds") for name in SESSION_BINDINGS.binding_names)
    # Function calls other than casts are rejected; the quantifier whitelist is empty for both grains.
    assert SESSION_BINDINGS.quantifiers == frozenset()


async def _add_span_cost(
    session: object,
    span: models.Span,
    trace: models.Trace,
    total_cost: float,
) -> None:
    session.add(  # type: ignore[attr-defined]
        models.SpanCost(
            span_rowid=span.id,
            trace_rowid=trace.id,
            span_start_time=span.start_time,
            total_cost=total_cost,
            prompt_cost=total_cost,
            completion_cost=0.0,
        )
    )
    await session.flush()  # type: ignore[attr-defined]


async def _seed_session(
    session: object,
    project: models.Project,
    *,
    num_traces: int,
    total_cost: float,
    start_time: datetime,
    session_id: Optional[str] = None,
    root_attributes: Optional[dict] = None,
) -> models.ProjectSession:
    """Create a session with ``num_traces`` traces (each a root LLM span) totalling ``total_cost``.

    The session's cost is attached to the earliest root span; ``root_attributes`` seed that span's
    attributes for user.id / metadata reads.
    """
    project_session = await _add_project_session(
        session, project, session_id=session_id, start_time=start_time
    )
    for i in range(num_traces):
        trace = await _add_trace(
            session, project, project_session, start_time=start_time + timedelta(seconds=i)
        )
        root_span = await _add_span(
            session,
            trace,
            span_kind="LLM",
            attributes=root_attributes if i == 0 else None,
            start_time=start_time + timedelta(seconds=i),
        )
        if i == 0 and total_cost:
            await _add_span_cost(session, root_span, trace, total_cost)
    return project_session


async def _matched_rowids(
    session: object,
    session_filter: SessionFilter,
    project: models.Project,
) -> set[int]:
    stmt = session_filter(
        select(models.ProjectSession.id).where(models.ProjectSession.project_id == project.id)
    )
    return {row for row in (await session.scalars(stmt)).all()}  # type: ignore[attr-defined]


async def test_session_filter_applies_and_returns_expected_rowids(db: DbSessionFactory) -> None:
    """`num_traces >= 5 and total_cost > 0.1` compiles, applies as Select->Select, and returns
    exactly the sessions matching both aggregate predicates on both dialects."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        match = await _seed_session(
            session, project, num_traces=5, total_cost=0.2, start_time=start
        )
        few_traces = await _seed_session(
            session, project, num_traces=3, total_cost=0.5, start_time=start
        )
        cheap = await _seed_session(
            session, project, num_traces=6, total_cost=0.05, start_time=start
        )

        session_filter = SessionFilter("num_traces >= 5 and total_cost > 0.1")
        matched = await _matched_rowids(session, session_filter, project)
        assert matched == {match.id}
        assert few_traces.id not in matched
        assert cheap.id not in matched

        # The ScalarSelect[int] builder produces the same result behind its Phase-3 seam.
        subquery = session_filter.as_session_rowids_subquery(project_rowids=[project.id])
        via_subquery = {
            row
            for row in (
                await session.scalars(
                    select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
                )
            ).all()
        }
        assert via_subquery == {match.id}


async def test_session_filter_candidate_scoping(db: DbSessionFactory) -> None:
    """A candidate-rowid restriction limits the result to the candidate set (pushed into the
    aggregate SQL), never widening past it."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        first = await _seed_session(
            session, project, num_traces=5, total_cost=0.2, start_time=start
        )
        second = await _seed_session(
            session, project, num_traces=5, total_cost=0.2, start_time=start
        )

        session_filter = SessionFilter("num_traces >= 5")
        subquery = session_filter.as_session_rowids_subquery(
            project_rowids=[project.id], candidate_session_rowids=[first.id]
        )
        scoped = {
            row
            for row in (
                await session.scalars(
                    select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
                )
            ).all()
        }
        # Both sessions match the predicate, but only the candidate is returned.
        assert scoped == {first.id}
        assert second.id not in scoped


def test_session_filter_grouped_aggregate_shape_pushes_project_time_scope() -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 1, 2, tzinfo=timezone.utc)

    subquery = SessionFilter("num_traces >= 5").as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=end,
        aggregate_shape="grouped",
    )
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(compile_kwargs={"literal_binds": True})
    ).lower()

    assert "left outer join (select" in compiled
    assert "group by traces.project_session_rowid" in compiled
    assert "traces.project_rowid in (1)" in compiled
    assert "join project_sessions as session_scope" in compiled
    assert "session_scope.start_time" in compiled
    assert "traces.project_session_rowid = project_sessions.id" not in compiled


def test_session_filter_correlated_aggregate_shape_pushes_project_time_scope() -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 1, 2, tzinfo=timezone.utc)

    subquery = SessionFilter("num_traces >= 5").as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=end,
        aggregate_shape="correlated",
    )
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(compile_kwargs={"literal_binds": True})
    ).lower()

    assert "left outer join (select" not in compiled
    assert "group by traces.project_session_rowid" not in compiled
    assert "select count(traces.id)" in compiled
    assert "traces.project_session_rowid = project_sessions.id" in compiled
    assert "traces.project_rowid in (1)" in compiled
    assert "join project_sessions as session_scope" in compiled
    assert "session_scope.start_time" in compiled


def test_session_filter_root_span_derivation_pushes_project_time_scope() -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 1, 2, tzinfo=timezone.utc)

    subquery = SessionFilter("user.id == 'u1'").as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=end,
    )
    compiled = str(
        select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery)).compile()
    ).lower()

    assert "join project_sessions as session_scope" in compiled
    assert "session_scope.id = traces.project_session_rowid" in compiled
    assert "traces.project_rowid in" in compiled
    assert "session_scope.start_time" in compiled


async def test_session_filter_root_span_and_annotation(db: DbSessionFactory) -> None:
    """user.id / metadata read the earliest root span, and annotations["Name"] joins the
    ProjectSessionAnnotation peer."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        gold = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=start,
            root_attributes={"user": {"id": "u1"}, "metadata": {"tier": "gold"}},
        )
        silver = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=start,
            root_attributes={"user": {"id": "u2"}, "metadata": {"tier": "silver"}},
        )
        session.add(
            models.ProjectSessionAnnotation(
                project_session_id=gold.id,
                name="Quality",
                label="good",
                score=0.9,
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
        )
        await session.flush()

        by_user = await _matched_rowids(session, SessionFilter("user.id == 'u1'"), project)
        assert by_user == {gold.id}

        by_metadata = await _matched_rowids(
            session, SessionFilter("metadata['tier'] == 'gold'"), project
        )
        assert by_metadata == {gold.id}

        by_annotation = await _matched_rowids(
            session, SessionFilter('annotations["Quality"].score > 0.5'), project
        )
        assert by_annotation == {gold.id}
        assert silver.id not in by_annotation


async def test_session_filter_differential_oracle(db: DbSessionFactory) -> None:
    """Differential-testing oracle: the compiled filter's row set equals the Python ground truth,
    and equivalent authorings (`>= 3` vs `> 2`) score identically without AST normalization."""
    start = datetime.now(timezone.utc)
    specs = [
        (2, 0.05),
        (3, 0.20),
        (5, 0.00),
        (6, 0.50),
        (4, 0.15),
        (1, 1.00),
    ]
    async with db() as session:
        project = await _add_project(session)
        seeded: list[tuple[int, int, float]] = []
        for num_traces, total_cost in specs:
            project_session = await _seed_session(
                session, project, num_traces=num_traces, total_cost=total_cost, start_time=start
            )
            seeded.append((project_session.id, num_traces, total_cost))

        def ground_truth(predicate: object) -> set[int]:
            return {
                rowid
                for rowid, num_traces, total_cost in seeded
                if predicate(num_traces, total_cost)  # type: ignore[operator]
            }

        expected = ground_truth(lambda n, c: n >= 3 and c > 0.1)
        actual = await _matched_rowids(
            session, SessionFilter("num_traces >= 3 and total_cost > 0.1"), project
        )
        assert actual == expected

        # Equivalent authoring: `num_traces > 2` selects the same sessions as `num_traces >= 3`.
        equivalent = await _matched_rowids(
            session, SessionFilter("num_traces > 2 and total_cost > 0.1"), project
        )
        assert equivalent == expected
