from datetime import datetime, timezone

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.trace_aggregates import (
    cost_summary_by_trace,
    error_count_by_trace,
    num_spans_by_trace,
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
