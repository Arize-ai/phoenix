import asyncio
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import Select, event, select
from sqlalchemy.engine import Connection, ExecutionContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.dml import Update

from phoenix.db import models
from phoenix.db.helpers import PROJECT_GRADIENTS
from phoenix.db.insertion.span import insert_span
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode

_START_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _span(
    name: str,
    trace_id: str,
    span_id: str,
    *,
    parent_id: str | None = None,
    status_code: SpanStatusCode = SpanStatusCode.OK,
) -> Span:
    return Span(
        name=name,
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.CHAIN,
        parent_id=parent_id,
        start_time=_START_TIME,
        end_time=_START_TIME + timedelta(seconds=1),
        status_code=status_code,
        status_message="",
        attributes={},
        events=[],
        conversation=None,
    )


async def test_cumulative_rollups_only_follow_edges_within_the_trace(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        await insert_span(
            session,
            _span(
                "foreign-child",
                "foreign-child-trace",
                "foreign-child",
                parent_id="target-parent",
                status_code=SpanStatusCode.ERROR,
            ),
            "project",
        )
        await insert_span(
            session,
            _span("target-parent", "target-trace", "target-parent"),
            "project",
        )
        await insert_span(
            session,
            _span("foreign-parent", "foreign-parent-trace", "foreign-parent"),
            "project",
        )
        await insert_span(
            session,
            _span(
                "target-orphan",
                "target-orphan-trace",
                "target-orphan",
                parent_id="foreign-parent",
                status_code=SpanStatusCode.ERROR,
            ),
            "project",
        )

        spans = {
            span.name: span
            for span in await session.scalars(
                select(models.Span).where(models.Span.name.in_(("target-parent", "foreign-parent")))
            )
        }

        assert spans["target-parent"].cumulative_error_count == 0
        assert spans["foreign-parent"].cumulative_error_count == 0


async def test_new_project_from_ingestion_gets_a_preset_gradient(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        await insert_span(session, _span("span", "trace", "span"), "new-project")
        project = await session.scalar(select(models.Project).filter_by(name="new-project"))
    assert project is not None
    assert (project.gradient_start_color, project.gradient_end_color) in PROJECT_GRADIENTS


@pytest.mark.parametrize("arrival_order", ["root-only", "root-first", "root-last"])
async def test_root_skips_ancestor_update_and_preserves_cumulative_counts(
    db: DbSessionFactory,
    arrival_order: str,
) -> None:
    root = replace(
        _span("root", "trace", "root", status_code=SpanStatusCode.ERROR),
        span_kind=SpanKind.LLM,
        attributes={"llm": {"token_count": {"prompt": 5, "completion": 2}}},
    )
    children = [
        replace(
            _span(
                "child-1", "trace", "child-1", parent_id="root", status_code=SpanStatusCode.ERROR
            ),
            span_kind=SpanKind.LLM,
            attributes={"llm": {"token_count": {"prompt": 7, "completion": 3}}},
        ),
        replace(
            _span("child-2", "trace", "child-2", parent_id="root"),
            span_kind=SpanKind.LLM,
            attributes={"llm": {"token_count": {"prompt": 11, "completion": 4}}},
        ),
    ]
    ordered_spans = {
        "root-only": [root],
        "root-first": [root, *children],
        "root-last": [*children, root],
    }[arrival_order]
    span_updates = 0

    def record_span_update(
        _connection: Connection,
        _cursor: Any,
        _statement: str,
        _parameters: Any,
        context: ExecutionContext,
        _executemany: bool,
    ) -> None:
        nonlocal span_updates
        if (
            context.compiled is not None
            and isinstance(statement := context.compiled.statement, Update)
            and getattr(statement.table, "name", None) == models.Span.__tablename__
        ):
            span_updates += 1

    async with db() as session:
        bind = session.get_bind()
        event.listen(bind, "before_cursor_execute", record_span_update)
        try:
            for span in ordered_spans:
                before = span_updates
                result = await insert_span(session, span, "project")
                assert result is not None
                if span.parent_id is None:
                    assert span_updates == before
            if arrival_order == "root-first":
                assert span_updates > 0
            before = span_updates
            assert await insert_span(session, root, "project") is None
            assert span_updates == before
        finally:
            event.remove(bind, "before_cursor_execute", record_span_update)
    async with db() as session:
        saved = {span.span_id: span for span in await session.scalars(select(models.Span))}
        assert set(saved) == {span.context.span_id for span in ordered_spans}
        saved_root = saved["root"]
        has_children = arrival_order != "root-only"
        assert saved_root.llm_token_count_prompt == 5
        assert saved_root.llm_token_count_completion == 2
        assert saved_root.cumulative_error_count == (2 if has_children else 1)
        assert saved_root.cumulative_llm_token_count_prompt == (23 if has_children else 5)
        assert saved_root.cumulative_llm_token_count_completion == (9 if has_children else 2)


@pytest.mark.parametrize("arrival_order", ["parent-first", "child-first"])
@pytest.mark.parametrize(
    "counts",
    [(0, 0, 0), (1, 0, 0), (0, 7, 0), (0, 0, 3)],
    ids=["zero", "error", "prompt", "completion"],
)
async def test_zero_counts_skip_ancestor_updates_and_preserve_later_rollups(
    db: DbSessionFactory,
    arrival_order: str,
    counts: tuple[int, int, int],
) -> None:
    errors, prompt, completion = counts
    root = _span("root", "trace", "root")
    parent = _span("parent", "trace", "parent", parent_id="root")
    child = replace(
        _span(
            "child",
            "trace",
            "child",
            parent_id="parent",
            status_code=SpanStatusCode.ERROR if errors else SpanStatusCode.OK,
        ),
        span_kind=SpanKind.LLM,
        attributes={"llm": {"token_count": {"prompt": prompt, "completion": completion}}},
    )
    nonzero_update = int(any(counts))
    ordered_spans = {
        "parent-first": [(parent, 0), (child, nonzero_update)],
        "child-first": [(child, nonzero_update), (parent, nonzero_update)],
    }[arrival_order]
    span_updates = 0

    def record_span_update(
        _connection: Connection,
        _cursor: Any,
        _statement: str,
        _parameters: Any,
        context: ExecutionContext,
        _executemany: bool,
    ) -> None:
        nonlocal span_updates
        if (
            context.compiled is not None
            and isinstance(statement := context.compiled.statement, Update)
            and getattr(statement.table, "name", None) == models.Span.__tablename__
        ):
            span_updates += 1

    async with db() as session:
        root_result = await insert_span(session, root, "project")
        assert root_result is not None
    for span, expected_updates in ordered_spans:
        async with db() as session:
            bind = session.get_bind()
            event.listen(bind, "before_cursor_execute", record_span_update)
            try:
                before = span_updates
                result = await insert_span(session, span, "project")
                assert result is not None
                assert result.trace_rowid == root_result.trace_rowid
                assert result.project_rowid == root_result.project_rowid
                assert span_updates - before == expected_updates
            finally:
                event.remove(bind, "before_cursor_execute", record_span_update)
    async with db() as session:
        saved = {span.span_id: span for span in await session.scalars(select(models.Span))}
        assert set(saved) == {"root", "parent", "child"}
        for saved_span in saved.values():
            assert (
                saved_span.cumulative_error_count,
                saved_span.cumulative_llm_token_count_prompt,
                saved_span.cumulative_llm_token_count_completion,
            ) == counts
        assert saved["parent"].llm_token_count_prompt is None
        assert saved["parent"].llm_token_count_completion is None
        assert saved["child"].llm_token_count_prompt == prompt
        assert saved["child"].llm_token_count_completion == completion


@pytest.mark.postgres_only
@pytest.mark.parametrize("record_type", [models.Project, models.Trace, models.ProjectSession])
async def test_concurrent_creation_preserves_both_spans(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    record_type: type[models.Base],
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires independent PostgreSQL transactions")
    if record_type is not models.Project:
        async with db() as session:
            session.add(models.Project(name="project"))
            session.add(models.Project(name="other-project"))

    both_missing = asyncio.Event()
    readers: set[AsyncSession] = set()
    original_scalar = AsyncSession.scalar

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        result = await original_scalar(session, statement, *args, **kwargs)
        descriptions = getattr(statement, "column_descriptions", [])
        if (
            descriptions
            and descriptions[0].get("entity") is record_type
            and result is None
            and session not in readers
        ):
            readers.add(session)
            if len(readers) == 2:
                both_missing.set()
            await asyncio.wait_for(both_missing.wait(), timeout=10)
        return result

    monkeypatch.setattr(AsyncSession, "scalar", scalar)
    spans = [
        replace(
            _span(
                f"span-{index}",
                "trace" if record_type is models.Trace else f"trace-{index}",
                f"span-{index}",
            ),
            start_time=_START_TIME - timedelta(seconds=index),
            end_time=_START_TIME + timedelta(seconds=index + 1),
            attributes={
                "session": {"id": f"session-{index}" if record_type is models.Trace else "session"}
            },
        )
        for index in range(2)
    ]

    async def write(index: int) -> None:
        async with db() as session:
            async with session.begin_nested():
                assert (
                    await insert_span(
                        session,
                        spans[index],
                        "other-project" if record_type is models.Trace and index else "project",
                    )
                    is not None
                )

    tasks = [asyncio.create_task(write(index)) for index in range(2)]
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    assert len(readers) == 2
    async with db() as session:
        saved = list(await session.scalars(select(models.Span)))
        assert {span.span_id for span in saved} == {"span-0", "span-1"}
        traces = list(await session.scalars(select(models.Trace)))
        sessions = list(await session.scalars(select(models.ProjectSession)))
        if record_type is models.Trace:
            assert len(traces) == len(sessions) == 1
            project = await session.get(models.Project, traces[0].project_rowid)
            assert project is not None
            winner = int(project.name == "other-project")
            assert sessions[0].session_id == f"session-{winner}"
            assert sessions[0].project_id == traces[0].project_rowid
            assert {span.trace_rowid for span in saved} == {traces[0].id}
        elif record_type is models.ProjectSession:
            assert len(traces) == 2
            assert len(sessions) == 1
            assert {trace.project_session_rowid for trace in traces} == {sessions[0].id}
        else:
            assert len(list(await session.scalars(select(models.Project)))) == 1
        assert (
            min(project_session.start_time for project_session in sessions) == spans[1].start_time
        )
        assert max(project_session.end_time for project_session in sessions) == spans[1].end_time


async def test_trace_resolution_does_not_repeat_the_missing_lookup(db: DbSessionFactory) -> None:
    trace_reads = 0

    def record_trace_statement(
        _connection: Connection,
        _cursor: Any,
        _statement: str,
        _parameters: Any,
        context: ExecutionContext,
        _executemany: bool,
    ) -> None:
        nonlocal trace_reads
        if context.compiled is None:
            return
        statement = context.compiled.statement
        if isinstance(statement, Select) and any(
            getattr(table, "name", None) == models.Trace.__tablename__
            for table in statement.get_final_froms()
        ):
            trace_reads += 1

    async with db() as session:
        bind = session.get_bind()
        event.listen(bind, "before_cursor_execute", record_trace_statement)
        try:
            first = await insert_span(session, _span("first", "trace", "first"), "project")
            assert first is not None
            assert trace_reads <= 2
            trace_reads = 0
            later = await insert_span(
                session,
                _span("later", "trace", "later", parent_id="first"),
                "project",
            )
            assert later is not None and later.trace_rowid == first.trace_rowid
            assert trace_reads <= 1
        finally:
            event.remove(bind, "before_cursor_execute", record_trace_statement)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "later"}
        assert (await session.scalars(select(models.Trace))).one().id == first.trace_rowid


async def test_late_span_preserves_transferred_project_and_established_session(
    db: DbSessionFactory,
) -> None:
    first = replace(_span("first", "trace", "first"), attributes={"session": {"id": "original"}})
    async with db() as session:
        assert await insert_span(session, first, "old-project") is not None
        trace = await session.scalar(select(models.Trace).filter_by(trace_id="trace"))
        assert trace is not None
        project = models.Project(name="new-project")
        session.add(project)
        await session.flush()
        trace.project_rowid = project.id
    async with db() as session:
        old_project = await session.scalar(select(models.Project).filter_by(name="old-project"))
        assert old_project is not None
        # Move the session too, as a project transfer does.
        project_session = await session.scalar(select(models.ProjectSession))
        assert project_session is not None
        project_session.project_id = project.id
        await session.flush()
        await session.delete(old_project)
    async with db() as session:
        later = replace(_span("later", "trace", "later"), attributes={"session": {"id": "ignored"}})
        event = await insert_span(session, later, "old-project")
        assert event is not None and event.project_rowid == project.id
        assert await insert_span(session, later, "old-project") is None
    async with db() as session:
        assert await session.scalar(select(models.Project).filter_by(name="old-project")) is None
        assert (
            await session.scalar(select(models.ProjectSession).filter_by(session_id="ignored"))
            is None
        )


async def test_late_session_attachment_covers_existing_trace_range(db: DbSessionFactory) -> None:
    first = replace(_span("first", "trace", "first"), end_time=_START_TIME + timedelta(hours=1))
    later = replace(
        _span("later", "trace", "later"),
        start_time=_START_TIME + timedelta(minutes=1),
        end_time=_START_TIME + timedelta(minutes=2),
        attributes={"session": {"id": "session"}},
    )
    async with db() as session:
        await insert_span(session, first, "project")
    async with db() as session:
        await insert_span(session, later, "project")
    async with db() as session:
        project_session = await session.scalar(select(models.ProjectSession))
        assert project_session is not None
        assert (project_session.start_time, project_session.end_time) == (
            first.start_time,
            first.end_time,
        )


@pytest.mark.postgres_only
@pytest.mark.parametrize("record_type", [models.Trace, models.ProjectSession])
async def test_concurrent_range_extensions_never_shrink_existing_bounds(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    record_type: type[models.Trace] | type[models.ProjectSession],
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires independent PostgreSQL transactions")
    trace_ids = ["trace", "trace"] if record_type is models.Trace else ["trace-0", "trace-1"]
    async with db() as session:
        for index, trace_id in enumerate(set(trace_ids)):
            await insert_span(
                session,
                replace(
                    _span(f"root-{index}", trace_id, f"root-{index}"),
                    attributes={"session": {"id": "shared-session"}},
                ),
                "project",
            )
    both_read = asyncio.Event()
    larger_committed = asyncio.Event()
    writers: dict[AsyncSession, int] = {}
    readers: set[AsyncSession] = set()
    original_scalar = AsyncSession.scalar

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        result = await original_scalar(session, statement, *args, **kwargs)
        if (
            isinstance(statement, Select)
            and isinstance(result, record_type)
            and session in writers
            and session not in readers
        ):
            readers.add(session)
            if len(readers) == 2:
                both_read.set()
            await asyncio.wait_for(both_read.wait(), timeout=10)
            if writers[session] == 1:
                await asyncio.wait_for(larger_committed.wait(), timeout=10)
        return result

    monkeypatch.setattr(AsyncSession, "scalar", scalar)
    spans = [
        replace(
            _span(f"child-{index}", trace_ids[index], f"child-{index}"),
            start_time=_START_TIME - timedelta(seconds=2 - index),
            end_time=_START_TIME + timedelta(seconds=3 - index),
            attributes={"session": {"id": "shared-session"}},
        )
        for index in range(2)
    ]

    async def write(index: int) -> None:
        async with db() as session:
            writers[session] = index
            async with session.begin_nested():
                assert await insert_span(session, spans[index], "project") is not None
        if index == 0:
            larger_committed.set()

    tasks = [asyncio.create_task(write(index)) for index in range(2)]
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    assert len(readers) == 2
    async with db() as session:
        records = list(await session.scalars(select(record_type)))
        assert len(records) == 1
        record = records[0]
        assert isinstance(record, (models.Trace, models.ProjectSession))
        assert (record.start_time, record.end_time) == (spans[0].start_time, spans[0].end_time)
        assert set(await session.scalars(select(models.Span.span_id))) >= {"child-0", "child-1"}


async def test_range_extension_normalizes_non_utc_timestamps(db: DbSessionFactory) -> None:
    async with db() as session:
        await insert_span(
            session,
            replace(_span("root", "trace", "root"), attributes={"session": {"id": "session"}}),
            "project",
        )
    offset = timezone(timedelta(hours=5, minutes=30))
    earlier = (_START_TIME - timedelta(hours=1)).astimezone(offset)
    later = (_START_TIME + timedelta(hours=1)).astimezone(offset)
    async with db() as session:
        assert (
            await insert_span(
                session,
                replace(_span("later", "trace", "later"), start_time=earlier, end_time=later),
                "project",
            )
            is not None
        )
    async with db() as session:
        trace = (await session.scalars(select(models.Trace))).one()
        project_session = (await session.scalars(select(models.ProjectSession))).one()
        assert (trace.start_time, trace.end_time) == (earlier, later)
        assert (project_session.start_time, project_session.end_time) == (earlier, later)
        assert trace.start_time.tzinfo == project_session.start_time.tzinfo == timezone.utc


@pytest.mark.postgres_only
async def test_concurrent_late_session_attachment_preserves_first_winner(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires independent PostgreSQL transactions")
    async with db() as session:
        await insert_span(session, _span("root", "trace", "root"), "project")
    both_read = asyncio.Event()
    winner_committed = asyncio.Event()
    writers: dict[AsyncSession, int] = {}
    readers: set[AsyncSession] = set()
    original_scalar = AsyncSession.scalar

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        result = await original_scalar(session, statement, *args, **kwargs)
        if (
            isinstance(statement, Select)
            and isinstance(result, models.Trace)
            and session in writers
            and session not in readers
        ):
            assert result.project_session_rowid is None
            readers.add(session)
            if len(readers) == 2:
                both_read.set()
            await asyncio.wait_for(both_read.wait(), timeout=10)
            if writers[session] == 1:
                await asyncio.wait_for(winner_committed.wait(), timeout=10)
        return result

    monkeypatch.setattr(AsyncSession, "scalar", scalar)

    async def write(index: int) -> None:
        async with db() as session:
            writers[session] = index
            async with session.begin_nested():
                assert (
                    await insert_span(
                        session,
                        replace(
                            _span(f"child-{index}", "trace", f"child-{index}"),
                            attributes={"session": {"id": f"session-{index}"}},
                        ),
                        "project",
                    )
                    is not None
                )
        if index == 0:
            winner_committed.set()

    tasks = [asyncio.create_task(write(index)) for index in range(2)]
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    assert len(readers) == 2
    async with db() as session:
        trace = (await session.scalars(select(models.Trace))).one()
        attached = await session.get(models.ProjectSession, trace.project_session_rowid)
        assert attached is not None and attached.session_id == "session-0"
        assert set(await session.scalars(select(models.Span.span_id))) == {
            "root",
            "child-0",
            "child-1",
        }


@pytest.mark.parametrize("disappearances", [1, 2])
async def test_creation_retries_are_bounded_when_lookup_loses_winner(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    disappearances: int,
) -> None:
    original_scalar = AsyncSession.scalar
    deleted = 0

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        nonlocal deleted
        result = await original_scalar(session, statement, *args, **kwargs)
        if isinstance(result, models.Project) and deleted < disappearances:
            await session.delete(result)
            await session.flush()
            deleted += 1
            return None
        return result

    monkeypatch.setattr(AsyncSession, "scalar", scalar)
    if disappearances == 1:
        async with db() as session:
            assert (
                await insert_span(session, _span("span", "trace", "span"), "vanishing") is not None
            )
        async with db() as session:
            assert await session.scalar(select(models.Span).filter_by(span_id="span")) is not None
    else:
        with pytest.raises(RuntimeError, match="record disappeared during creation"):
            async with db() as session:
                await insert_span(session, _span("span", "trace", "span"), "vanishing")
    assert deleted == disappearances
