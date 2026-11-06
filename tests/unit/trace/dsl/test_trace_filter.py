from datetime import timedelta
from typing import Any, cast

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.server.trace_filters import apply_trace_filter_to_page
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.trace_filter import (
    _ITERABLE_SPECS,
    FilterLowering,
    TraceFilter,
)
from tests.unit._helpers import _add_project, _add_span, _add_trace
from tests.unit.trace.dsl.trace_filter_reference import (
    DIFFERENTIAL_CONDITIONS,
    FIXTURE_TRACES,
    ReferenceTrace,
    matches,
)

_SQLITE_DIALECT = cast(Dialect, sqlite.dialect())
_POSTGRESQL_DIALECT = cast(Dialect, postgresql.dialect())  # type: ignore[no-untyped-call]


async def _seed_reference_trace(
    session: AsyncSession,
    project: models.Project,
    fixture: ReferenceTrace,
) -> models.Trace:
    trace = await _add_trace(
        session,
        project,
        start_time=fixture.start_time,
        end_time=fixture.end_time,
    )
    trace.trace_id = fixture.trace_id
    root_span: models.Span | None = None
    for index, reference_span in enumerate(fixture.spans):
        start_time = fixture.start_time + timedelta(milliseconds=index)
        span = await _add_span(
            session,
            trace if reference_span.parent != "root" else None,
            parent_span=root_span if reference_span.parent == "root" else None,
            span_kind=reference_span.span_kind,
            attributes=None
            if reference_span.attributes is None
            else dict(reference_span.attributes),
            start_time=start_time,
            end_time=start_time + timedelta(milliseconds=reference_span.latency_ms),
            cumulative_error_count=fixture.cumulative_error_count(reference_span),
            cumulative_llm_token_count_prompt=fixture.cumulative_token_count(
                reference_span, "prompt"
            ),
            cumulative_llm_token_count_completion=fixture.cumulative_token_count(
                reference_span, "completion"
            ),
            llm_token_count_prompt=reference_span.llm_token_count_prompt,
            llm_token_count_completion=reference_span.llm_token_count_completion,
        )
        span.name = reference_span.name
        span.status_code = reference_span.status_code.upper()
        if reference_span.parent == "missing-parent":
            span.parent_id = "missing-parent"
        if reference_span.parent is None and root_span is None:
            root_span = span
        for annotation in reference_span.annotations:
            session.add(
                models.SpanAnnotation(
                    span_rowid=span.id,
                    name=annotation.name,
                    label=annotation.label,
                    score=annotation.score,
                    explanation=None,
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="APP",
                    identifier=annotation.identifier,
                )
            )
        if (cost := reference_span.cost) is not None:
            prompt_tokens = sum(detail.tokens or 0 for detail in cost.details if detail.is_prompt)
            completion_tokens = sum(
                detail.tokens or 0 for detail in cost.details if not detail.is_prompt
            )
            span_cost = models.SpanCost(
                span_rowid=span.id,
                trace_rowid=trace.id,
                span_start_time=span.start_time,
                prompt_cost=cost.prompt_cost,
                completion_cost=cost.completion_cost,
                total_cost=cost.total_cost,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=prompt_tokens + completion_tokens,
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
            models.TraceAnnotation(
                trace_rowid=trace.id,
                name=annotation.name,
                label=annotation.label,
                score=annotation.score,
                explanation=None,
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier=annotation.identifier,
            )
        )
    await session.flush()
    return trace


def _filtered_stmt(
    trace_filter: TraceFilter,
    project: models.Project,
    lowering: FilterLowering,
) -> Any:
    return trace_filter(
        select(models.Trace.id).where(models.Trace.project_rowid == project.id),
        lowering=lowering,
    )


async def _matched_rowids(
    session: AsyncSession,
    trace_filter: TraceFilter,
    project: models.Project,
    lowering: FilterLowering,
) -> set[int]:
    return set(await session.scalars(_filtered_stmt(trace_filter, project, lowering)))


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_scoped_trace_filter_agrees_with_reference_evaluator(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    """The candidate/project/time bounds are a pruning hint for the scan-lowered reduction
    subqueries. They are sound only when the outer statement already selects the same trace
    universe — which this test's outer statement does — and under that precondition both
    lowerings must still agree with the reference evaluator on every differential condition."""
    window_start = FIXTURE_TRACES[0].start_time
    window_end = window_start + timedelta(minutes=2)
    in_window = [f for f in FIXTURE_TRACES if window_start <= f.start_time < window_end]
    assert 1 < len(in_window) < len(FIXTURE_TRACES)
    # Drop one in-window trace from the candidates so every bound prunes something.
    selected = in_window[:1] + in_window[2:]
    async with db() as session:
        project = await _add_project(session)
        rowids = {
            fixture.trace_id: (await _seed_reference_trace(session, project, fixture)).id
            for fixture in FIXTURE_TRACES
        }
        candidates = [rowids[fixture.trace_id] for fixture in selected]
        base_stmt = (
            select(models.Trace.id)
            .where(models.Trace.project_rowid == project.id)
            .where(models.Trace.start_time >= window_start)
            .where(models.Trace.start_time < window_end)
            .where(models.Trace.id.in_(candidates))
        )
        for condition in DIFFERENTIAL_CONDITIONS:
            stmt = TraceFilter(condition)(
                base_stmt,
                candidate_trace_rowids=candidates,
                project_rowids=[project.id],
                start_time=window_start,
                end_time=window_end,
                lowering=lowering,
            )
            stmt.compile(dialect=_SQLITE_DIALECT)
            stmt.compile(dialect=_POSTGRESQL_DIALECT)
            expected = {
                rowids[fixture.trace_id] for fixture in selected if matches(condition, fixture)
            }
            assert set(await session.scalars(stmt)) == expected, condition


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_trace_filter_agrees_with_reference_evaluator(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        rowids = {
            fixture.trace_id: (await _seed_reference_trace(session, project, fixture)).id
            for fixture in FIXTURE_TRACES
        }
        for condition in DIFFERENTIAL_CONDITIONS:
            trace_filter = TraceFilter(condition)
            stmt = _filtered_stmt(trace_filter, project, lowering)
            stmt.compile(dialect=_SQLITE_DIALECT)
            stmt.compile(dialect=_POSTGRESQL_DIALECT)
            expected = {
                rowids[fixture.trace_id]
                for fixture in FIXTURE_TRACES
                if matches(condition, fixture)
            }
            assert set(await session.scalars(stmt)) == expected, condition


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_error_count_agrees_with_errored_span_comprehension(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        for fixture in FIXTURE_TRACES:
            await _seed_reference_trace(session, project, fixture)
        by_count = await _matched_rowids(session, TraceFilter("error_count > 0"), project, lowering)
        by_members = await _matched_rowids(
            session,
            TraceFilter('any(span.status_code == "ERROR" for span in spans)'),
            project,
            lowering,
        )
        assert by_count == by_members


@pytest.mark.parametrize(
    "condition",
    [
        'float(attributes["numeric"]) > 5',
        'attributes["boolean"] == True',
    ],
)
@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_root_attribute_casts_execute(
    db: DbSessionFactory,
    lowering: FilterLowering,
    condition: str,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        matching_trace = await _add_trace(session, project)
        await _add_span(
            session,
            matching_trace,
            attributes={"numeric": 7, "boolean": True},
        )
        non_matching_trace = await _add_trace(session, project)
        await _add_span(
            session,
            non_matching_trace,
            attributes={"numeric": 1, "boolean": False},
        )

        assert await _matched_rowids(
            session,
            TraceFilter(condition),
            project,
            lowering,
        ) == {matching_trace.id}


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_root_io_uses_wire_key_candidate_paths(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        await _add_span(
            session,
            trace,
            attributes={
                "input": "prefix",
                "input.value": "valid-input",
                "output": "prefix",
                "output.value": "valid-output",
            },
        )

        assert await _matched_rowids(
            session,
            TraceFilter('input == "valid-input" and output == "valid-output"'),
            project,
            lowering,
        ) == {trace.id}


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_root_bindings_use_displayed_representative(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    start_time = FIXTURE_TRACES[0].start_time
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project, start_time=start_time)
        await _add_span(
            session,
            trace,
            attributes={"input": {"value": "displayed"}},
            start_time=start_time,
        )
        await _add_span(
            session,
            trace,
            attributes={"input": {"value": "other"}},
            start_time=start_time + timedelta(seconds=1),
        )

        assert await _matched_rowids(
            session,
            TraceFilter('input == "displayed"'),
            project,
            lowering,
        ) == {trace.id}
        assert not await _matched_rowids(
            session,
            TraceFilter('input == "other"'),
            project,
            lowering,
        )


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_root_bindings_treat_foreign_parent_match_as_orphan(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    start_time = FIXTURE_TRACES[0].start_time
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project, start_time=start_time)
        foreign_trace = await _add_trace(session, project, start_time=start_time)
        foreign_parent = await _add_span(session, foreign_trace, start_time=start_time)
        candidate = await _add_span(
            session,
            trace,
            attributes={"input": {"value": "orphan"}},
            start_time=start_time,
        )
        candidate.parent_id = foreign_parent.span_id
        await _add_span(
            session,
            trace,
            attributes={"input": {"value": "strict"}},
            start_time=start_time + timedelta(seconds=1),
        )

        assert await _matched_rowids(
            session,
            TraceFilter('input == "orphan"'),
            project,
            lowering,
        ) == {trace.id}


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_span_relationships_do_not_cross_trace_or_treat_orphans_as_siblings(
    db: DbSessionFactory,
    lowering: FilterLowering,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        target_trace = await _add_trace(session, project)
        target_root = await _add_span(session, target_trace)
        foreign_trace = await _add_trace(session, project)
        foreign_span = await _add_span(session, foreign_trace)
        foreign_span.name = "foreign"
        foreign_span.parent_id = target_root.span_id

        foreign_parent = await _add_span(session, foreign_trace)
        foreign_parent.name = "foreign-parent"
        target_orphan = await _add_span(session, target_trace)
        target_orphan.parent_id = foreign_parent.span_id

        first_orphan = await _add_span(session, target_trace)
        second_orphan = await _add_span(session, target_trace)
        first_orphan.parent_id = second_orphan.parent_id = "dangling-parent"
        await session.flush()

        for condition in (
            'any(any(c.name == "foreign" for c in s.children) for s in spans)',
            'any(s.parent_span.name == "foreign-parent" for s in spans)',
            'any(any(sibling.parent_id == "dangling-parent" for sibling in s.siblings) '
            "for s in spans)",
        ):
            assert not await _matched_rowids(
                session,
                TraceFilter(condition),
                project,
                lowering,
            ), condition


def test_trace_iterable_correlation_keys_are_non_nullable() -> None:
    assert set(_ITERABLE_SPECS) == {
        "spans",
        "trace_annotations",
        "span_annotations",
        "span_cost_details",
    }
    for spec in _ITERABLE_SPECS.values():
        column = spec.trace_key_model.trace_rowid.property.columns[0]
        assert column.nullable is False, column


def test_scan_aggregate_subquery_is_scoped_to_candidates_project_and_time() -> None:
    start_time = FIXTURE_TRACES[0].start_time
    sql = str(
        TraceFilter("num_spans >= 5")(
            select(models.Trace.id),
            candidate_trace_rowids=[11, 12],
            project_rowids=[7],
            start_time=start_time,
            end_time=start_time + timedelta(hours=1),
            lowering="scan",
        ).compile(dialect=_POSTGRESQL_DIALECT)
    ).lower()

    assert "spans.trace_rowid in" in sql
    assert "join traces as trace_scope on trace_scope.id = spans.trace_rowid" in sql
    assert "trace_scope.project_rowid in" in sql
    assert "trace_scope.start_time >=" in sql
    assert "trace_scope.start_time <" in sql


@pytest.mark.parametrize("dialect", [_SQLITE_DIALECT, _POSTGRESQL_DIALECT])
@pytest.mark.parametrize(
    "condition,shape",
    [
        ('all(s.status_code == "OK" for s in spans)', "not (exists (select 1"),
        ('not any(s.status_code == "ERROR" for s in spans)', "not (exists (select 1"),
        ('any(s.status_code == "ERROR" for s in spans)', "exists (select 1"),
    ],
)
def test_trace_filter_quantifiers_keep_correlated_shape_under_scan_lowering(
    dialect: Dialect,
    condition: str,
    shape: str,
) -> None:
    """No quantifier spelling reaches an uncorrelated `IN` / `NOT IN` anti-set under scan."""
    sql = str(
        TraceFilter(condition)(
            select(models.Trace.id),
            project_rowids=[7],
            lowering="scan",
        ).compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()

    assert shape in sql
    assert "in (select" not in sql
    assert "spans_0.trace_rowid = traces.id" in sql


@pytest.mark.parametrize("dialect", [_SQLITE_DIALECT, _POSTGRESQL_DIALECT])
def test_scan_comprehension_subqueries_are_scoped_to_candidates_project_and_time(
    dialect: Dialect,
) -> None:
    start_time = FIXTURE_TRACES[0].start_time
    sql = str(
        TraceFilter(
            'any(s.status_code == "ERROR" for s in spans) '
            "and len([s for s in spans if s.span_kind == 'LLM']) > 0"
        )(
            select(models.Trace.id),
            candidate_trace_rowids=[11, 12],
            project_rowids=[7],
            start_time=start_time,
            end_time=start_time + timedelta(hours=1),
            lowering="scan",
        ).compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()

    # Only the `len` reduction takes the scan shape and carries the bounds; the quantifier
    # stays a correlated probe against the trace's own spans.
    assert sql.count("join traces as trace_scope") == 1
    assert sql.count("trace_scope.project_rowid in (7)") == 1
    assert sql.count("trace_scope.start_time >=") == 1
    assert sql.count("trace_scope.start_time <") == 1
    assert sql.count("trace_rowid in (11, 12)") == 1
    assert "traces.id in (select" not in sql
    assert "exists (select 1" in sql
    assert "from spans as spans_0 where spans_0.trace_rowid = traces.id" in " ".join(sql.split())


def test_trace_page_filter_uses_probe_lowering() -> None:
    sql = str(
        apply_trace_filter_to_page(
            select(models.Trace.id),
            'all(s.span_kind == "LLM" for s in spans)',
            project_rowids=[7],
        ).compile(dialect=_POSTGRESQL_DIALECT)
    ).lower()

    assert "not (exists (select" in sql
    assert "not in (select" not in sql


def test_trace_parent_fields_share_one_left_self_join() -> None:
    compiled = str(
        TraceFilter(
            'any(s.parent_span.name == "finalize" and s.parent_span.status_code == "OK" '
            "and s.parent_span.parent_id is None for s in spans)"
        )(select(models.Trace.id)).compile(dialect=_POSTGRESQL_DIALECT)
    ).lower()

    assert compiled.count("left outer join spans as parent_") == 1


@pytest.mark.parametrize(
    "condition",
    [
        "first(s.start_time for s in spans) is None",
        "any(any(x.name == s.name for x in s.before) for s in spans)",
        'any(s.parent_span.parent_span.name == "x" for s in spans)',
        "any(s.parent_span == True for s in spans)",
        "any(any(any(y.name == c.name for y in c.children) for c in s.children) for s in spans)",
    ],
)
def test_trace_filter_rejects_unsettled_topology_and_ordering_forms(condition: str) -> None:
    with pytest.raises(SyntaxError):
        TraceFilter(condition)
