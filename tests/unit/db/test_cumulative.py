"""Unit tests for _get_cumulative_counts() and recompute_trace_cumulative_values()."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.insertion.cumulative import (
    CumulativeCount,
    _get_cumulative_counts,
    recompute_trace_cumulative_values,
)
from phoenix.server.types import DbSessionFactory

# ---------------------------------------------------------------------------
# Helpers for DB-backed tests
# ---------------------------------------------------------------------------

_NOW = datetime(2024, 1, 1, tzinfo=timezone.utc)


async def _insert_project(session: Any, name: str) -> int:
    rowid = await session.scalar(
        insert(models.Project).values(name=name).returning(models.Project.id)
    )
    assert rowid is not None
    return int(rowid)


async def _insert_trace(session: Any, project_rowid: int, trace_id: str) -> int:
    rowid = await session.scalar(
        insert(models.Trace)
        .values(
            project_rowid=project_rowid,
            trace_id=trace_id,
            start_time=_NOW,
            end_time=_NOW,
        )
        .returning(models.Trace.id)
    )
    assert rowid is not None
    return int(rowid)


async def _insert_span(
    session: Any,
    trace_rowid: int,
    span_id: str,
    *,
    parent_id: Optional[str] = None,
    status_code: str = "OK",
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
) -> int:
    rowid = await session.scalar(
        insert(models.Span)
        .values(
            trace_rowid=trace_rowid,
            span_id=span_id,
            parent_id=parent_id,
            name=span_id,
            span_kind="INTERNAL",
            start_time=_NOW,
            end_time=_NOW,
            attributes={},
            events=[],
            status_code=status_code,
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
            llm_token_count_prompt=prompt_tokens,
            llm_token_count_completion=completion_tokens,
        )
        .returning(models.Span.id)
    )
    assert rowid is not None
    return int(rowid)


# ---------------------------------------------------------------------------
# DB-backed tests for recompute_trace_cumulative_values
# ---------------------------------------------------------------------------


class TestRecomputeTraceCumulativeValues:
    async def test_empty_trace_rowids_is_noop(self, db: DbSessionFactory) -> None:
        async with db() as session:
            # Should not raise
            await recompute_trace_cumulative_values(session, set())

    async def test_single_trace_linear_chain(self, db: DbSessionFactory) -> None:
        async with db() as session:
            proj = await _insert_project(session, "p1")
            tr = await _insert_trace(session, proj, "t1")
            await _insert_span(session, tr, "A", prompt_tokens=1, completion_tokens=1)
            await _insert_span(
                session, tr, "B", parent_id="A", prompt_tokens=2, completion_tokens=2
            )
            await _insert_span(
                session, tr, "C", parent_id="B", prompt_tokens=4, completion_tokens=4
            )
            await session.flush()

            await recompute_trace_cumulative_values(session, {tr})

            spans = {s.span_id: s for s in (await session.scalars(select(models.Span))).all()}
        # C is a leaf
        assert spans["C"].cumulative_llm_token_count_prompt == 4
        assert spans["C"].cumulative_llm_token_count_completion == 4
        # B = own(2) + C(4)
        assert spans["B"].cumulative_llm_token_count_prompt == 6
        assert spans["B"].cumulative_llm_token_count_completion == 6
        # A = own(1) + B(6)
        assert spans["A"].cumulative_llm_token_count_prompt == 7
        assert spans["A"].cumulative_llm_token_count_completion == 7

    async def test_multiple_traces_in_one_call(self, db: DbSessionFactory) -> None:
        async with db() as session:
            proj = await _insert_project(session, "p2")
            tr1 = await _insert_trace(session, proj, "trace1")
            await _insert_span(session, tr1, "X", prompt_tokens=10, completion_tokens=0)
            await _insert_span(
                session, tr1, "Y", parent_id="X", prompt_tokens=5, completion_tokens=0
            )

            tr2 = await _insert_trace(session, proj, "trace2")
            await _insert_span(session, tr2, "P", prompt_tokens=3, completion_tokens=1)
            await _insert_span(session, tr2, "Q", parent_id="P", status_code="ERROR")
            await session.flush()

            await recompute_trace_cumulative_values(session, {tr1, tr2})

            spans = {s.span_id: s for s in (await session.scalars(select(models.Span))).all()}

        # Trace 1
        assert spans["Y"].cumulative_llm_token_count_prompt == 5
        assert spans["X"].cumulative_llm_token_count_prompt == 15

        # Trace 2 — error propagates
        assert spans["Q"].cumulative_error_count == 1
        assert spans["P"].cumulative_error_count == 1

    async def test_existing_stale_values_are_overwritten(self, db: DbSessionFactory) -> None:
        """Spans inserted with wrong cumulative values are corrected by recompute."""
        async with db() as session:
            proj = await _insert_project(session, "p3")
            tr = await _insert_trace(session, proj, "t3")
            # Insert spans with deliberately wrong cumulative values (0)
            await _insert_span(session, tr, "Root", prompt_tokens=5, completion_tokens=0)
            await _insert_span(
                session, tr, "Child", parent_id="Root", prompt_tokens=3, completion_tokens=0
            )
            await session.flush()

            await recompute_trace_cumulative_values(session, {tr})

            spans = {s.span_id: s for s in (await session.scalars(select(models.Span))).all()}

        assert spans["Child"].cumulative_llm_token_count_prompt == 3
        assert spans["Root"].cumulative_llm_token_count_prompt == 8  # own(5) + child(3)


@dataclass
class _SpanStub:
    """Minimal stub matching the fields accessed by _get_cumulative_counts."""

    span_id: str
    parent_id: Optional[str] = None
    status_code: str = "OK"
    llm_token_count_prompt: Optional[int] = None
    llm_token_count_completion: Optional[int] = None
    # Fields required by models.Span but unused by _get_cumulative_counts
    trace_rowid: int = 0
    name: str = ""
    span_kind: str = "UNKNOWN"
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: datetime = field(default_factory=datetime.utcnow)
    attributes: dict[str, Any] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    status_message: str = ""
    cumulative_error_count: int = 0
    cumulative_llm_token_count_prompt: int = 0
    cumulative_llm_token_count_completion: int = 0


def _span(
    span_id: str,
    *,
    parent_id: Optional[str] = None,
    status_code: str = "OK",
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
) -> _SpanStub:
    return _SpanStub(
        span_id=span_id,
        parent_id=parent_id,
        status_code=status_code,
        llm_token_count_prompt=prompt_tokens,
        llm_token_count_completion=completion_tokens,
    )


class TestGetCumulativeCounts:
    def test_empty_input(self) -> None:
        result = _get_cumulative_counts([])
        assert result == []

    def test_single_node_no_tokens_no_error(self) -> None:
        spans = [_span("A")]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        assert result == [CumulativeCount(errors=0, prompt_tokens=0, completion_tokens=0)]

    def test_single_node_with_tokens(self) -> None:
        spans = [_span("A", prompt_tokens=10, completion_tokens=5)]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        assert result == [CumulativeCount(errors=0, prompt_tokens=10, completion_tokens=5)]

    def test_single_node_error(self) -> None:
        spans = [_span("A", status_code="ERROR")]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        assert result == [CumulativeCount(errors=1, prompt_tokens=0, completion_tokens=0)]

    def test_linear_chain(self) -> None:
        # A -> B -> C  (A is root, B is child of A, C is child of B)
        spans = [
            _span("A", prompt_tokens=1, completion_tokens=1),
            _span("B", parent_id="A", prompt_tokens=2, completion_tokens=2),
            _span("C", parent_id="B", prompt_tokens=4, completion_tokens=4),
        ]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        by_id = {s.span_id: c for s, c in zip(spans, result)}

        # C is a leaf: own values only
        assert by_id["C"] == CumulativeCount(errors=0, prompt_tokens=4, completion_tokens=4)
        # B accumulates C + own
        assert by_id["B"] == CumulativeCount(errors=0, prompt_tokens=6, completion_tokens=6)
        # A accumulates B (which already includes C) + own
        assert by_id["A"] == CumulativeCount(errors=0, prompt_tokens=7, completion_tokens=7)

    def test_branching_tree(self) -> None:
        # A is root; B and C are children of A; D is child of B
        spans = [
            _span("A", prompt_tokens=1, completion_tokens=1),
            _span("B", parent_id="A", prompt_tokens=2, completion_tokens=2),
            _span("C", parent_id="A", prompt_tokens=4, completion_tokens=4),
            _span("D", parent_id="B", prompt_tokens=8, completion_tokens=8),
        ]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        by_id = {s.span_id: c for s, c in zip(spans, result)}

        assert by_id["D"] == CumulativeCount(errors=0, prompt_tokens=8, completion_tokens=8)
        assert by_id["C"] == CumulativeCount(errors=0, prompt_tokens=4, completion_tokens=4)
        # B = own(2) + D(8) = 10
        assert by_id["B"] == CumulativeCount(errors=0, prompt_tokens=10, completion_tokens=10)
        # A = own(1) + B(10) + C(4) = 15
        assert by_id["A"] == CumulativeCount(errors=0, prompt_tokens=15, completion_tokens=15)

    def test_error_propagation_linear(self) -> None:
        spans = [
            _span("A"),
            _span("B", parent_id="A", status_code="ERROR"),
            _span("C", parent_id="B", status_code="ERROR"),
        ]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        by_id = {s.span_id: c for s, c in zip(spans, result)}

        assert by_id["C"].errors == 1
        assert by_id["B"].errors == 2  # own + C
        assert by_id["A"].errors == 2  # B already includes C

    def test_null_tokens_treated_as_zero(self) -> None:
        spans = [
            _span("A"),  # prompt_tokens=None, completion_tokens=None
            _span("B", parent_id="A", prompt_tokens=5),
        ]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        by_id = {s.span_id: c for s, c in zip(spans, result)}

        assert by_id["B"] == CumulativeCount(errors=0, prompt_tokens=5, completion_tokens=0)
        assert by_id["A"] == CumulativeCount(errors=0, prompt_tokens=5, completion_tokens=0)

    def test_output_order_matches_input_order(self) -> None:
        # Input order: C, B, A  (root last)
        spans = [
            _span("C", parent_id="B", prompt_tokens=10, completion_tokens=0),
            _span("B", parent_id="A", prompt_tokens=5, completion_tokens=0),
            _span("A", prompt_tokens=1, completion_tokens=0),
        ]
        result = _get_cumulative_counts(spans)  # type: ignore[arg-type]
        assert len(result) == 3
        # First result is for C (leaf), second for B, third for A
        assert result[0] == CumulativeCount(errors=0, prompt_tokens=10, completion_tokens=0)
        assert result[1] == CumulativeCount(errors=0, prompt_tokens=15, completion_tokens=0)
        assert result[2] == CumulativeCount(errors=0, prompt_tokens=16, completion_tokens=0)
