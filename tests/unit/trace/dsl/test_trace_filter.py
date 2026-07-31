from datetime import timedelta
from typing import Any, cast

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
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


def test_trace_iterable_correlation_keys_are_non_nullable() -> None:
    assert set(_ITERABLE_SPECS) == {
        "spans",
        "trace_annotations",
        "span_annotations",
        "span_cost_details",
    }
    for spec in _ITERABLE_SPECS.values():
        column = spec.trace_key(spec.model).property.columns[0]
        assert column.nullable is False, column
