from datetime import datetime, timedelta

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.api.dataloaders.trace_error_count import TraceErrorCountDataLoader
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def traces_with_errors(db: DbSessionFactory) -> tuple[int, int, int]:
    """Three traces:

    - trace A: 0 errored spans, 2 OK
    - trace B: 1 errored span, 1 OK
    - trace C: 3 errored spans
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="trace_errors").returning(models.Project.id)
        )

        trace_rowids: list[int] = []
        for i in range(3):
            trace_id = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=f"trace_{i}",
                    project_rowid=project_id,
                    start_time=orig_time,
                    end_time=orig_time + timedelta(seconds=1),
                )
                .returning(models.Trace.id)
            )
            assert trace_id is not None
            trace_rowids.append(trace_id)

        statuses_per_trace: dict[int, list[str]] = {
            trace_rowids[0]: ["OK", "OK"],
            trace_rowids[1]: ["ERROR", "OK"],
            trace_rowids[2]: ["ERROR", "ERROR", "ERROR"],
        }
        for trace_rowid, statuses in statuses_per_trace.items():
            for j, status in enumerate(statuses):
                await session.execute(
                    insert(models.Span).values(
                        trace_rowid=trace_rowid,
                        span_id=f"trace{trace_rowid}_span{j}",
                        parent_id=None,
                        name=f"span{j}",
                        span_kind="UNKNOWN",
                        start_time=orig_time,
                        end_time=orig_time + timedelta(seconds=1),
                        attributes={},
                        events=[],
                        status_code=status,
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                        llm_token_count_prompt=None,
                        llm_token_count_completion=None,
                    )
                )
        await session.commit()
    return trace_rowids[0], trace_rowids[1], trace_rowids[2]


async def test_counts_error_status_only(
    db: DbSessionFactory,
    traces_with_errors: tuple[int, int, int],
) -> None:
    trace_a, trace_b, trace_c = traces_with_errors
    loader = TraceErrorCountDataLoader(db)

    actual = await loader.load_many([trace_a, trace_b, trace_c])

    assert actual == [0, 1, 3]


async def test_missing_trace_id_returns_zero(
    db: DbSessionFactory,
    traces_with_errors: tuple[int, int, int],
) -> None:
    trace_a, _, trace_c = traces_with_errors
    loader = TraceErrorCountDataLoader(db)

    missing_key = trace_c + 10_000
    actual = await loader.load_many([missing_key, trace_a, trace_c])

    assert actual == [0, 0, 3]
