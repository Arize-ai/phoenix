from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.span import insert_span
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import (
    Span,
    SpanContext,
    SpanKind,
    SpanStatusCode,
)


def _make_span(
    *,
    trace_id: str,
    span_id: str,
    name: str = "span-name",
    parent_id: str | None = None,
    end_offset_seconds: float = 1.0,
    status_code: SpanStatusCode = SpanStatusCode.OK,
    attributes: dict | None = None,
) -> Span:
    start_time = datetime.now(timezone.utc)
    return Span(
        name=name,
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.CHAIN,
        parent_id=parent_id,
        start_time=start_time,
        end_time=start_time + timedelta(seconds=end_offset_seconds),
        status_code=status_code,
        status_message="",
        attributes=attributes if attributes is not None else {},
        events=[],
        conversation=None,
    )


class TestInsertSpanOnConflict:
    async def test_first_insert_succeeds_under_do_nothing(
        self,
        monkeypatch: pytest.MonkeyPatch,
        db: DbSessionFactory,
    ) -> None:
        monkeypatch.setenv("PHOENIX_SPAN_ON_CONFLICT", "do_nothing")
        span_a = _make_span(trace_id="trace-a", span_id="span-a", name="first")
        span_b = _make_span(trace_id="trace-a", span_id="span-b", name="second")
        async with db() as session:
            event_a = await insert_span(session, span_a, project_name="default")
            event_b = await insert_span(session, span_b, project_name="default")
        assert event_a is not None
        assert event_b is not None
        async with db() as session:
            rows = (
                await session.scalars(
                    select(models.Span).order_by(models.Span.span_id)
                )
            ).all()
        assert [row.span_id for row in rows] == ["span-a", "span-b"]
        assert [row.name for row in rows] == ["first", "second"]

    async def test_duplicate_dropped_under_do_nothing(
        self,
        monkeypatch: pytest.MonkeyPatch,
        db: DbSessionFactory,
    ) -> None:
        monkeypatch.setenv("PHOENIX_SPAN_ON_CONFLICT", "do_nothing")
        original = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="original",
            attributes={"k": "original"},
        )
        async with db() as session:
            first_event = await insert_span(session, original, project_name="default")
        assert first_event is not None

        duplicate = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="updated",
            end_offset_seconds=5.0,
            attributes={"k": "updated"},
        )
        async with db() as session:
            second_event = await insert_span(session, duplicate, project_name="default")
        # Under DO_NOTHING the duplicate insert is silently ignored; insert_span returns None.
        assert second_event is None

        async with db() as session:
            row = (
                await session.scalars(
                    select(models.Span).where(models.Span.span_id == "span-x")
                )
            ).one()
        assert row.name == "original"
        assert row.attributes == {"k": "original"}
        assert row.end_time == original.end_time

    async def test_duplicate_overwrites_under_do_update(
        self,
        monkeypatch: pytest.MonkeyPatch,
        db: DbSessionFactory,
    ) -> None:
        monkeypatch.setenv("PHOENIX_SPAN_ON_CONFLICT", "do_update")
        original = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="original",
            attributes={"k": "original"},
        )
        async with db() as session:
            first_event = await insert_span(session, original, project_name="default")
        assert first_event is not None

        duplicate = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="updated",
            end_offset_seconds=5.0,
            attributes={"k": "updated"},
        )
        async with db() as session:
            second_event = await insert_span(session, duplicate, project_name="default")
        # Under DO_UPDATE the existing row's id is returned, so the event is non-None.
        assert second_event is not None
        assert second_event.span_rowid == first_event.span_rowid

        async with db() as session:
            row = (
                await session.scalars(
                    select(models.Span).where(models.Span.span_id == "span-x")
                )
            ).one()
        assert row.name == "updated"
        assert row.attributes == {"k": "updated"}
        assert row.end_time == duplicate.end_time

    async def test_cumulative_fields_preserved_under_do_update(
        self,
        monkeypatch: pytest.MonkeyPatch,
        db: DbSessionFactory,
    ) -> None:
        monkeypatch.setenv("PHOENIX_SPAN_ON_CONFLICT", "do_update")
        # Original span is in ERROR status so cumulative_error_count is seeded to 1.
        original = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="original",
            status_code=SpanStatusCode.ERROR,
        )
        async with db() as session:
            assert await insert_span(session, original, project_name="default") is not None

        async with db() as session:
            row = (
                await session.scalars(
                    select(models.Span).where(models.Span.span_id == "span-x")
                )
            ).one()
        original_cumulative_error_count = row.cumulative_error_count
        assert original_cumulative_error_count == 1

        # Re-emit with status_code=OK. The mutable status_code column must be overwritten, but
        # cumulative_error_count must remain preserved at its earlier value.
        updated = _make_span(
            trace_id="trace-a",
            span_id="span-x",
            name="updated",
            status_code=SpanStatusCode.OK,
        )
        async with db() as session:
            assert await insert_span(session, updated, project_name="default") is not None

        async with db() as session:
            row = (
                await session.scalars(
                    select(models.Span).where(models.Span.span_id == "span-x")
                )
            ).one()
        assert row.status_code == SpanStatusCode.OK.value
        assert row.name == "updated"
        assert row.cumulative_error_count == original_cumulative_error_count
