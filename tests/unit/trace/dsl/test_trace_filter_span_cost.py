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
_TRACES: dict[str, list[tuple[str, tuple[float, float, float] | None]]] = {
    "trace-a": [("expensive", (1.0, 0.75, 0.25)), ("cheap", (0.1, 0.06, 0.04))],
    "trace-b": [("middling", (0.5, 0.5, 0.0)), ("uncosted", None)],
}


@pytest.fixture
async def cost_traces(db: DbSessionFactory) -> None:
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="element-cost").returning(models.Project.id)
        )
        for trace_id, spans in _TRACES.items():
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=trace_id,
                    project_rowid=project_rowid,
                    start_time=_TS,
                    end_time=_TS + timedelta(seconds=60),
                )
                .returning(models.Trace.id)
            )
            for span_id, costs in spans:
                span_rowid = await session.scalar(
                    insert(models.Span)
                    .values(
                        trace_rowid=trace_rowid,
                        span_id=span_id,
                        parent_id=None,
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
                if costs is None:
                    continue
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


async def _traces(db: DbSessionFactory, condition: str, lowering: Any) -> list[str]:
    async with db() as session:
        stmt = TraceFilter(condition)(select(models.Trace.trace_id), lowering=lowering)
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


async def test_session_filter_exposes_element_cost(db: DbSessionFactory) -> None:
    """The session vocabulary gains the same three names."""
    for condition in (
        "any(span.total_cost > 0.5 for span in spans)",
        "any(span.prompt_cost > 0 for span in spans)",
        "all(span.completion_cost >= 0 for span in spans)",
        "sum(span.total_cost for span in spans) > 1",
    ):
        SessionFilter(condition)
