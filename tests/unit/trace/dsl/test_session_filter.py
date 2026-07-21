from ast import unparse
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, cast

import pytest
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.session_filter import (
    SESSION_BINDINGS,
    SESSION_FILTER_DESCRIPTIONS,
    SessionFilter,
)
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace

_SQLITE_DIALECT = cast(Dialect, sqlite.dialect())
_POSTGRESQL_DIALECT = cast(Dialect, postgresql.dialect())  # type: ignore[no-untyped-call]


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
        # ratio predicate — the denominator is guarded with nullif so 0 yields NULL (not a
        # dialect-divergent divide-by-zero) and the row is excluded on both backends.
        (
            "num_traces_with_error / num_traces > 0.2",
            "num_traces_with_error / nullif(num_traces, 0) > 0.2",
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
        (
            "'refund' in any_input",
            "any_input('refund')",
        ),
        (
            "'refund' not in any_output",
            "not_(any_output('refund'))",
        ),
        (
            "'refund' in first_input",
            "TextContains(first_input, 'refund')",
        ),
        (
            "'goodbye' not in last_output",
            "not_(TextContains(last_output, 'goodbye'))",
        ),
    ],
)
def test_session_filter_translated(condition: str, expected: str) -> None:
    assert unparse(SessionFilter(condition).translated).strip() == expected


def test_session_filter_tool_call_count_subscript_translates_to_flat_binding() -> None:
    translated = unparse(
        SessionFilter('tool_call_count["search"] >= 2 and tool_call_count >= 3').translated
    ).strip()

    assert "tool_call_count[" not in translated
    # Ordinal alias (first-appearance index), not a content-derived hash.
    assert "__session_tool_call_count_by_name_0" in translated
    assert "tool_call_count >= 3" in translated


def test_session_filter_tool_call_count_subscript_groups_duplicate_name_join() -> None:
    subquery = SessionFilter(
        'tool_call_count["search"] > 0 and tool_call_count["search"] < 3 '
        'and tool_call_count["lookup"] == 0'
    ).as_session_rowids_subquery(project_rowids=[1], aggregate_shape="grouped")
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(compile_kwargs={"literal_binds": True})
    ).lower()

    assert compiled.count("left outer join (select") == 2
    assert "spans.name = 'search'" in compiled
    assert "spans.name = 'lookup'" in compiled


def test_session_filter_rejects_user_written_reserved_alias_prefix() -> None:
    # Ordinal aliases are predictable (`__session_tool_call_count_by_name_0`), so visit_Name
    # must reject any user-written name carrying the reserved prefix before aliases are
    # injected — otherwise a crafted condition could collide with a generated aggregate.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter("__session_tool_call_count_by_name_0 > 1")
    assert "invalid name" in str(exc_info.value)


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
    assert "first_input" in SESSION_BINDINGS.string_names
    assert "last_output" in SESSION_BINDINGS.string_names
    # Function calls other than casts are rejected; the quantifier whitelist is empty for both grains.
    assert SESSION_BINDINGS.quantifiers == frozenset()
    assert SESSION_BINDINGS.exists_names == frozenset({"any_input", "any_output"})
    assert "any_input" not in SESSION_BINDINGS.names
    assert "any_output" not in SESSION_BINDINGS.names


@pytest.mark.parametrize(
    "condition",
    [
        "any_input == 'x'",
        "any_input in 'x'",
        "str(any_input) == 'x'",
        "not any_input",
        "any_input + 'x' == 'y'",
        "any_input",
    ],
)
def test_session_filter_rejects_any_input_misuse(condition: str) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter(condition)
    assert "`any_input` can only be used as the right-hand side of `in` or `not in`" in str(
        exc_info.value
    )


def test_session_filter_any_io_glosses_are_instrumentation_shaped() -> None:
    assert "instrumentation-shaped" in SESSION_FILTER_DESCRIPTIONS["any_input"]
    assert "instrumentation-shaped" in SESSION_FILTER_DESCRIPTIONS["any_output"]
    assert "turn-1-only" in SESSION_FILTER_DESCRIPTIONS["first_input"]
    assert "final-turn-only" in SESSION_FILTER_DESCRIPTIONS["last_output"]
    assert "user said" not in SESSION_FILTER_DESCRIPTIONS["any_input"].lower()
    assert "agent said" not in SESSION_FILTER_DESCRIPTIONS["any_output"].lower()


async def _add_span_cost(
    session: AsyncSession,
    span: models.Span,
    trace: models.Trace,
    total_cost: float,
) -> None:
    session.add(
        models.SpanCost(
            span_rowid=span.id,
            trace_rowid=trace.id,
            span_start_time=span.start_time,
            total_cost=total_cost,
            prompt_cost=total_cost,
            completion_cost=0.0,
        )
    )
    await session.flush()


async def _seed_session(
    session: AsyncSession,
    project: models.Project,
    *,
    num_traces: int,
    total_cost: float,
    start_time: datetime,
    session_id: Optional[str] = None,
    root_attributes: Optional[dict[str, Any]] = None,
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


async def _seed_tool_session(
    session: AsyncSession,
    project: models.Project,
    *,
    tool_names: list[str],
    start_time: datetime,
) -> models.ProjectSession:
    project_session = await _add_project_session(session, project, start_time=start_time)
    trace = await _add_trace(session, project, project_session, start_time=start_time)
    root_span = await _add_span(session, trace, span_kind="LLM", start_time=start_time)
    for index, tool_name in enumerate(tool_names):
        tool_span = await _add_span(
            session,
            parent_span=root_span,
            span_kind="TOOL",
            start_time=start_time + timedelta(milliseconds=index + 1),
        )
        tool_span.name = tool_name
    await session.flush()
    return project_session


async def _seed_io_session(
    session: AsyncSession,
    project: models.Project,
    *,
    turns: list[tuple[str, str]],
    start_time: datetime,
    session_id: Optional[str] = None,
) -> models.ProjectSession:
    project_session = await _add_project_session(
        session, project, session_id=session_id, start_time=start_time
    )
    for index, (input_value, output_value) in enumerate(turns):
        trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=start_time + timedelta(seconds=index),
        )
        await _add_span(
            session,
            trace,
            attributes={
                "input": {"value": input_value},
                "output": {"value": output_value},
            },
            start_time=start_time + timedelta(seconds=index),
        )
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


async def test_session_filter_time_window_uses_interval_overlap(db: DbSessionFactory) -> None:
    """The time window scopes sessions by interval overlap, matching the sessions connection:
    a long-running session that starts before the window but is active inside it stays visible
    when a filter it matches is applied; a session that ends before the window does not."""
    window_start = datetime(2024, 1, 1, 10, 0, tzinfo=timezone.utc)
    window_end = datetime(2024, 1, 1, 12, 0, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        # Spans 09:00-11:00 — overlaps the [10:00, 12:00) window despite starting before it.
        long_running = await _seed_session(
            session,
            project,
            num_traces=2,
            total_cost=0.0,
            start_time=datetime(2024, 1, 1, 9, 0, tzinfo=timezone.utc),
        )
        long_running.end_time = datetime(2024, 1, 1, 11, 0, tzinfo=timezone.utc)
        # Ends 08:00 — entirely before the window.
        before_window = await _seed_session(
            session,
            project,
            num_traces=2,
            total_cost=0.0,
            start_time=datetime(2024, 1, 1, 7, 0, tzinfo=timezone.utc),
        )
        before_window.end_time = datetime(2024, 1, 1, 8, 0, tzinfo=timezone.utc)
        await session.flush()

        subquery = SessionFilter("num_traces > 0").as_session_rowids_subquery(
            project_rowids=[project.id],
            start_time=window_start,
            end_time=window_end,
        )
        matched = {
            row
            for row in (
                await session.scalars(
                    select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
                )
            ).all()
        }
        assert long_running.id in matched
        assert before_window.id not in matched


async def test_session_filter_tool_call_count_subscript_filters_by_tool_name(
    db: DbSessionFactory,
) -> None:
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        search_twice = await _seed_tool_session(
            session,
            project,
            tool_names=["search", "search"],
            start_time=start,
        )
        lookup_once = await _seed_tool_session(
            session,
            project,
            tool_names=["lookup"],
            start_time=start,
        )
        both_once = await _seed_tool_session(
            session,
            project,
            tool_names=["search", "lookup"],
            start_time=start,
        )
        no_tools = await _seed_tool_session(
            session,
            project,
            tool_names=[],
            start_time=start,
        )

        by_search_count = await _matched_rowids(
            session,
            SessionFilter('tool_call_count["search"] >= 2'),
            project,
        )
        assert by_search_count == {search_twice.id}

        by_two_names = await _matched_rowids(
            session,
            SessionFilter('tool_call_count["search"] >= 1 and tool_call_count["lookup"] >= 1'),
            project,
        )
        assert by_two_names == {both_once.id}

        by_plain_count = await _matched_rowids(
            session, SessionFilter("tool_call_count >= 2"), project
        )
        assert by_plain_count == {search_twice.id, both_once.id}
        assert lookup_once.id not in by_plain_count
        assert no_tools.id not in by_plain_count


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


@pytest.mark.parametrize("dialect", [_SQLITE_DIALECT, _POSTGRESQL_DIALECT])
def test_session_filter_any_io_compiles_to_exists_on_supported_dialects(dialect: Dialect) -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    subquery = SessionFilter(
        "'refund' in any_input and 'done' not in any_output"
    ).as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=start + timedelta(days=1),
        candidate_session_rowids=[2, 3],
    )
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()

    assert "exists" in compiled
    assert "not (exists" in compiled
    assert "spans.parent_id is null" in compiled
    assert "traces.project_session_rowid = project_sessions.id" in compiled
    assert "traces.project_rowid in (1)" in compiled
    assert "traces.project_session_rowid in (2, 3)" in compiled
    assert "session_scope.start_time" in compiled
    assert SpanAttributes.INPUT_VALUE not in compiled
    assert SpanAttributes.OUTPUT_VALUE not in compiled


@pytest.mark.parametrize("dialect", [_SQLITE_DIALECT, _POSTGRESQL_DIALECT])
def test_session_filter_first_last_io_compiles_to_window_shape(dialect: Dialect) -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    subquery = SessionFilter(
        "'refund' in first_input and 'goodbye' not in last_output"
    ).as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=start + timedelta(days=1),
        candidate_session_rowids=[2, 3],
    )
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()

    assert "row_number() over" in compiled
    assert "partition by traces.project_session_rowid order by traces.start_time asc" in compiled
    assert "partition by traces.project_session_rowid order by traces.start_time desc" in compiled
    assert "traces.id asc" in compiled
    assert "traces.id desc" in compiled
    assert "lateral" not in compiled
    assert "spans.parent_id is null" in compiled
    assert "traces.project_rowid in (1)" in compiled
    assert "traces.project_session_rowid in (2, 3)" in compiled
    assert "session_scope.start_time" in compiled


async def test_session_filter_any_io_returns_any_turn_matches(db: DbSessionFactory) -> None:
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        input_match = await _seed_io_session(
            session,
            project,
            turns=[("hello", "first"), ("please refund order", "done")],
            start_time=start,
        )
        output_match = await _seed_io_session(
            session,
            project,
            turns=[("hello", "first"), ("question", "refund issued")],
            start_time=start,
        )
        no_match = await _seed_io_session(
            session,
            project,
            turns=[("hello", "first"), ("question", "done")],
            start_time=start,
        )
        case_mismatch = await _seed_io_session(
            session,
            project,
            turns=[("REFUND request", "first")],
            start_time=start,
        )

        by_input = await _matched_rowids(session, SessionFilter("'refund' in any_input"), project)
        assert by_input == {input_match.id}
        assert case_mismatch.id not in by_input

        by_output = await _matched_rowids(session, SessionFilter("'refund' in any_output"), project)
        assert by_output == {output_match.id}

        not_in_output = await _matched_rowids(
            session, SessionFilter("'refund' not in any_output"), project
        )
        assert not_in_output == {input_match.id, no_match.id, case_mismatch.id}


async def test_session_filter_first_last_io_returns_window_turn_matches(
    db: DbSessionFactory,
) -> None:
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        first_input_match = await _seed_io_session(
            session,
            project,
            turns=[("refund please", "first"), ("hello", "done")],
            start_time=start,
        )
        later_input_only = await _seed_io_session(
            session,
            project,
            turns=[("hello", "first"), ("refund please", "done")],
            start_time=start,
        )
        last_output_match = await _seed_io_session(
            session,
            project,
            turns=[("hello", "refund pending"), ("question", "refund issued")],
            start_time=start,
        )
        first_output_only = await _seed_io_session(
            session,
            project,
            turns=[("hello", "refund pending"), ("question", "done")],
            start_time=start,
        )
        case_mismatch = await _seed_io_session(
            session,
            project,
            turns=[("REFUND please", "first"), ("question", "REFUND issued")],
            start_time=start,
        )

        by_first_input = await _matched_rowids(
            session, SessionFilter("'refund' in first_input"), project
        )
        assert by_first_input == {first_input_match.id}
        assert later_input_only.id not in by_first_input
        assert case_mismatch.id not in by_first_input

        by_last_output = await _matched_rowids(
            session, SessionFilter("'refund' in last_output"), project
        )
        assert by_last_output == {last_output_match.id}
        assert first_output_only.id not in by_last_output
        assert case_mismatch.id not in by_last_output


async def test_session_filter_first_input_candidate_scoping(db: DbSessionFactory) -> None:
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        candidate = await _seed_io_session(
            session,
            project,
            turns=[("refund please", "done")],
            start_time=start,
        )
        excluded = await _seed_io_session(
            session,
            project,
            turns=[("refund please", "done")],
            start_time=start,
        )

        subquery = SessionFilter("'refund' in first_input").as_session_rowids_subquery(
            project_rowids=[project.id],
            candidate_session_rowids=[candidate.id],
        )
        scoped = {
            row
            for row in (
                await session.scalars(
                    select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
                )
            ).all()
        }
        assert scoped == {candidate.id}
        assert excluded.id not in scoped


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


async def test_session_filter_ratio_zero_denominator_excludes_without_error(
    db: DbSessionFactory,
) -> None:
    """A ratio predicate whose denominator aggregate coalesces to 0 must not raise (PostgreSQL
    raises division-by-zero on a raw ``/``); the guarded ``nullif`` denominator yields NULL so the
    row is excluded consistently on both dialects."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        # No cost configured for this session: total_cost / prompt_cost both coalesce to 0.
        zero_cost = await _seed_session(
            session, project, num_traces=3, total_cost=0.0, start_time=start
        )
        # A retention-orphaned session: exists with no traces, so num_traces coalesces to 0.
        orphan = await _seed_session(
            session, project, num_traces=0, total_cost=0.0, start_time=start
        )
        has_cost = await _seed_session(
            session, project, num_traces=3, total_cost=0.4, start_time=start
        )

        # prompt_cost / total_cost: 0/0 on zero_cost, undefined on orphan, 1.0 on has_cost.
        by_cost_ratio = await _matched_rowids(
            session, SessionFilter("prompt_cost / total_cost > 0.5"), project
        )
        assert by_cost_ratio == {has_cost.id}
        assert zero_cost.id not in by_cost_ratio
        assert orphan.id not in by_cost_ratio

        # num_traces denominator is 0 on the orphan session — must not raise either.
        by_trace_ratio = await _matched_rowids(
            session, SessionFilter("num_traces_with_error / num_traces > 0.2"), project
        )
        assert orphan.id not in by_trace_ratio
        assert zero_cost.id not in by_trace_ratio
