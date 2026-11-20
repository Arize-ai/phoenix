"""Span-element cost scalars inside trace and session filter comprehensions.

`total_cost`, `prompt_cost` and `completion_cost` name the *element* span's cost row here.
The trace- and session-level names of the same spelling keep meaning totals across the whole
trace or session, and the tests below pin both readings against the same data.
"""

from datetime import datetime, timedelta
from typing import Any

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from phoenix.trace.dsl.session_filter import SessionFilter
from phoenix.trace.dsl.trace_filter import TraceFilter

_TS = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")

# Two traces whose spans differ in cost, so a predicate that leaks across elements or across
# traces produces a different answer than one that is correctly correlated.
#   trace-a: expensive 1.00 (prompt 0.75 / completion 0.25), cheap 0.10 (0.06 / 0.04)
#   trace-b: middling  0.50 (prompt 0.50 / completion 0.00), uncosted (no span_costs row)
# Each trace is also the only trace of a session of the same letter.
_Costs = tuple[float, float, float]
_Span = tuple[str, str | None, _Costs | None]  # span_id, parent_id, (total, prompt, completion)
_TRACES: dict[str, list[_Span]] = {
    "trace-a": [("expensive", None, (1.0, 0.75, 0.25)), ("cheap", None, (0.1, 0.06, 0.04))],
    "trace-b": [("middling", None, (0.5, 0.5, 0.0)), ("uncosted", None, None)],
}
_SESSIONS = {"trace-a": "session-a", "trace-b": "session-b"}

# Parent edges, for comprehensions nested inside `span.children` or `span.siblings`, and for
# `span.parent_span`.
#   trace-1: root 10.0 -> child 1.0 -> grandchild 0.1
#   trace-2: root 0.5 -> first 2.0 and second 3.0
_NESTED_TRACES: dict[str, list[_Span]] = {
    "trace-1": [
        ("root-1", None, (10.0, 10.0, 0.0)),
        ("child-1", "root-1", (1.0, 1.0, 0.0)),
        ("grandchild-1", "child-1", (0.1, 0.1, 0.0)),
    ],
    "trace-2": [
        ("root-2", None, (0.5, 0.5, 0.0)),
        ("first-2", "root-2", (2.0, 2.0, 0.0)),
        ("second-2", "root-2", (3.0, 3.0, 0.0)),
    ],
}


async def _insert_traces(
    db: DbSessionFactory,
    traces: dict[str, list[_Span]],
    sessions: dict[str, str] | None = None,
) -> dict[str, tuple[int, int]]:
    """Insert the traces with their spans and cost rows.

    Returns the span rowid and trace rowid of each span, by span id.
    """
    rowids: dict[str, tuple[int, int]] = {}
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="element-cost").returning(models.Project.id)
        )
        for trace_id, spans in traces.items():
            project_session_rowid = None
            if sessions is not None:
                project_session_rowid = await session.scalar(
                    insert(models.ProjectSession)
                    .values(
                        session_id=sessions[trace_id],
                        project_id=project_rowid,
                        start_time=_TS,
                        end_time=_TS + timedelta(seconds=60),
                    )
                    .returning(models.ProjectSession.id)
                )
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=trace_id,
                    project_rowid=project_rowid,
                    project_session_rowid=project_session_rowid,
                    start_time=_TS,
                    end_time=_TS + timedelta(seconds=60),
                )
                .returning(models.Trace.id)
            )
            for span_id, parent_id, costs in spans:
                span_rowid = await session.scalar(
                    insert(models.Span)
                    .values(
                        trace_rowid=trace_rowid,
                        span_id=span_id,
                        parent_id=parent_id,
                        name=span_id,
                        span_kind="LLM",
                        start_time=_TS,
                        end_time=_TS + timedelta(seconds=1),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    )
                    .returning(models.Span.id)
                )
                assert span_rowid is not None and trace_rowid is not None
                rowids[span_id] = (span_rowid, trace_rowid)
                if costs is not None:
                    await _insert_cost(session, span_rowid, trace_rowid, costs)
    return rowids


async def _insert_cost(session: Any, span_rowid: int, trace_rowid: int, costs: _Costs) -> None:
    total, prompt, completion = costs
    await session.execute(
        insert(models.SpanCost).values(
            span_rowid=span_rowid,
            trace_rowid=trace_rowid,
            span_start_time=_TS,
            total_cost=total,
            prompt_cost=prompt,
            completion_cost=completion,
            total_tokens=100.0,
            prompt_tokens=75.0,
            completion_tokens=25.0,
        )
    )


@pytest.fixture
async def cost_traces(db: DbSessionFactory) -> None:
    await _insert_traces(db, _TRACES, _SESSIONS)


@pytest.fixture
async def nested_cost_traces(db: DbSessionFactory) -> None:
    await _insert_traces(db, _NESTED_TRACES)


async def _traces(db: DbSessionFactory, condition: str, lowering: Any) -> list[str]:
    async with db() as session:
        stmt = TraceFilter(condition)(select(models.Trace.trace_id), lowering=lowering)
        return sorted(await session.scalars(stmt))


async def _sessions(db: DbSessionFactory, condition: str, lowering: Any) -> list[str]:
    async with db() as session:
        stmt = SessionFilter(condition)(select(models.ProjectSession.session_id), lowering=lowering)
        return sorted(await session.scalars(stmt))


@pytest.mark.parametrize("lowering", ["scan", "probe"])
@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            "any(span.total_cost > 0.5 for span in spans)", ["trace-a"], id="any-total-cost"
        ),
        pytest.param(
            "any(span.prompt_cost > 0.6 for span in spans)", ["trace-a"], id="any-prompt-cost"
        ),
        pytest.param(
            "any(span.completion_cost > 0.1 for span in spans)",
            ["trace-a"],
            id="any-completion-cost",
        ),
        pytest.param(
            "all(span.total_cost > 0.05 for span in spans)", ["trace-a"], id="all-total-cost"
        ),
        pytest.param(
            "sum(span.total_cost for span in spans) > 1.0", ["trace-a"], id="sum-total-cost"
        ),
        pytest.param(
            "max(span.total_cost for span in spans) == 0.5", ["trace-b"], id="max-total-cost"
        ),
    ],
)
async def test_element_cost_filters_traces(
    db: DbSessionFactory,
    cost_traces: None,
    condition: str,
    expected: list[str],
    lowering: Any,
) -> None:
    assert await _traces(db, condition, lowering) == expected


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_element_cost_cannot_match_another_spans_cost(
    db: DbSessionFactory, cost_traces: None, lowering: Any
) -> None:
    """The scalar is correlated to its own element, not to any span in the trace.

    `trace-a` holds a span costing 1.00 and one costing 0.10. No single span has a prompt
    cost of 0.75 together with a total cost of 0.10, so a predicate demanding both on the
    *same* element must reject the trace; an uncorrelated lowering would accept it.
    """
    both_on_one_span = "any(span.prompt_cost == 0.75 and span.total_cost == 0.1 for span in spans)"
    assert await _traces(db, both_on_one_span, lowering) == []

    # The same two values, each satisfied by a different span, still matches.
    split_across_spans = (
        "any(span.prompt_cost == 0.75 for span in spans)"
        " and any(span.total_cost == 0.1 for span in spans)"
    )
    assert await _traces(db, split_across_spans, lowering) == ["trace-a"]


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_span_without_a_cost_row_reads_zero(
    db: DbSessionFactory, cost_traces: None, lowering: Any
) -> None:
    """A missing `span_costs` row coalesces to 0 rather than dropping the span.

    `trace-b` holds one uncosted span. It must still be visible to the comprehension, so
    `all(... > 0)` fails for that trace while `any(... == 0)` finds it.
    """
    assert await _traces(db, "any(span.total_cost == 0 for span in spans)", lowering) == ["trace-b"]
    assert await _traces(db, "all(span.total_cost > 0 for span in spans)", lowering) == ["trace-a"]


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_trace_level_cost_names_still_mean_trace_totals(
    db: DbSessionFactory, cost_traces: None, lowering: Any
) -> None:
    """Element names must not change what the bare trace-level names mean.

    `trace-a` totals 1.10 across its two spans while its largest single span is 1.00, so a
    threshold between the two separates the readings.
    """
    assert await _traces(db, "total_cost > 1.05", lowering) == ["trace-a"]
    assert await _traces(db, "any(span.total_cost > 1.05 for span in spans)", lowering) == []


@pytest.mark.parametrize("lowering", ["scan", "probe"])
@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            "any(any(child.total_cost < span.total_cost for child in span.children)"
            " for span in spans)",
            ["trace-1"],
            id="outer-element-in-children",
        ),
        pytest.param(
            "any(any(sibling.total_cost > span.total_cost for sibling in span.siblings)"
            " for span in spans)",
            ["trace-2"],
            id="outer-element-in-siblings",
        ),
        pytest.param(
            "any(any(child.total_cost == 0.1 and span.parent_span.total_cost == 10.0"
            " for child in span.children) for span in spans)",
            ["trace-1"],
            id="outer-parent-span-in-children",
        ),
        pytest.param(
            "any(any(child.total_cost == 3.0 and span.parent_span.total_cost == 10.0"
            " for child in span.children) for span in spans)",
            [],
            id="outer-parent-span-of-another-trace",
        ),
        pytest.param(
            "any(span.parent_span.total_cost > 5 for span in spans)",
            ["trace-1"],
            id="parent-span-cost",
        ),
    ],
)
async def test_element_cost_in_nested_scopes(
    db: DbSessionFactory,
    nested_cost_traces: None,
    condition: str,
    expected: list[str],
    lowering: Any,
) -> None:
    """A cost read from an outer element stays correlated to that element.

    In `trace-1` each span costs more than its child. In `trace-2` the root costs less than both
    children, and the first child costs less than its sibling.
    """
    assert await _traces(db, condition, lowering) == expected


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_parent_span_cost_is_missing_without_a_parent(
    db: DbSessionFactory, nested_cost_traces: None, lowering: Any
) -> None:
    """A root span has no parent row, so its parent's cost is missing, not 0.

    Every stored parent has a cost row, so only a root span could make this match.
    """
    condition = "any(span.parent_span.total_cost == 0 for span in spans)"
    assert await _traces(db, condition, lowering) == []
    condition = "any(span.parent_span.total_cost is None for span in spans)"
    assert await _traces(db, condition, lowering) == ["trace-1", "trace-2"]


@pytest.mark.parametrize("lowering", ["scan", "probe"])
async def test_span_with_two_cost_rows_reads_their_sum(db: DbSessionFactory, lowering: Any) -> None:
    """`span_costs.span_rowid` is not unique. Two rows for one span add up, as the top-level
    cost names do, instead of making the query fail on PostgreSQL."""
    rowids = await _insert_traces(db, {"trace-x": [("twice", None, (0.5, 0.5, 0.0))]})
    async with db() as session:
        await _insert_cost(session, *rowids["twice"], (0.25, 0.25, 0.0))
    condition = "any(span.total_cost == 0.75 for span in spans)"
    assert await _traces(db, condition, lowering) == ["trace-x"]


@pytest.mark.parametrize("lowering", ["scan", "probe"])
@pytest.mark.parametrize(
    "condition,expected",
    [
        pytest.param(
            "any(span.total_cost > 0.5 for span in spans)", ["session-a"], id="any-total-cost"
        ),
        pytest.param(
            "any(span.prompt_cost == 0.75 and span.total_cost == 0.1 for span in spans)",
            [],
            id="element-correlation",
        ),
        pytest.param(
            "any(span.prompt_cost == 0.75 for span in spans)"
            " and any(span.total_cost == 0.1 for span in spans)",
            ["session-a"],
            id="split-across-spans",
        ),
        pytest.param(
            "any(span.total_cost == 0 for span in spans)", ["session-b"], id="missing-cost-row"
        ),
        pytest.param(
            "all(span.completion_cost > 0 for span in spans)",
            ["session-a"],
            id="all-completion-cost",
        ),
        pytest.param(
            "any(any(span.total_cost > 0.5 for span in trace.spans) for trace in traces)",
            ["session-a"],
            id="nested-trace-spans",
        ),
        pytest.param("total_cost > 1.05", ["session-a"], id="session-total-cost"),
        pytest.param(
            "any(span.total_cost > 1.05 for span in spans)", [], id="no-span-above-session-total"
        ),
    ],
)
async def test_element_cost_filters_sessions(
    db: DbSessionFactory,
    cost_traces: None,
    condition: str,
    expected: list[str],
    lowering: Any,
) -> None:
    """The session grammar reads the same per-span costs, both directly and through traces.

    The session-level `total_cost` still totals the whole session: `session-a` totals 1.10
    while its largest span is 1.00.
    """
    assert await _sessions(db, condition, lowering) == expected
