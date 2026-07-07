from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.session_aggregates import (
    earliest_root_span_by_session,
    num_traces_by_session,
    span_kind_count_by_session,
    token_counts_by_session,
)
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace


async def test_session_aggregate_builders(db: DbSessionFactory) -> None:
    """The grouped/correlated adapters and the earliest-root-span helper agree on a session
    with two traces (each a root LLM span) and one child TOOL span."""
    start = datetime.now(timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project, start_time=start)

        earliest_trace = await _add_trace(session, project, project_session, start_time=start)
        earliest_root_span = await _add_span(
            session,
            earliest_trace,
            span_kind="LLM",
            llm_token_count_prompt=1,
            llm_token_count_completion=2,
        )
        await _add_span(session, parent_span=earliest_root_span, span_kind="TOOL")

        later_trace = await _add_trace(
            session, project, project_session, start_time=start + timedelta(seconds=1)
        )
        await _add_span(
            session,
            later_trace,
            span_kind="LLM",
            llm_token_count_prompt=3,
            llm_token_count_completion=4,
        )

        rowid = project_session.id

        num_traces = (
            await session.execute(num_traces_by_session().as_grouped_subquery([rowid]))
        ).all()
        assert num_traces == [(rowid, 2)]

        # The correlated-scalar fallback returns the same value as the grouped shape.
        correlated_num_traces = await session.scalar(
            select(num_traces_by_session().as_correlated_scalar(models.ProjectSession.id)).where(
                models.ProjectSession.id == rowid
            )
        )
        assert correlated_num_traces == 2

        token_row = (
            await session.execute(token_counts_by_session().as_grouped_subquery([rowid]))
        ).one()
        assert (token_row.prompt, token_row.completion, token_row.total) == (4, 6, 10)

        tool_count = (
            await session.execute(span_kind_count_by_session("TOOL").as_grouped_subquery([rowid]))
        ).all()
        assert tool_count == [(rowid, 1)]
        llm_count = (
            await session.execute(span_kind_count_by_session("LLM").as_grouped_subquery([rowid]))
        ).all()
        assert llm_count == [(rowid, 2)]

        earliest = (await session.execute(earliest_root_span_by_session([rowid]))).all()
        assert earliest == [(rowid, earliest_root_span.id)]
