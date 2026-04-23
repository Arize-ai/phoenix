from datetime import datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.api.dataloaders.trace_errors_by_type import TraceErrorsByTypeDataLoader
from phoenix.server.types import DbSessionFactory


def _exception_event(exception_type: str | None) -> dict[str, Any]:
    attributes: dict[str, Any] = {}
    if exception_type is not None:
        attributes["exception.type"] = exception_type
    return {
        "name": "exception",
        "timestamp": "2021-01-01T00:00:00.000+00:00",
        "attributes": attributes,
    }


@pytest.fixture
async def traces_with_exception_events(db: DbSessionFactory) -> tuple[int, int, int, int]:
    """Four traces covering the relevant cases:

    - trace A: no errored spans
    - trace B: one errored span with one ``ValueError`` exception event
    - trace C: one errored span with two exception events (``ValueError``,
      ``KeyError``) + a second errored span with no exception events + a third
      errored span whose ``exception`` event is missing the ``exception.type``
      attribute; the latter two both bucket under ``None``.
    - trace D: mixed — two errored spans with ``ValueError`` and one with
      ``RuntimeError``; also one OK span with an exception event that should
      NOT be counted (status != ERROR).
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="trace_errors_by_type").returning(models.Project.id)
        )

        trace_rowids: list[int] = []
        for i in range(4):
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

        trace_a, trace_b, trace_c, trace_d = trace_rowids

        async def _insert_span(
            trace_rowid: int,
            span_id: str,
            status: str,
            events: list[dict[str, Any]],
        ) -> None:
            await session.execute(
                insert(models.Span).values(
                    trace_rowid=trace_rowid,
                    span_id=span_id,
                    parent_id=None,
                    name=span_id,
                    span_kind="UNKNOWN",
                    start_time=orig_time,
                    end_time=orig_time + timedelta(seconds=1),
                    attributes={},
                    events=events,
                    status_code=status,
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=None,
                    llm_token_count_completion=None,
                )
            )

        # trace A: only OK spans
        await _insert_span(trace_a, "a0", "OK", [])

        # trace B
        await _insert_span(trace_b, "b0", "ERROR", [_exception_event("ValueError")])

        # trace C
        await _insert_span(
            trace_c,
            "c0",
            "ERROR",
            [_exception_event("ValueError"), _exception_event("KeyError")],
        )
        await _insert_span(trace_c, "c1", "ERROR", [])
        # Errored span with an exception event whose `exception.type` attribute
        # is absent — the extraction helper returns None for this case.
        await _insert_span(trace_c, "c2", "ERROR", [_exception_event(None)])

        # trace D
        await _insert_span(trace_d, "d0", "ERROR", [_exception_event("ValueError")])
        await _insert_span(trace_d, "d1", "ERROR", [_exception_event("ValueError")])
        await _insert_span(trace_d, "d2", "ERROR", [_exception_event("RuntimeError")])
        # OK span with an exception event must NOT be counted.
        await _insert_span(trace_d, "d3", "OK", [_exception_event("Ignored")])

        await session.commit()
    return trace_a, trace_b, trace_c, trace_d


async def test_aggregates_and_sort_order(
    db: DbSessionFactory,
    traces_with_exception_events: tuple[int, int, int, int],
) -> None:
    trace_a, trace_b, trace_c, trace_d = traces_with_exception_events
    loader = TraceErrorsByTypeDataLoader(db)

    actual = await loader.load_many([trace_a, trace_b, trace_c, trace_d])

    # No errored spans -> empty list.
    assert actual[0] == []

    # One errored span with one exception event.
    assert actual[1] == [("ValueError", 1)]

    # trace C: ValueError x1 and KeyError x1 from the same multi-event span,
    # plus two contributions to the `None` bucket — one from the errored span
    # with no exception events, and one from the errored span whose exception
    # event lacks an `exception.type` attribute. None leads on count desc;
    # the remaining ties fall back to exception type asc.
    assert actual[2] == [(None, 2), ("KeyError", 1), ("ValueError", 1)]

    # trace D: ValueError x2 (highest), RuntimeError x1; the OK span is
    # ignored despite having an exception event.
    assert actual[3] == [("ValueError", 2), ("RuntimeError", 1)]


async def test_missing_trace_id_returns_empty_list(
    db: DbSessionFactory,
    traces_with_exception_events: tuple[int, int, int, int],
) -> None:
    _, trace_b, _, trace_d = traces_with_exception_events
    loader = TraceErrorsByTypeDataLoader(db)

    missing_key = trace_d + 10_000
    actual = await loader.load_many([missing_key, trace_b])

    assert actual[0] == []
    assert actual[1] == [("ValueError", 1)]
