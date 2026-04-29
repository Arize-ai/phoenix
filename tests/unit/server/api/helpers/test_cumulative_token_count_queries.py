from datetime import datetime, timedelta

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.api.helpers.cumulative_token_count_queries import (
    cumulative_token_counts_by_session,
    cumulative_token_counts_by_trace,
)
from phoenix.server.types import DbSessionFactory

_BASE_TIME = datetime.fromisoformat("2024-01-01T00:00:00+00:00")


def _span_values(
    trace_rowid: int,
    span_id: str,
    *,
    parent_id: str | None = None,
    cumulative_prompt: int = 0,
    cumulative_completion: int = 0,
) -> dict[str, object]:
    return dict(
        trace_rowid=trace_rowid,
        span_id=span_id,
        parent_id=parent_id,
        name=span_id,
        span_kind="LLM",
        start_time=_BASE_TIME,
        end_time=_BASE_TIME + timedelta(seconds=1),
        attributes={},
        events=[],
        status_code="OK",
        status_message="",
        cumulative_error_count=0,
        cumulative_llm_token_count_prompt=cumulative_prompt,
        cumulative_llm_token_count_completion=cumulative_completion,
        llm_token_count_prompt=None,
        llm_token_count_completion=None,
    )


@pytest.fixture
async def token_count_data(db: DbSessionFactory) -> dict[str, int]:
    """
    Creates two sessions each with two traces.
    Session 1 / Trace 1: one root span (prompt=10, completion=20)
    Session 1 / Trace 2: two root spans (prompt=5+15=20, completion=8+12=20)
    Session 2 / Trace 3: one root span (prompt=100, completion=200)
    Session 2 / Trace 4: no spans (missing root — tests zero fallback)
    """
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="tok_test").returning(models.Project.id)
        )
        assert project_id is not None
        sess1_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="sess1",
                project_id=project_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME,
            )
            .returning(models.ProjectSession.id)
        )
        assert sess1_id is not None
        sess2_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="sess2",
                project_id=project_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME,
            )
            .returning(models.ProjectSession.id)
        )
        assert sess2_id is not None
        trace1_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace1",
                project_rowid=project_id,
                project_session_rowid=sess1_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace1_id is not None
        trace2_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace2",
                project_rowid=project_id,
                project_session_rowid=sess1_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace2_id is not None
        trace3_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace3",
                project_rowid=project_id,
                project_session_rowid=sess2_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace3_id is not None
        trace4_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace4",
                project_rowid=project_id,
                project_session_rowid=sess2_id,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME + timedelta(seconds=1),
            )
            .returning(models.Trace.id)
        )
        assert trace4_id is not None
        # Trace 1: single root span
        await session.execute(
            insert(models.Span).values(
                **_span_values(trace1_id, "s1", cumulative_prompt=10, cumulative_completion=20)
            )
        )
        # Trace 2: two root spans (multi-root correctness case)
        await session.execute(
            insert(models.Span).values(
                **_span_values(trace2_id, "s2a", cumulative_prompt=5, cumulative_completion=8)
            )
        )
        await session.execute(
            insert(models.Span).values(
                **_span_values(trace2_id, "s2b", cumulative_prompt=15, cumulative_completion=12)
            )
        )
        # Child span — excluded by parent_id IS NULL filter
        await session.execute(
            insert(models.Span).values(
                **_span_values(
                    trace2_id,
                    "s2c",
                    parent_id="s2a",
                    cumulative_prompt=999,
                    cumulative_completion=999,
                )
            )
        )
        # Trace 3: single root span
        await session.execute(
            insert(models.Span).values(
                **_span_values(trace3_id, "s3", cumulative_prompt=100, cumulative_completion=200)
            )
        )
        # Trace 4: no spans at all (tests missing-key zero fallback)

    return dict(
        sess1_id=sess1_id,
        sess2_id=sess2_id,
        trace1_id=trace1_id,
        trace2_id=trace2_id,
        trace3_id=trace3_id,
        trace4_id=trace4_id,
    )


# --- cumulative_token_counts_by_session ---


async def test_session_empty_keys(db: DbSessionFactory, token_count_data: dict[str, int]) -> None:
    stmt = cumulative_token_counts_by_session([])
    async with db.read() as session:
        rows = [row async for row in await session.stream(stmt)]
    assert rows == []


async def test_session_single_key(db: DbSessionFactory, token_count_data: dict[str, int]) -> None:
    sess1_id = token_count_data["sess1_id"]
    stmt = cumulative_token_counts_by_session([sess1_id])
    async with db.read() as session:
        rows: dict[int, tuple[int, int]] = {
            id_: (prompt, completion)
            async for id_, prompt, completion in await session.stream(stmt)
        }
    assert rows[sess1_id] == (10 + 20, 20 + 20)


async def test_session_multi_key(db: DbSessionFactory, token_count_data: dict[str, int]) -> None:
    sess1_id = token_count_data["sess1_id"]
    sess2_id = token_count_data["sess2_id"]
    stmt = cumulative_token_counts_by_session([sess1_id, sess2_id])
    async with db.read() as session:
        rows: dict[int, tuple[int, int]] = {
            id_: (prompt, completion)
            async for id_, prompt, completion in await session.stream(stmt)
        }
    # Session 1: trace1(10,20) + trace2(5+15, 8+12) = (30, 40)
    assert rows[sess1_id] == (30, 40)
    # Session 2: trace3(100,200) — trace4 has no spans so contributes nothing
    assert rows[sess2_id] == (100, 200)


async def test_session_missing_key_absent_from_result(
    db: DbSessionFactory, token_count_data: dict[str, int]
) -> None:
    stmt = cumulative_token_counts_by_session([999999])
    async with db.read() as session:
        rows = [row async for row in await session.stream(stmt)]
    assert rows == []


# --- cumulative_token_counts_by_trace ---


async def test_trace_empty_keys(db: DbSessionFactory, token_count_data: dict[str, int]) -> None:
    stmt = cumulative_token_counts_by_trace([])
    async with db.read() as session:
        rows = [row async for row in await session.stream(stmt)]
    assert rows == []


async def test_trace_single_key(db: DbSessionFactory, token_count_data: dict[str, int]) -> None:
    trace1_id = token_count_data["trace1_id"]
    stmt = cumulative_token_counts_by_trace([trace1_id])
    async with db.read() as session:
        rows: dict[int, tuple[int, int]] = {
            id_: (prompt, completion)
            async for id_, prompt, completion in await session.stream(stmt)
        }
    assert rows[trace1_id] == (10, 20)


async def test_trace_multi_key_includes_multi_root_sum(
    db: DbSessionFactory, token_count_data: dict[str, int]
) -> None:
    trace1_id = token_count_data["trace1_id"]
    trace2_id = token_count_data["trace2_id"]
    trace3_id = token_count_data["trace3_id"]
    stmt = cumulative_token_counts_by_trace([trace1_id, trace2_id, trace3_id])
    async with db.read() as session:
        rows: dict[int, tuple[int, int]] = {
            id_: (prompt, completion)
            async for id_, prompt, completion in await session.stream(stmt)
        }
    assert rows[trace1_id] == (10, 20)
    # Multi-root: SUM of both root spans; child span excluded by parent_id IS NULL
    assert rows[trace2_id] == (5 + 15, 8 + 12)
    assert rows[trace3_id] == (100, 200)


async def test_trace_missing_key_absent_from_result(
    db: DbSessionFactory, token_count_data: dict[str, int]
) -> None:
    stmt = cumulative_token_counts_by_trace([999999])
    async with db.read() as session:
        rows = [row async for row in await session.stream(stmt)]
    assert rows == []


async def test_trace_no_spans_absent_from_result(
    db: DbSessionFactory, token_count_data: dict[str, int]
) -> None:
    # Trace 4 has no spans — absent from results; caller defaults to 0
    trace4_id = token_count_data["trace4_id"]
    stmt = cumulative_token_counts_by_trace([trace4_id])
    async with db.read() as session:
        rows = [row async for row in await session.stream(stmt)]
    assert rows == []
