from datetime import datetime, timedelta

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.api.dataloaders.trace_span_counts_by_kind import (
    TraceSpanCountsByKindDataLoader,
)
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def traces_with_span_kinds(db: DbSessionFactory) -> tuple[int, int, int]:
    """Three traces:

    - trace A: 2 LLM, 1 TOOL, 1 CHAIN
    - trace B: 3 CHAIN
    - trace C: no spans
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="trace_span_kinds").returning(models.Project.id)
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

        kinds_per_trace = {
            trace_rowids[0]: ["LLM", "LLM", "TOOL", "CHAIN"],
            trace_rowids[1]: ["CHAIN", "CHAIN", "CHAIN"],
            trace_rowids[2]: [],
        }
        for trace_rowid, kinds in kinds_per_trace.items():
            for j, kind in enumerate(kinds):
                await session.execute(
                    insert(models.Span).values(
                        trace_rowid=trace_rowid,
                        span_id=f"trace{trace_rowid}_span{j}",
                        parent_id=None,
                        name=f"span{j}",
                        span_kind=kind,
                        start_time=orig_time,
                        end_time=orig_time + timedelta(seconds=1),
                        attributes={},
                        events=[],
                        status_code="OK",
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


async def test_counts_are_grouped_per_trace_and_deterministic(
    db: DbSessionFactory,
    traces_with_span_kinds: tuple[int, int, int],
) -> None:
    trace_a, trace_b, trace_c = traces_with_span_kinds
    loader = TraceSpanCountsByKindDataLoader(db)

    actual = await loader.load_many([trace_a, trace_b, trace_c])

    # trace A: LLM (2) is most common, then CHAIN (1) and TOOL (1) broken by
    # alphabetical order on the kind string.
    assert actual[0] == [("LLM", 2), ("CHAIN", 1), ("TOOL", 1)]
    assert actual[1] == [("CHAIN", 3)]
    assert actual[2] == []


async def test_missing_trace_id_returns_empty_list(
    db: DbSessionFactory,
    traces_with_span_kinds: tuple[int, int, int],
) -> None:
    trace_a, _, _ = traces_with_span_kinds
    loader = TraceSpanCountsByKindDataLoader(db)

    missing_key = trace_a + 10_000
    actual = await loader.load_many([missing_key, trace_a])

    assert actual[0] == []
    assert actual[1] == [("LLM", 2), ("CHAIN", 1), ("TOOL", 1)]
