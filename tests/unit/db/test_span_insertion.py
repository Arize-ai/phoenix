"""Tests for insert_span() covering basic insertion, concurrency, and session resolution."""

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
    session_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> Span:
    # Attributes must use nested dict format: get_attribute_value expects {"llm": {"token_count": {...}}}
    token_count: dict[str, int] = {}
    if prompt_tokens is not None:
        token_count["prompt"] = prompt_tokens
    if completion_tokens is not None:
        token_count["completion"] = completion_tokens
    attributes: dict[str, object] = {"llm": {"token_count": token_count}} if token_count else {}
    if session_id is not None:
        attributes["session"] = {"id": session_id}
    return Span(
        name=span_id,
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.UNKNOWN,
        parent_id=parent_id,
        start_time=start_time or _NOW,
        end_time=end_time or _NOW,
        status_code=status_code,
        status_message="",
        attributes=attributes,
        events=[],
        conversation=None,
    )


class TestInsertSpan:
    async def test_returns_span_insertion_event(self, db: DbSessionFactory) -> None:
        span = _make_span("root-1", prompt_tokens=10, completion_tokens=5)
        async with db() as session:
            async with session.begin_nested():
                result = await insert_span(session, span, "my-project")
        assert isinstance(result, SpanInsertionEvent)
        assert result.span_rowid is not None
        assert result.trace_rowid is not None
        assert result.project_rowid is not None

    async def test_own_values_stored_without_child_accumulation(self, db: DbSessionFactory) -> None:
        """Parent inserted first, then child. Parent cumulative values should NOT be
        updated by the child insertion — batch recompute handles that separately."""
        parent = _make_span("parent-A", prompt_tokens=10, completion_tokens=2)
        child = _make_span(
            "child-B",
            parent_id="parent-A",
            prompt_tokens=5,
            completion_tokens=1,
        )
        async with db() as session:
            async with session.begin_nested():
                await insert_span(session, parent, "proj")
            async with session.begin_nested():
                await insert_span(session, child, "proj")
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
                first = await insert_span(session, span, "proj")
            async with session.begin_nested():
                second = await insert_span(session, span, "proj")

        assert first is not None
        assert second is None

    async def test_trace_rowid_in_event_matches_db(self, db: DbSessionFactory) -> None:
        span = _make_span("span-trace-check")
        async with db() as session:
            async with session.begin_nested():
                event = await insert_span(session, span, "proj")
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
                    return await insert_span(session, _span_early(), "proj")

        async def insert_late() -> Optional[SpanInsertionEvent]:
            async with db() as session:
                async with session.begin_nested():
                    return await insert_span(session, _span_late(), "proj")

        # Run both insertions — on SQLite, run sequentially to avoid savepoint
        # conflicts (aiosqlite serializes to a single thread); on PostgreSQL,
        # run concurrently to exercise true concurrent INSERT ON CONFLICT.
        if db.dialect.value == "sqlite":
            results = (await insert_early(), await insert_late())
        else:
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


class TestCumulativeValuesBatchRecompute:
    """Verify that insert_span stores own-values only, and that batch recompute
    produces correct cumulative values regardless of span arrival order.

    Tree structure: Root -> {A, B}, A -> C
    Spans arrive child-first: C, A, B, Root.

    Expected correct cumulative values (errors, prompt_tokens, completion_tokens):
      C:    (1, 8, 3)   — leaf, own ERROR
      B:    (0, 2, 2)   — leaf
      A:    (1, 12, 4)  — own(0,4,1) + C(1,8,3)
      Root: (1, 15, 7)  — own(0,1,1) + A(1,12,4) + B(0,2,2)
    """

    # A branching tree: Root -> {A, B}, A -> C
    # Spans arrive in an order that exercises ancestor propagation (child before parent).
    _SPAN_DEFS = [
        # (logical_id, logical_parent_id, prompt_tokens, completion_tokens, status_code)
        ("C", "A", 8, 3, SpanStatusCode.ERROR),
        ("A", "Root", 4, 1, SpanStatusCode.OK),
        ("B", "Root", 2, 2, SpanStatusCode.OK),
        ("Root", None, 1, 1, SpanStatusCode.OK),
    ]

    # Expected correct values: (cumulative_error_count, prompt_tokens, completion_tokens)
    _EXPECTED = {
        "C": (1, 8, 3),
        "B": (0, 2, 2),
        "A": (1, 12, 4),
        "Root": (1, 15, 7),
    }

    async def test_batch_recompute_produces_correct_cumulative_values(
        self, db: DbSessionFactory
    ) -> None:
        """insert_span stores own-values only; recompute_trace_cumulative_values
        produces correct cumulative values regardless of span arrival order."""
        from phoenix.db.insertion.cumulative import recompute_trace_cumulative_values

        values: dict[str, tuple[int, int, int]] = {}
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
                    event = await insert_span(session, span, "proj-new")
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
                values[logical] = (
                    s.cumulative_error_count,
                    s.cumulative_llm_token_count_prompt,
                    s.cumulative_llm_token_count_completion,
                )

        assert values == self._EXPECTED, (
            f"Batch recompute cumulative values are wrong:\ngot={values}\nexpected={self._EXPECTED}"
        )


class TestSessionUpsertPaths:
    """Tests for the three session resolution paths in insert_span:
    1. Cache-miss: session_id present but not in session_cache → _upsert_session fires
    2. Cache-hit: session_id present and in session_cache → UPDATE times + set trace FK
    3. Trace FK: session already linked via trace's project_session_rowid → UPDATE times
    All paths must expand time ranges correctly via LEAST/GREATEST (PG) or MIN/MAX (SQLite).
    """

    async def test_cache_miss_creates_session_and_links_trace(self, db: DbSessionFactory) -> None:
        """When session_id is not in session_cache, _upsert_session creates the
        ProjectSession and links the trace to it."""
        t0 = _NOW
        t1 = _NOW + timedelta(hours=1)
        span = _make_span(
            "sess-miss-span",
            trace_id="sess-miss-trace",
            session_id="session-alpha",
            start_time=t0,
            end_time=t1,
        )
        session_cache: dict[str, int] = {}

        async with db() as session:
            async with session.begin_nested():
                event = await insert_span(
                    session,
                    span,
                    "proj-sess",
                    session_cache=session_cache,
                )
            assert event is not None
            await session.flush()

            # Verify ProjectSession was created
            ps = await session.scalar(
                select(models.ProjectSession).where(
                    models.ProjectSession.session_id == "session-alpha"
                )
            )
            assert ps is not None
            assert ps.start_time == t0
            assert ps.end_time == t1

            # Verify trace is linked to the session
            trace = await session.scalar(
                select(models.Trace).where(models.Trace.id == event.trace_rowid)
            )
            assert trace is not None
            assert trace.project_session_rowid == ps.id

    async def test_cache_hit_updates_times_and_links_trace(self, db: DbSessionFactory) -> None:
        """When session_id is in session_cache, insert_span uses the cached rowid
        to UPDATE times and set the trace FK — no _upsert_session call needed."""
        t0 = _NOW
        t1 = _NOW + timedelta(hours=1)
        t2 = _NOW + timedelta(hours=2)

        # First span: creates the session via cache-miss path
        span1 = _make_span(
            "sess-hit-span1",
            trace_id="sess-hit-trace1",
            session_id="session-beta",
            start_time=t0,
            end_time=t1,
        )
        session_cache: dict[str, int] = {}

        async with db() as session:
            async with session.begin_nested():
                await insert_span(
                    session,
                    span1,
                    "proj-sess",
                    session_cache=session_cache,
                )
            await session.flush()

            # Get the session rowid and populate the cache
            ps = await session.scalar(
                select(models.ProjectSession).where(
                    models.ProjectSession.session_id == "session-beta"
                )
            )
            assert ps is not None
            session_cache["session-beta"] = ps.id

            # Second span on a different trace but same session_id — cache hit
            span2 = _make_span(
                "sess-hit-span2",
                trace_id="sess-hit-trace2",
                session_id="session-beta",
                start_time=t1,
                end_time=t2,
            )
            async with session.begin_nested():
                event2 = await insert_span(
                    session,
                    span2,
                    "proj-sess",
                    session_cache=session_cache,
                )
            assert event2 is not None
            await session.flush()

            # Verify session time range was expanded
            await session.refresh(ps)
            assert ps.start_time == t0  # LEAST(t0, t1) = t0
            assert ps.end_time == t2  # GREATEST(t1, t2) = t2

            # Verify second trace is linked to the same session
            trace2 = await session.scalar(
                select(models.Trace).where(models.Trace.id == event2.trace_rowid)
            )
            assert trace2 is not None
            assert trace2.project_session_rowid == ps.id

    async def test_trace_fk_path_expands_session_times(self, db: DbSessionFactory) -> None:
        """When a trace already has a project_session_rowid (from a prior span),
        subsequent spans on the same trace use the trace FK path to update
        session times without consulting session_cache."""
        t0 = _NOW
        t1 = _NOW + timedelta(hours=1)
        t2 = _NOW - timedelta(hours=1)  # Earlier than t0 — should become new start_time
        t3 = _NOW + timedelta(hours=3)  # Later than t1 — should become new end_time

        # First span creates the session
        span1 = _make_span(
            "fk-span1",
            trace_id="fk-trace",
            session_id="session-gamma",
            start_time=t0,
            end_time=t1,
        )

        async with db() as session:
            async with session.begin_nested():
                event1 = await insert_span(
                    session,
                    span1,
                    "proj-sess",
                )
            assert event1 is not None
            await session.flush()

            # Get the session rowid for verification
            ps = await session.scalar(
                select(models.ProjectSession).where(
                    models.ProjectSession.session_id == "session-gamma"
                )
            )
            assert ps is not None

            # Second span on the SAME trace (different span_id) — triggers trace FK path
            # because the trace already has project_session_rowid set.
            # No session_id needed in this span; the FK comes from the trace.
            span2 = _make_span(
                "fk-span2",
                trace_id="fk-trace",
                parent_id="fk-span1",
                start_time=t2,
                end_time=t3,
            )
            async with session.begin_nested():
                event2 = await insert_span(
                    session,
                    span2,
                    "proj-sess",
                )
            assert event2 is not None
            await session.flush()

            # Verify session time range was expanded via the trace FK path
            await session.refresh(ps)
            assert ps.start_time == t2  # LEAST(t0, t2) = t2
            assert ps.end_time == t3  # GREATEST(t1, t3) = t3
