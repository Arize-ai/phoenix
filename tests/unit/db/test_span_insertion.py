"""Tests for insert_span() focusing on the propagate_ancestors parameter and concurrency."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.span import SpanInsertionEvent, insert_span
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode

_NOW = datetime(2024, 1, 1, tzinfo=timezone.utc)


def _make_span(
    span_id: str,
    *,
    trace_id: str = "trace-001",
    parent_id: Optional[str] = None,
    status_code: SpanStatusCode = SpanStatusCode.OK,
    prompt_tokens: Optional[int] = None,
    completion_tokens: Optional[int] = None,
) -> Span:
    # Attributes must use nested dict format: get_attribute_value expects {"llm": {"token_count": {...}}}
    token_count: dict[str, int] = {}
    if prompt_tokens is not None:
        token_count["prompt"] = prompt_tokens
    if completion_tokens is not None:
        token_count["completion"] = completion_tokens
    attributes: dict[str, object] = {"llm": {"token_count": token_count}} if token_count else {}
    return Span(
        name=span_id,
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.UNKNOWN,
        parent_id=parent_id,
        start_time=_NOW,
        end_time=_NOW,
        status_code=status_code,
        status_message="",
        attributes=attributes,
        events=[],
        conversation=None,
    )


class TestInsertSpanPropagateAncestors:
    async def test_returns_span_insertion_event(self, db: DbSessionFactory) -> None:
        span = _make_span("root-1", prompt_tokens=10, completion_tokens=5)
        async with db() as session:
            async with session.begin_nested():
                result = await insert_span(session, span, "my-project", propagate_ancestors=False)
        assert isinstance(result, SpanInsertionEvent)
        assert result.span_rowid is not None
        assert result.trace_rowid is not None
        assert result.project_rowid is not None

    async def test_own_values_stored_without_child_accumulation(self, db: DbSessionFactory) -> None:
        """Parent inserted first, then child with propagate_ancestors=False.
        Parent cumulative values should NOT be updated by the child insertion."""
        parent = _make_span("parent-A", prompt_tokens=10, completion_tokens=2)
        child = _make_span(
            "child-B",
            parent_id="parent-A",
            prompt_tokens=5,
            completion_tokens=1,
        )
        async with db() as session:
            async with session.begin_nested():
                await insert_span(session, parent, "proj", propagate_ancestors=False)
            async with session.begin_nested():
                await insert_span(session, child, "proj", propagate_ancestors=False)
            await session.flush()

            db_spans = {s.span_id: s for s in (await session.scalars(select(models.Span))).all()}

        # Child has its own values only
        assert db_spans["child-B"].cumulative_llm_token_count_prompt == 5
        assert db_spans["child-B"].cumulative_llm_token_count_completion == 1

        # Parent was NOT updated — still has its own values from insertion
        assert db_spans["parent-A"].cumulative_llm_token_count_prompt == 10
        assert db_spans["parent-A"].cumulative_llm_token_count_completion == 2

    async def test_duplicate_span_id_returns_none(self, db: DbSessionFactory) -> None:
        """insert_span returns None if the span_id already exists (ON CONFLICT DO NOTHING)."""
        span = _make_span("dup-span-1")
        async with db() as session:
            async with session.begin_nested():
                first = await insert_span(session, span, "proj", propagate_ancestors=False)
            async with session.begin_nested():
                second = await insert_span(session, span, "proj", propagate_ancestors=False)

        assert first is not None
        assert second is None

    async def test_trace_rowid_in_event_matches_db(self, db: DbSessionFactory) -> None:
        span = _make_span("span-trace-check")
        async with db() as session:
            async with session.begin_nested():
                event = await insert_span(session, span, "proj", propagate_ancestors=False)
            assert event is not None
            db_trace = await session.scalar(
                select(models.Trace).where(models.Trace.id == event.trace_rowid)
            )
        assert db_trace is not None
        assert db_trace.trace_id == "trace-001"


class TestConcurrentSameTraceIdInsertion:
    """Two concurrent span insertions for the same trace_id must both succeed
    and leave the trace with the correct (earliest start, latest end) time range."""

    async def test_concurrent_inserts_no_integrity_error(self, db: DbSessionFactory) -> None:
        early = _NOW
        late = _NOW + timedelta(seconds=5)

        def _span_early() -> Span:
            return Span(
                name="span-early",
                context=SpanContext(trace_id="shared-trace", span_id="span-early"),
                span_kind=SpanKind.UNKNOWN,
                parent_id=None,
                start_time=early,
                end_time=early + timedelta(seconds=1),
                status_code=SpanStatusCode.OK,
                status_message="",
                attributes={},
                events=[],
                conversation=None,
            )

        def _span_late() -> Span:
            return Span(
                name="span-late",
                context=SpanContext(trace_id="shared-trace", span_id="span-late"),
                span_kind=SpanKind.UNKNOWN,
                parent_id=None,
                start_time=late,
                end_time=late + timedelta(seconds=1),
                status_code=SpanStatusCode.OK,
                status_message="",
                attributes={},
                events=[],
                conversation=None,
            )

        async def insert_early() -> Optional[SpanInsertionEvent]:
            async with db() as session:
                async with session.begin_nested():
                    return await insert_span(
                        session, _span_early(), "proj", propagate_ancestors=False
                    )

        async def insert_late() -> Optional[SpanInsertionEvent]:
            async with db() as session:
                async with session.begin_nested():
                    return await insert_span(
                        session, _span_late(), "proj", propagate_ancestors=False
                    )

        # Run both insertions concurrently — neither should raise IntegrityError
        results = await asyncio.gather(insert_early(), insert_late())
        assert all(r is not None for r in results), "Both span insertions must succeed"

        # Verify trace has the correct time range: earliest start, latest end
        async with db() as session:
            trace = await session.scalar(
                select(models.Trace).where(models.Trace.trace_id == "shared-trace")
            )
        assert trace is not None
        assert trace.start_time == early, f"Expected start={early}, got {trace.start_time}"
        assert trace.end_time == late + timedelta(seconds=1), (
            f"Expected end={late + timedelta(seconds=1)}, got {trace.end_time}"
        )


class TestCumulativeValuesParity:
    """Regression: old path (propagate_ancestors=True) and new path
    (propagate_ancestors=False + recompute) must produce identical cumulative
    column values for every span in the trace."""

    # A branching tree: Root -> {A, B}, A -> C
    # Spans arrive in an order that exercises ancestor propagation (child before parent).
    # Logical IDs only — actual span_ids are prefixed per-path to avoid unique-constraint collisions.
    _SPAN_DEFS = [
        # (logical_id, logical_parent_id, prompt_tokens, completion_tokens, status_code)
        ("C", "A", 8, 3, SpanStatusCode.ERROR),
        ("A", "Root", 4, 1, SpanStatusCode.OK),
        ("B", "Root", 2, 2, SpanStatusCode.OK),
        ("Root", None, 1, 1, SpanStatusCode.OK),
    ]

    async def test_old_and_new_path_produce_same_cumulative_values(
        self, db: DbSessionFactory
    ) -> None:
        from phoenix.db.insertion.cumulative import recompute_trace_cumulative_values

        # --- Old path: propagate_ancestors=True (one-at-a-time CTE propagation) ---
        # Span IDs are prefixed with "old-" to avoid uniqueness collisions with the new path.
        old_values: dict[str, tuple[int, int, int]] = {}
        async with db() as session:
            for logical_id, logical_parent, prompt, completion, status in self._SPAN_DEFS:
                span = _make_span(
                    f"old-{logical_id}",
                    trace_id="parity-old",
                    parent_id=f"old-{logical_parent}" if logical_parent is not None else None,
                    status_code=status,
                    prompt_tokens=prompt,
                    completion_tokens=completion,
                )
                async with session.begin_nested():
                    await insert_span(session, span, "proj-old", propagate_ancestors=True)
            await session.flush()
            db_spans = (
                await session.scalars(
                    select(models.Span).where(
                        models.Span.span_id.like("old-%"),
                    )
                )
            ).all()
            for s in db_spans:
                logical = s.span_id[len("old-") :]
                old_values[logical] = (
                    s.cumulative_error_count,
                    s.cumulative_llm_token_count_prompt,
                    s.cumulative_llm_token_count_completion,
                )

        # --- New path: propagate_ancestors=False + batch recompute ---
        # Span IDs are prefixed with "new-" to avoid uniqueness collisions with the old path.
        new_values: dict[str, tuple[int, int, int]] = {}
        async with db() as session:
            trace_rowid: Optional[int] = None
            for logical_id, logical_parent, prompt, completion, status in self._SPAN_DEFS:
                span = _make_span(
                    f"new-{logical_id}",
                    trace_id="parity-new",
                    parent_id=f"new-{logical_parent}" if logical_parent is not None else None,
                    status_code=status,
                    prompt_tokens=prompt,
                    completion_tokens=completion,
                )
                async with session.begin_nested():
                    event = await insert_span(session, span, "proj-new", propagate_ancestors=False)
                    if event is not None:
                        trace_rowid = event.trace_rowid
            assert trace_rowid is not None
            await recompute_trace_cumulative_values(session, {trace_rowid})
            await session.flush()
            db_spans = (
                await session.scalars(
                    select(models.Span).where(models.Span.trace_rowid == trace_rowid)
                )
            ).all()
            for s in db_spans:
                logical = s.span_id[len("new-") :]
                new_values[logical] = (
                    s.cumulative_error_count,
                    s.cumulative_llm_token_count_prompt,
                    s.cumulative_llm_token_count_completion,
                )

        assert old_values == new_values, (
            f"Cumulative values differ between old and new path:\n"
            f"old={old_values}\nnew={new_values}"
        )
