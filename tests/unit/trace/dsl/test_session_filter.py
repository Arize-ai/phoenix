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
from phoenix.trace.dsl.filter import SPAN_BINDINGS, SpanFilter
from phoenix.trace.dsl.session_filter import (
    SESSION_BINDINGS,
    SESSION_FILTER_DESCRIPTIONS,
    FilterLowering,
    SessionFilter,
)
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace
from tests.unit.trace.dsl.session_filter_reference import (
    AGREEMENT_PAIRS,
    DIFFERENTIAL_CONDITIONS,
    FIXTURE_SESSIONS,
    ReferenceSession,
    matches,
)

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
        # Session-grain string containment is case-insensitive; equality stays exact.
        (
            "'refund' in first_input",
            "CaseInsensitiveContains(first_input, 'refund')",
        ),
        (
            "'goodbye' not in last_output",
            "not_(CaseInsensitiveContains(last_output, 'goodbye'))",
        ),
        (
            "'gpt' in attributes['llm.model_name']",
            "CaseInsensitiveContains(attributes[['llm.model_name']].as_string(), 'gpt')",
        ),
    ],
)
def test_session_filter_translated(condition: str, expected: str) -> None:
    assert unparse(SessionFilter(condition).translated).strip() == expected


def test_span_filter_containment_ignores_case_too() -> None:
    """The containment polarity is one family-wide flavor, not a per-grain choice."""
    assert unparse(SpanFilter("'refund' in input.value").translated).strip() == (
        "CaseInsensitiveContains(attributes[['input', 'value']].as_string(), 'refund')"
    )


def test_session_filter_rejects_span_count_subscript() -> None:
    # Per-tool counts are not v1 vocabulary: only the bare session-total aggregate binds.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter('tool_span_count["search"] >= 2')
    assert "invalid expression" in str(exc_info.value)


def test_session_filter_unknown_name_raises_did_you_mean() -> None:
    # An unbound bare name is a loud did-you-mean error, never a silent zero-match.
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter("num_tracez > 5")
    assert 'did you mean "num_traces"?' in str(exc_info.value)


def test_session_bindings_flavor_audit() -> None:
    # Every session name keeps the SpanFilter flavor: `_ms` units-in-names, no per-grain drift.
    assert "duration_ms" in SESSION_BINDINGS.float_names
    assert not any(name.endswith("_seconds") for name in SESSION_BINDINGS.binding_names)
    assert "first_input" in SESSION_BINDINGS.string_names
    assert "last_output" in SESSION_BINDINGS.string_names
    # Function calls other than casts and the v1 comprehension set are rejected.
    assert SESSION_BINDINGS.quantifiers == frozenset({"any", "all", "len", "max", "min", "sum"})
    assert set(SESSION_BINDINGS.iterables) == {
        "spans",
        "traces",
        "session_annotations",
        "span_annotations",
        "span_cost_details",
    }
    # The span grain iterates too, and with the same comprehension vocabulary -- one family,
    # one flavor. Its collection is registered under a bare key like every other grain's,
    # which is what claiming `cost_details` out of the attribute namespace bought.
    assert SPAN_BINDINGS.quantifiers == SESSION_BINDINGS.quantifiers
    assert set(SPAN_BINDINGS.iterables) == {"cost_details"}
    assert all("." not in key for key in SPAN_BINDINGS.iterables)
    # The session grain, which reserves no root, keeps its bare keys.
    assert all("." not in key for key in SESSION_BINDINGS.iterables)
    assert SESSION_BINDINGS.exists_names == frozenset({"any_input", "any_output"})
    assert "any_input" not in SESSION_BINDINGS.names
    assert "any_output" not in SESSION_BINDINGS.names


@pytest.mark.parametrize(
    "condition",
    [
        # One row per rejection site: comparator with a non-containment operator, the name
        # appearing anywhere else in a comparison, and the bare-name fallback.
        "any_input == 'x'",
        "any_input in 'x'",
        "not any_input",
    ],
)
def test_session_filter_rejects_any_input_misuse(condition: str) -> None:
    with pytest.raises(SyntaxError) as exc_info:
        SessionFilter(condition)
    assert "`any_input` can only be used as the right-hand side of `in` or `not in`" in str(
        exc_info.value
    )


def test_session_filter_io_glosses_describe_mechanics_not_a_turn_model() -> None:
    """The served vocabulary is a public contract, so it states what the compiler does.

    One trace per exchange is an ingestion convention Phoenix does not enforce, so the turn
    model may appear only as a labeled approximation, never as a term's meaning.
    """
    for name in ("any_input", "any_output"):
        description = SESSION_FILTER_DESCRIPTIONS[name]
        assert "ANY root span" in description
        assert "instrumentation-shaped" in description
        assert "turn" not in description.lower()
    assert "user said" not in SESSION_FILTER_DESCRIPTIONS["any_input"].lower()
    assert "agent said" not in SESSION_FILTER_DESCRIPTIONS["any_output"].lower()
    for name in ("first_input", "last_output"):
        description = SESSION_FILTER_DESCRIPTIONS[name]
        assert "root span" in description
        assert "trace start time" in description
        assert "turn" not in description.lower()
    for name in ("num_traces", "traces"):
        description = SESSION_FILTER_DESCRIPTIONS[name].lower()
        if "turn" in description:
            assert "approximate" in description
            assert "does not enforce" in description


def test_session_filter_text_glosses_state_case_insensitive_containment() -> None:
    """No gloss may still advertise the retired case-sensitive containment."""
    for name in ("any_input", "any_output", "first_input", "last_output", "session_id"):
        description = SESSION_FILTER_DESCRIPTIONS[name].lower()
        assert "case-sensitive" not in description
        assert "ignor" in description and "case" in description


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
    root_attributes: Optional[dict[str, Any]] = None,
) -> models.ProjectSession:
    """Create a session with ``num_traces`` traces (each a root LLM span) totalling ``total_cost``.

    The session's cost is attached to the earliest root span; ``root_attributes`` seed that span's
    attributes for user.id / metadata reads.
    """
    project_session = await _add_project_session(session, project, start_time=start_time)
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
) -> models.ProjectSession:
    project_session = await _add_project_session(session, project, start_time=start_time)
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
    lowering: FilterLowering = "scan",
) -> set[int]:
    stmt = session_filter(
        select(models.ProjectSession.id).where(models.ProjectSession.project_id == project.id),
        lowering=lowering,
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


async def test_session_filter_datetime_literal_comparison(db: DbSessionFactory) -> None:
    """A string comparand on a datetime name parses as ISO 8601 (an explicit offset is
    required, matching the span filter's timezone contract) and selects by time; a
    malformed or naive literal is rejected at construction instead of matching nothing."""
    async with db() as session:
        project = await _add_project(session)
        earlier = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=datetime(2026, 7, 1, tzinfo=timezone.utc),
        )
        later = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=datetime(2026, 7, 3, tzinfo=timezone.utc),
        )

        subquery = SessionFilter(
            "start_time > '2026-07-02T00:00:00+00:00'"
        ).as_session_rowids_subquery(project_rowids=[project.id])
        matched = set(
            (
                await session.scalars(
                    select(models.ProjectSession.id).where(models.ProjectSession.id.in_(subquery))
                )
            ).all()
        )
        assert matched == {later.id}
        assert earlier.id not in matched

    with pytest.raises(SyntaxError, match="invalid datetime literal"):
        SessionFilter("start_time > 'not-a-date'")
    with pytest.raises(SyntaxError, match="has no timezone"):
        SessionFilter("start_time > '2026-07-02'")


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


async def test_session_filter_tool_span_count_counts_tool_spans(
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

        matched = await _matched_rowids(session, SessionFilter("tool_span_count >= 2"), project)
        assert matched == {search_twice.id, both_once.id}
        assert lookup_once.id not in matched
        assert no_tools.id not in matched


def test_session_filter_scan_lowering_pushes_project_time_scope() -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 1, 2, tzinfo=timezone.utc)

    subquery = SessionFilter("num_traces >= 5").as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=end,
        lowering="scan",
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


def test_session_filter_probe_lowering_pushes_project_time_scope() -> None:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 1, 2, tzinfo=timezone.utc)

    subquery = SessionFilter("num_traces >= 5").as_session_rowids_subquery(
        project_rowids=[1],
        start_time=start,
        end_time=end,
        lowering="probe",
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
        # Containment ignores case, so a differently-cased occurrence is a match.
        case_mismatch = await _seed_io_session(
            session,
            project,
            turns=[("REFUND request", "first")],
            start_time=start,
        )

        by_input = await _matched_rowids(session, SessionFilter("'refund' in any_input"), project)
        assert by_input == {input_match.id, case_mismatch.id}

        by_output = await _matched_rowids(session, SessionFilter("'refund' in any_output"), project)
        assert by_output == {output_match.id}

        not_in_output = await _matched_rowids(
            session, SessionFilter("'refund' not in any_output"), project
        )
        assert not_in_output == {input_match.id, no_match.id, case_mismatch.id}

        # An uppercase needle matches lowercase text just the same.
        by_upper_needle = await _matched_rowids(
            session, SessionFilter("'REFUND' in any_input"), project
        )
        assert by_upper_needle == by_input


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
        # Containment ignores case here too — the turn window is what narrows the match.
        case_mismatch = await _seed_io_session(
            session,
            project,
            turns=[("REFUND please", "first"), ("question", "REFUND issued")],
            start_time=start,
        )

        by_first_input = await _matched_rowids(
            session, SessionFilter("'refund' in first_input"), project
        )
        assert by_first_input == {first_input_match.id, case_mismatch.id}
        assert later_input_only.id not in by_first_input

        by_last_output = await _matched_rowids(
            session, SessionFilter("'refund' in last_output"), project
        )
        assert by_last_output == {last_output_match.id, case_mismatch.id}
        assert first_output_only.id not in by_last_output

        # Equality stays exact, so the same differently-cased text no longer matches.
        by_exact_first_input = await _matched_rowids(
            session, SessionFilter("first_input == 'refund please'"), project
        )
        assert by_exact_first_input == {first_input_match.id}


async def test_session_filter_root_span_and_annotation(db: DbSessionFactory) -> None:
    """user.id / metadata read the earliest root span, and session_annotations["Name"] joins the
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
            session, SessionFilter('session_annotations["Quality"].score > 0.5'), project
        )
        assert by_annotation == {gold.id}
        assert silver.id not in by_annotation


async def _seed_reference_session(
    session: AsyncSession,
    project: models.Project,
    fixture: ReferenceSession,
) -> models.ProjectSession:
    """Materialize one fixture session so the compiled filter sees what the reference reads."""
    project_session = await _add_project_session(
        session,
        project,
        session_id=fixture.session_id,
        start_time=fixture.start_time,
        end_time=fixture.end_time,
    )
    for turn in fixture.turns:
        trace = await _add_trace(
            session,
            project,
            project_session,
            start_time=turn.start_time,
            end_time=turn.end_time,
        )
        turn_root: Optional[models.Span] = None
        for reference_span in turn.spans:
            span = await _add_span(
                session,
                trace,
                # A non-root fixture span hangs off the turn's root, which is what keeps it out
                # of the root-span window the IO names read.
                parent_span=None if reference_span.is_root else turn_root,
                span_kind=reference_span.span_kind,
                attributes=None
                if reference_span.attributes is None
                else dict(reference_span.attributes),
                start_time=turn.start_time,
                end_time=turn.start_time + timedelta(milliseconds=reference_span.latency_ms),
                llm_token_count_prompt=reference_span.llm_token_count_prompt,
                llm_token_count_completion=reference_span.llm_token_count_completion,
                # num_traces_with_error keys off the error count, which the fixtures express
                # as an errored status code.
                cumulative_error_count=1 if reference_span.status_code == "ERROR" else 0,
            )
            span.name = reference_span.name
            span.status_code = reference_span.status_code
            turn_root = turn_root or span
            for annotation in reference_span.annotations:
                session.add(
                    models.SpanAnnotation(
                        span_rowid=span.id,
                        name=annotation.name,
                        label=annotation.label,
                        score=annotation.score,
                        metadata_={},
                        annotator_kind="HUMAN",
                        source="APP",
                        identifier=annotation.identifier,
                    )
                )
            if (cost := reference_span.cost) is not None:
                span_cost = models.SpanCost(
                    span_rowid=span.id,
                    trace_rowid=trace.id,
                    span_start_time=span.start_time,
                    prompt_cost=cost.prompt_cost,
                    completion_cost=cost.completion_cost,
                    total_cost=cost.total_cost,
                )
                session.add(span_cost)
                await session.flush()
                for detail in cost.details:
                    session.add(
                        models.SpanCostDetail(
                            span_cost_id=span_cost.id,
                            token_type=detail.token_type,
                            is_prompt=detail.is_prompt,
                            cost=detail.cost,
                            tokens=detail.tokens,
                            cost_per_token=detail.cost_per_token,
                        )
                    )
    for annotation in fixture.annotations:
        session.add(
            models.ProjectSessionAnnotation(
                project_session_id=project_session.id,
                name=annotation.name,
                label=annotation.label,
                score=annotation.score,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier=annotation.identifier,
            )
        )
    await session.flush()
    return project_session


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_session_filter_agrees_with_reference_evaluator(
    db: DbSessionFactory, lowering: FilterLowering
) -> None:
    """Differential suite: for every (fixture, condition) pair the compiled filter's row set
    equals the Python reference evaluator's selection, under both lowerings on both dialects."""
    async with db() as session:
        project = await _add_project(session)
        sessionless_trace = await _add_trace(session, project)
        counterexample_span = await _add_span(session, sessionless_trace)
        counterexample_span.status_code = "ERROR"
        await session.flush()
        rowids = {
            fixture.session_id: (await _seed_reference_session(session, project, fixture)).id
            for fixture in FIXTURE_SESSIONS
        }
        for condition in DIFFERENTIAL_CONDITIONS:
            expected = {
                rowids[fixture.session_id]
                for fixture in FIXTURE_SESSIONS
                if matches(condition, fixture)
            }
            actual = await _matched_rowids(
                session, SessionFilter(condition), project, lowering=lowering
            )
            assert actual == expected, condition


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_session_annotation_idioms_select_the_same_sessions(
    db: DbSessionFactory, lowering: FilterLowering
) -> None:
    """Point access and equivalent `session_annotations` quantification select the same rows.

    They lower differently — an aliased outer join versus an EXISTS — so their agreement is pinned
    over fixtures carrying duplicate names, null scores and labels, and missing annotations.
    """
    async with db() as session:
        project = await _add_project(session)
        for fixture in FIXTURE_SESSIONS:
            await _seed_reference_session(session, project, fixture)
        for subscript, quantifier in AGREEMENT_PAIRS:
            by_subscript = await _matched_rowids(
                session, SessionFilter(subscript), project, lowering=lowering
            )
            by_quantifier = await _matched_rowids(
                session, SessionFilter(quantifier), project, lowering=lowering
            )
            assert by_subscript == by_quantifier, subscript


async def test_session_filter_attributes_resolve_by_wire_key(db: DbSessionFactory) -> None:
    """Both spellings of one wire key match either storage shape, and where the fully split and
    literal shapes coexist the fully split value wins — pinned directly, not via the reference."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        nested = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=start,
            root_attributes={"llm": {"model_name": "gpt-4o"}},
        )
        literal = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=start,
            root_attributes={"llm.model_name": "gpt-4o"},
        )
        shadowed = await _seed_session(
            session,
            project,
            num_traces=1,
            total_cost=0.0,
            start_time=start,
            root_attributes={"llm": {"model_name": "gpt-4o"}, "llm.model_name": "claude"},
        )
        await _seed_session(session, project, num_traces=1, total_cost=0.0, start_time=start)

        expected = {nested.id, literal.id, shadowed.id}
        for condition in (
            'attributes["llm.model_name"] == "gpt-4o"',
            'attributes["llm"]["model_name"] == "gpt-4o"',
            '"gpt" in attributes["llm.model_name"]',
        ):
            assert await _matched_rowids(session, SessionFilter(condition), project) == expected

        by_shadowed_literal = await _matched_rowids(
            session, SessionFilter('attributes["llm.model_name"] == "claude"'), project
        )
        assert by_shadowed_literal == set()


async def test_span_kind_spellings_agree_on_normalized_data(db: DbSessionFactory) -> None:
    """The aggregate and comprehension spellings agree on normalized span-kind storage."""
    start_time = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project, start_time=start_time)
        trace = await _add_trace(session, project, project_session, start_time=start_time)
        root_span = await _add_span(session, trace, span_kind="LLM", start_time=start_time)
        for index in range(3):
            await _add_span(
                session,
                parent_span=root_span,
                span_kind="TOOL",
                start_time=start_time + timedelta(milliseconds=index + 1),
            )
        await session.flush()

        expected = {project_session.id}
        for condition in (
            "tool_span_count > 2",
            'len([s for s in spans if s.span_kind == "TOOL"]) > 2',
            'len([s for s in spans if s.span_kind == "tool"]) > 2',
        ):
            assert await _matched_rowids(session, SessionFilter(condition), project) == expected


@pytest.mark.parametrize(
    "condition",
    [
        # One row per rejected form: ordinal indexing, a set comprehension, nesting past
        # turn -> span, an unsanctioned nested iterable, `len` of a generator, an undeclared
        # iterable, and an enclosing-grain name reached from inside a predicate.
        "traces[0].latency_ms > 100",
        "len({s.span_kind for s in spans}) > 1",
        "any(any(any(x.score > 0.5 for x in s.annotations) for s in t.spans) for t in traces)",
        "any(a.score > 0.5 for s in spans for a in s.annotations)",
        "len(s.name for s in spans) > 1",
        'any(e.name == "x" for e in events)',
        "any(s.latency_ms > duration_ms for s in spans)",
    ],
)
def test_session_filter_rejects_out_of_scope_comprehension_forms(condition: str) -> None:
    with pytest.raises(SyntaxError):
        SessionFilter(condition)


@pytest.mark.parametrize(
    "dialect,counterexample",
    # SQLite has no boolean literal, so the `IS NOT TRUE` counterexample renders against 1;
    # its `IS NOT` is null-safe either way, which is what makes a NULL field a counterexample.
    [(_SQLITE_DIALECT, "is not 1"), (_POSTGRESQL_DIALECT, "is not true")],
)
def test_session_filter_quantifiers_probe_lowering_compiles_to_correlated_exists(
    dialect: Dialect, counterexample: str
) -> None:
    """Under the probe lowering `any` is an EXISTS and `all` a NOT EXISTS whose counterexample is
    `IS NOT TRUE`, so a NULL element field excludes the session rather than satisfying the
    quantifier."""
    subquery = SessionFilter(
        'any(s.status_code == "ERROR" for s in spans) '
        "and all(s.llm_token_count_prompt < 1000 for s in spans)"
    ).as_session_rowids_subquery(project_rowids=[1], lowering="probe")
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()

    assert "exists" in compiled
    assert "not (exists" in compiled
    assert counterexample in compiled
    assert "traces.project_session_rowid = project_sessions.id" in compiled
    assert "traces.project_rowid in (1)" in compiled


def test_session_filter_all_keeps_correlated_shape_under_scan_lowering() -> None:
    """`all` compiles to a correlated NOT EXISTS under the scan lowering too. The uncorrelated
    `NOT IN (anti-set)` shape holds every element failing the predicate — most of the element
    table whenever the predicate is selective — and degrades past statement timeouts where the
    correlated form plans as a per-session anti-join probe. `any` keeps the scan semi-join."""
    subquery = SessionFilter(
        'any(s.status_code == "ERROR" for s in spans) '
        "and all(s.llm_token_count_prompt < 1000 for s in spans)"
    ).as_session_rowids_subquery(project_rowids=[1], lowering="scan")
    compiled = str(
        select(models.ProjectSession.id)
        .where(models.ProjectSession.id.in_(subquery))
        .compile(compile_kwargs={"literal_binds": True})
    ).lower()

    assert "not (exists" in compiled
    assert "not in (select" not in compiled
    # The `any` half still lowers to the uncorrelated semi-join.
    assert "project_sessions.id in (select" in compiled


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
