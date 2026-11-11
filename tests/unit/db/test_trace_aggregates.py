from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.trace_aggregates import (
    cost_summary_by_trace,
    error_count_by_trace,
    num_spans_by_trace,
    representative_root_span_by_trace,
    representative_root_span_of_traces,
    span_kind_count_by_trace,
    token_counts_by_trace,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_span, _add_trace


async def test_trace_aggregate_builders(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        root = await _add_span(
            session,
            trace,
            span_kind="llm",
            llm_token_count_prompt=1,
            llm_token_count_completion=2,
        )
        tool = await _add_span(session, parent_span=root, span_kind="tool")
        tool.status_code = "ERROR"
        session.add(
            models.SpanCost(
                span_rowid=tool.id,
                trace_rowid=trace.id,
                span_start_time=datetime.now(timezone.utc),
                prompt_cost=0.25,
                completion_cost=0.5,
                total_cost=0.75,
                prompt_tokens=100,
                completion_tokens=200,
                total_tokens=300,
            )
        )
        await session.flush()

        rowid = trace.id
        num_spans = (
            (await session.execute(num_spans_by_trace().as_grouped_subquery([rowid])))
            .tuples()
            .all()
        )
        assert num_spans == [(rowid, 2)]

        correlated_num_spans = await session.scalar(
            select(num_spans_by_trace().as_correlated_scalar(models.Trace.id)).where(
                models.Trace.id == rowid
            )
        )
        assert correlated_num_spans == 2

        errors = (
            (await session.execute(error_count_by_trace().as_grouped_subquery([rowid])))
            .tuples()
            .all()
        )
        assert errors == [(rowid, 1)]

        tokens = (await session.execute(token_counts_by_trace().as_grouped_subquery([rowid]))).one()
        assert (tokens.prompt, tokens.completion, tokens.total) == (1, 2, 3)

        costs = (await session.execute(cost_summary_by_trace().as_grouped_subquery([rowid]))).one()
        assert (costs.prompt_cost, costs.completion_cost, costs.total_cost) == (0.25, 0.5, 0.75)

        tool_count = (
            (await session.execute(span_kind_count_by_trace("TOOL").as_grouped_subquery([rowid])))
            .tuples()
            .all()
        )
        llm_count = (
            (await session.execute(span_kind_count_by_trace("LLM").as_grouped_subquery([rowid])))
            .tuples()
            .all()
        )
        assert tool_count == [(rowid, 1)]
        assert llm_count == [(rowid, 1)]


async def test_representative_root_treats_foreign_parent_match_as_orphan(
    db: DbSessionFactory,
) -> None:
    start_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project, start_time=start_time)
        foreign_trace = await _add_trace(session, project, start_time=start_time)
        foreign_parent = await _add_span(session, foreign_trace, start_time=start_time)
        candidate = await _add_span(session, trace, start_time=start_time)
        candidate.parent_id = foreign_parent.span_id
        await _add_span(session, trace, start_time=start_time.replace(second=1))
        await session.flush()

        representative = (
            await session.execute(representative_root_span_by_trace(keys=[trace.id]))
        ).one()

        assert tuple(representative) == (trace.id, candidate.id)


@pytest.mark.parametrize("orphan_span_as_root_span", [True, False])
@pytest.mark.parametrize("scope", ["none", "project", "window", "bounded-window"])
async def test_representative_root_of_traces_matches_ranking_every_span(
    db: DbSessionFactory,
    scope: str,
    orphan_span_as_root_span: bool,
) -> None:
    now = datetime(2026, 11, 10, tzinfo=timezone.utc)
    second = timedelta(seconds=1)

    async def add_trace(
        project: models.Project,
        start: datetime,
        spans: list[tuple[str, Optional[str], timedelta]],
    ) -> models.Trace:
        offsets = [offset for _, _, offset in spans] or [timedelta()]
        trace = await _add_trace(session, project, start_time=start + min(offsets))
        added: dict[str, models.Span] = {}
        for key, parent, offset in spans:
            span = await _add_span(session, trace, start_time=start + offset)
            if parent is not None:
                span.parent_id = added[parent].span_id if parent in added else parent
            added[key] = span
        return trace

    async with db() as session:
        app = await _add_project(session)
        other = await _add_project(session)
        await _add_project(session)
        recent = now - timedelta(days=1)
        await add_trace(app, recent, [("root", None, timedelta()), ("child", "root", second)])
        await add_trace(app, recent, [("root", None, timedelta()), ("child", "root", timedelta())])
        await add_trace(app, recent, [("a", None, timedelta()), ("b", None, timedelta())])
        await add_trace(app, recent, [("root", None, second), ("early_child", "root", timedelta())])
        await add_trace(app, recent, [("orphan", "lost", timedelta()), ("root", None, second)])
        await add_trace(app, recent, [("root", None, timedelta()), ("orphan", "lost", second)])
        await add_trace(app, recent, [("a", "lost", timedelta()), ("b", "lost", timedelta())])
        await add_trace(app, recent, [])
        await add_trace(app, now - timedelta(days=60), [("root", None, timedelta())])
        foreign = await add_trace(other, recent, [("root", None, timedelta())])
        foreign_root = (
            await session.scalars(select(models.Span).where(models.Span.trace_rowid == foreign.id))
        ).one()
        await add_trace(other, recent, [("child", foreign_root.span_id, timedelta())])
        await session.flush()
        trace_rowids = list(await session.scalars(select(models.Trace.id)))

        scopes: dict[str, dict[str, Any]] = {
            "none": {},
            "project": {"project_rowids": [app.id]},
            "window": {"project_rowids": [app.id], "start_time": now - timedelta(days=7)},
            "bounded-window": {
                "start_time": now - timedelta(days=7),
                "end_time": recent + timedelta(minutes=1),
            },
        }
        scope_kwargs = scopes[scope]
        ranked = (
            await session.execute(
                representative_root_span_by_trace(
                    keys=trace_rowids,
                    orphan_span_as_root_span=orphan_span_as_root_span,
                    **scope_kwargs,
                )
            )
        ).all()
        found = (
            await session.execute(
                representative_root_span_of_traces(
                    trace_rowids,
                    orphan_span_as_root_span=orphan_span_as_root_span,
                    **scope_kwargs,
                )
            )
        ).all()

    assert ranked
    assert sorted(map(tuple, found)) == sorted(map(tuple, ranked))
