import asyncio
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from queue import SimpleQueue
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import NullPool, delete, func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError, StatementError
from sqlalchemy.ext.asyncio import AsyncSession, AsyncSessionTransaction, create_async_engine

from phoenix.db import bulk_inserter, models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import aio_sqlite_engine, get_async_db_url
from phoenix.db.insertion.helpers import get_sqlstate
from phoenix.db.insertion.span import SpanInsertionEvent, insert_span
from phoenix.server.app import _db
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanEvent, SpanKind, SpanStatusCode

_START = datetime(2026, 1, 1, tzinfo=timezone.utc)


def _span(name: str, trace_id: str = "trace", parent_id: str | None = None) -> Span:
    return Span(
        name=name,
        context=SpanContext(trace_id=trace_id, span_id=name),
        span_kind=SpanKind.LLM,
        parent_id=parent_id,
        start_time=_START,
        end_time=_START + timedelta(seconds=2),
        status_code=SpanStatusCode.ERROR,
        status_message="",
        attributes={
            "openinference": {"span": {"kind": "LLM"}},
            "llm": {"model_name": "test-model", "token_count": {"prompt": 7, "completion": 3}},
        },
        events=[],
        conversation=None,
    )


def _inserter(db: DbSessionFactory, *spans: Span, **kwargs: Any) -> BulkInserter:
    calculator = MagicMock()
    calculator.calculate_cost.side_effect = lambda *_: models.SpanCost(
        span_start_time=_START,
        total_cost=1.0,
        total_tokens=10,
    )
    kwargs.setdefault("retry_delay_sec", 0)
    return BulkInserter(
        db,
        event_queue=SimpleQueue[DmlEvent](),
        span_cost_calculator=calculator,
        initial_batch_of_spans=[(span, "project") for span in spans],
        **kwargs,
    )


class _PostgresError(Exception):
    def __init__(self, sqlstate: str) -> None:
        self.sqlstate = sqlstate


async def test_default_batches_commit_100_spans_without_timed_pauses(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    spans = [_span(f"span-{index}") for index in range(201)]
    inserter = _inserter(db, *spans)
    inserter._operations = asyncio.Queue()
    batch_sizes: list[int] = []
    insert_batch = inserter._insert_spans

    async def record_batch(size: int) -> None:
        batch_sizes.append(size)
        await insert_batch(size)

    async def yield_without_delay(delay: float) -> None:
        assert delay == 0
        await asyncio.sleep(0)

    yields = AsyncMock(side_effect=yield_without_delay)
    monkeypatch.setattr(inserter, "_insert_spans", record_batch)
    monkeypatch.setattr(bulk_inserter, "sleep", yields)
    await asyncio.wait_for(inserter._bulk_insert(), timeout=30)
    assert batch_sizes == [100, 100, 1]
    assert yields.await_count >= len(batch_sizes)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {
            span.context.span_id for span in spans
        }
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 201


async def test_idle_worker_waits_instead_of_spinning(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    parked = asyncio.Event()
    never_released = asyncio.Event()
    inserter = _inserter(db)

    async def park(delay: float) -> None:
        assert delay == inserter._sleep and delay > 0
        parked.set()
        await never_released.wait()

    monkeypatch.setattr(bulk_inserter, "sleep", park)
    async with inserter:
        await asyncio.wait_for(parked.wait(), timeout=10)


async def test_worker_waits_for_span_retry_but_processes_other_ready_work(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = [0.0]
    retry_waiting, resume, drained = asyncio.Event(), asyncio.Event(), asyncio.Event()
    never_released = asyncio.Event()
    attempts: list[str] = []
    operation_done = asyncio.Event()
    annotation_queue = MagicMock(empty=True)
    annotation_queue.insert = AsyncMock(return_value=[])
    inserter = _inserter(
        db, _span("first"), max_ops_per_transaction=1, retry_delay_sec=10, max_spans_queue_size=2
    )

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        attempts.append(span.name)
        if len(attempts) == 1:
            raise DBAPIError("rollback", {}, _PostgresError("40P01"))
        return await insert_span(session, span, project_name)

    async def operation(session: AsyncSession) -> None:
        await session.execute(select(1))
        operation_done.set()

    async def insert_annotations() -> list[DmlEvent]:
        annotation_queue.empty = True
        return []

    annotation_queue.insert.side_effect = insert_annotations

    async def control_wait(delay: float) -> None:
        if delay == 0:
            if len(attempts) == 1 and not operation_done.is_set():
                await inserter._enqueue_span(_span("later"), "project")
                inserter._enqueue_operation(operation)
                annotation_queue.empty = False
            await asyncio.sleep(0)
        else:
            assert delay == inserter._sleep and delay > 0
            if inserter._span_batch:
                retry_waiting.set()
                await resume.wait()
                clock[0] = 10
            else:
                drained.set()
                await never_released.wait()

    monkeypatch.setattr(bulk_inserter, "perf_counter", lambda: clock[0])
    monkeypatch.setattr(bulk_inserter, "uniform", lambda *_: 1.0)
    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    monkeypatch.setattr(bulk_inserter, "sleep", control_wait)
    monkeypatch.setattr(inserter._queue_inserters, "_queues", (annotation_queue,))
    async with inserter:
        await asyncio.wait_for(retry_waiting.wait(), timeout=10)
        assert attempts == ["first"]
        assert [span.name for span, _ in inserter._span_batch] == ["first"]
        assert [span.name for span, _ in inserter._spans] == ["later"]
        assert inserter.is_full
        assert operation_done.is_set()
        annotation_queue.insert.assert_awaited_once()
        resume.set()
        await asyncio.wait_for(drained.wait(), timeout=10)
        assert attempts == ["first", "first", "later"]
        assert not inserter.is_full
        async with db() as session:
            assert set(await session.scalars(select(models.Span.span_id))) == {"first", "later"}


async def test_operation_checkout_failure_waits_before_retry(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = 0
    waits: list[float] = []

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise ConnectionError("database unavailable")
        async with db() as session:
            yield session

    async def operation(session: AsyncSession) -> None:
        await session.execute(select(1))

    async def record_wait(delay: float) -> None:
        waits.append(delay)
        await asyncio.sleep(0)

    inserter = _inserter(DbSessionFactory(transaction, db.dialect.name_literal))
    inserter._operations = asyncio.Queue()
    queued_operation = AsyncMock(side_effect=operation)
    inserter._operations.put_nowait(queued_operation)
    monkeypatch.setattr(bulk_inserter, "sleep", record_wait)
    await asyncio.wait_for(inserter._bulk_insert(), timeout=10)
    assert calls == 2
    assert waits == [inserter._sleep, 0]
    queued_operation.assert_awaited_once()


async def test_sqlite_waiting_writer_runs_between_span_batches(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = aio_sqlite_engine(
        get_async_db_url(f"sqlite:///{tmp_path / 'fairness.db'}"), migrate=False
    )
    writer_task: asyncio.Task[None] | None = None
    try:
        async with engine.begin() as connection:
            await connection.run_sync(models.Base.metadata.create_all)
        production_db = DbSessionFactory(_db(engine), "sqlite")
        inserter = _inserter(production_db, *[_span(f"span-{index}") for index in range(101)])
        cast(MagicMock, inserter._span_cost_calculator).calculate_cost.side_effect = lambda *_: None
        inserter._operations = asyncio.Queue()
        writer_started = asyncio.Event()
        spans_seen_by_writer: list[int | None] = []

        async def competing_write() -> None:
            async with production_db() as session:
                writer_started.set()
                session.add(models.Project(name="other-writer"))
                await session.flush()
                spans_seen_by_writer.append(
                    await session.scalar(select(func.count()).select_from(models.Span))
                )

        async def insert(
            session: AsyncSession, span: Span, project_name: str
        ) -> SpanInsertionEvent | None:
            nonlocal writer_task
            result = await insert_span(session, span, project_name)
            if span.name == "span-99":
                writer_task = asyncio.create_task(competing_write())
                await asyncio.wait_for(writer_started.wait(), timeout=10)
                assert not writer_task.done()
            return result

        async def yield_without_delay(delay: float) -> None:
            assert delay == 0
            await asyncio.sleep(0)

        monkeypatch.setattr(bulk_inserter, "insert_span", insert)
        monkeypatch.setattr(bulk_inserter, "sleep", yield_without_delay)
        await asyncio.wait_for(inserter._bulk_insert(), timeout=30)
        assert writer_task is not None
        await asyncio.wait_for(writer_task, timeout=10)
        assert spans_seen_by_writer == [100]
        async with production_db() as session:
            assert await session.scalar(select(func.count()).select_from(models.Span)) == 101
            assert (
                await session.scalar(select(models.Project.id).filter_by(name="other-writer"))
                is not None
            )
    finally:
        if writer_task is not None:
            if not writer_task.done():
                writer_task.cancel()
            await asyncio.gather(writer_task, return_exceptions=True)
        await engine.dispose()


@pytest.mark.parametrize(
    "error",
    [OSError("connection refused"), DBAPIError(None, None, _PostgresError("57P03"))],
    ids=["connection-refused", "database-recovering"],
)
@pytest.mark.parametrize("outcome", ["recovery", "exhaustion"])
async def test_connection_acquisition_failure_retains_batch_and_honors_retry_limit(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    error: Exception,
    outcome: str,
) -> None:
    connection_attempts = 0

    async def unavailable_connection() -> Any:
        nonlocal connection_attempts
        connection_attempts += 1
        raise error

    unavailable_engine = create_async_engine(
        "sqlite+aiosqlite://", async_creator=unavailable_connection, poolclass=NullPool
    )
    sessions: list[AsyncSession] = []

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        factory = _db(unavailable_engine) if len(sessions) < 2 else db
        async with factory() as session:
            sessions.append(session)
            yield session

    inserts = AsyncMock(side_effect=insert_span)
    failures, unresolved, progress = MagicMock(), MagicMock(), MagicMock()
    monkeypatch.setattr(bulk_inserter, "insert_span", inserts)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_UNRESOLVED_SPANS", unresolved)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_LAST_SUCCESS", progress)
    allowance = 2 if outcome == "recovery" else 1
    inserter = _inserter(
        DbSessionFactory(transaction, db.dialect.name_literal),
        _span("first"),
        _span("second"),
        retry_allowance=allowance,
        max_spans_queue_size=2,
    )
    try:
        for attempt in (1, 2):
            await inserter._insert_spans(2)
            assert connection_attempts == attempt
            inserts.assert_not_awaited()
            cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_not_called()
            assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
            unresolved.inc.assert_not_called()
            progress.set.assert_not_called()
            if attempt <= allowance:
                assert [span.name for span, _ in inserter._span_batch] == ["first", "second"]
                assert inserter.is_full and inserter._span_retry_attempts == attempt
                failures.labels.assert_not_called()
        assert sessions[0] is not sessions[1]
        assert "phase=connect" in caplog.text
        assert "Span insertion failed after savepoint rollback" not in caplog.text
        if outcome == "exhaustion":
            assert not inserter._span_batch and not inserter.is_full
            assert inserter._span_retry_attempts == 0 and inserter._span_retry_at == 0
            failures.labels.assert_called_once_with(reason="retry_exhausted")
            failures.labels.return_value.inc.assert_called_once_with(2)
            await inserter._enqueue_span(_span("later"), "project")
        await inserter._insert_spans(2)
        assert not inserter._span_batch and not inserter.is_full
        assert connection_attempts == 2
        progress.set.assert_called_once()
        expected = {"first", "second"} if outcome == "recovery" else {"later"}
        async with db() as session:
            assert set(await session.scalars(select(models.Span.span_id))) == expected
            assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == len(
                expected
            )
        assert cast(MagicMock, inserter._span_cost_calculator).calculate_cost.call_count == len(
            expected
        )
        if outcome == "recovery":
            failures.labels.assert_not_called()
    finally:
        await unavailable_engine.dispose()


@pytest.mark.parametrize("outcome", ["commit", "rollback", "cancel"])
async def test_sqlite_production_batch_is_atomic_and_releases_connection(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, outcome: str
) -> None:
    engine = aio_sqlite_engine(
        get_async_db_url(f"sqlite:///{tmp_path / 'spans.db'}"), migrate=False
    )
    task: asyncio.Task[None] | None = None
    try:
        async with engine.begin() as connection:
            await connection.run_sync(models.Base.metadata.create_all)
        production_db = DbSessionFactory(_db(engine), "sqlite")
        second_written = asyncio.Event()
        never_released = asyncio.Event()

        async def insert(
            session: AsyncSession, span: Span, project_name: str
        ) -> SpanInsertionEvent | None:
            result = await insert_span(session, span, project_name)
            if span.context.span_id == "second" and outcome == "cancel":
                second_written.set()
                await never_released.wait()
            return result

        @asynccontextmanager
        async def transaction() -> AsyncIterator[AsyncSession]:
            async with production_db() as session:
                yield session
                if outcome == "rollback":
                    raise RuntimeError("abort after releasing span savepoints")

        monkeypatch.setattr(bulk_inserter, "insert_span", insert)
        inserter = _inserter(
            DbSessionFactory(transaction, "sqlite"), _span("first"), _span("second")
        )
        task = asyncio.create_task(inserter._insert_spans(2))
        if outcome == "cancel":
            await asyncio.wait_for(second_written.wait(), timeout=10)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await asyncio.wait_for(task, timeout=10)
        else:
            await asyncio.wait_for(task, timeout=10)
        async with production_db() as session:
            assert set(await session.scalars(select(models.Span.span_id))) == (
                {"first", "second"} if outcome == "commit" else set()
            )
            assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == (
                2 if outcome == "commit" else 0
            )
        if outcome != "commit":
            cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_not_called()
            assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
        later = _inserter(production_db, _span("later"))
        await asyncio.wait_for(later._insert_spans(1), timeout=10)
        async with production_db() as session:
            assert await session.scalar(select(models.Span).filter_by(span_id="later")) is not None
    finally:
        if task is not None:
            if not task.done():
                task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        await engine.dispose()


@pytest.mark.parametrize("sqlstate", ["40P01", "40001"])
@pytest.mark.parametrize("fail_at_commit", [False, True])
async def test_retry_whole_transaction_after_rollback(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    sqlstate: str,
    fail_at_commit: bool,
) -> None:
    root = replace(
        _span("root"), span_kind=SpanKind.CHAIN, attributes={}, status_code=SpanStatusCode.OK
    )
    async with db() as session:
        await insert_span(session, root, "project")
    sessions: list[AsyncSession] = []
    secret = "private-retry-payload-must-not-be-logged"
    error = DBAPIError(secret, {"attributes": secret}, _PostgresError(sqlstate))

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        async with db() as session:
            sessions.append(session)
            yield session
            if fail_at_commit and len(sessions) == 1:
                raise error

    calls = 0

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        nonlocal calls
        calls += 1
        result = await insert_span(session, span, project_name)
        if not fail_at_commit and calls == 2:
            raise error
        return result

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    inserter = _inserter(
        DbSessionFactory(transaction, db.dialect.name_literal),
        _span("child-1", parent_id="root"),
        _span("child-2", parent_id="root"),
        max_spans_queue_size=2,
    )
    await inserter._insert_spans(2)
    assert secret not in caplog.text
    assert all(
        record.exc_info is None
        for record in caplog.records
        if record.name == bulk_inserter.__name__
    )
    calculator = cast(MagicMock, inserter._span_cost_calculator)
    calculator.calculate_cost.assert_not_called()
    assert len(inserter._span_batch) == 2
    assert inserter.is_full
    assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 1
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 0
    # Pending work is retried even when the waiting queue is empty.
    await inserter._insert_spans(0)
    assert calculator.calculate_cost.call_count == 2
    assert sessions[0] is not sessions[1]
    assert not inserter._span_batch
    assert not inserter.is_full
    async with db() as session:
        saved = {span.span_id: span for span in await session.scalars(select(models.Span))}
        assert set(saved) == {"root", "child-1", "child-2"}
        assert saved["root"].cumulative_error_count == 2
        assert saved["root"].cumulative_llm_token_count_prompt == 14
        assert saved["root"].cumulative_llm_token_count_completion == 6
        costs = list(await session.scalars(select(models.SpanCost)))
        assert {cost.span_rowid for cost in costs} == {saved["child-1"].id, saved["child-2"].id}
    assert not cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()


async def test_cost_calculation_waits_for_confirmed_span_commit(db: DbSessionFactory) -> None:
    ready_to_commit = asyncio.Event()
    allow_commit = asyncio.Event()
    commit_confirmed = asyncio.Event()
    transactions_started = 0

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        nonlocal transactions_started
        transactions_started += 1
        transaction_number = transactions_started
        async with db() as session:
            yield session
            if transaction_number == 1:
                ready_to_commit.set()
                await allow_commit.wait()
        if transaction_number == 1:
            commit_confirmed.set()

    inserter = _inserter(DbSessionFactory(transaction, db.dialect.name_literal), _span("span"))
    calculator = cast(MagicMock, inserter._span_cost_calculator)

    def calculate(start_time: datetime, _: Mapping[str, Any]) -> models.SpanCost:
        assert commit_confirmed.is_set()
        assert transactions_started == 1
        return models.SpanCost(span_start_time=start_time, total_cost=1.0, total_tokens=10)

    calculator.calculate_cost.side_effect = calculate
    task = asyncio.create_task(inserter._insert_spans(1))
    try:
        await asyncio.wait_for(ready_to_commit.wait(), timeout=10)
        calculator.calculate_cost.assert_not_called()
        assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
        allow_commit.set()
        await asyncio.wait_for(task, timeout=10)
    finally:
        allow_commit.set()
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    calculator.calculate_cost.assert_called_once()
    assert transactions_started == 2
    async with db() as session:
        saved_span = (await session.scalars(select(models.Span))).one()
        saved_cost = (await session.scalars(select(models.SpanCost))).one()
        assert saved_cost.span_rowid == saved_span.id
        assert saved_cost.trace_rowid == saved_span.trace_rowid
        saved_trace = await session.get(models.Trace, saved_span.trace_rowid)
        assert saved_trace is not None
        assert cast(SimpleQueue[DmlEvent], inserter._event_queue).get_nowait() == SpanInsertEvent(
            (saved_trace.project_rowid,)
        )
        assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()


@pytest.mark.parametrize("calculation_failure", ["exception", "no-details"])
async def test_cost_calculation_failure_preserves_spans_and_neighbor_costs(
    db: DbSessionFactory,
    calculation_failure: str,
) -> None:
    bad = _span("bad-cost")
    bad = replace(
        bad,
        attributes={
            **bad.attributes,
            "llm": {"model_name": "cannot-calculate", "token_count": {"prompt": 7}},
        },
    )
    no_cost = replace(_span("no-cost"), span_kind=SpanKind.CHAIN, attributes={})
    inserter = _inserter(db, _span("first"), bad, _span("last"), no_cost, _span("first"))
    calculator = cast(MagicMock, inserter._span_cost_calculator)

    def calculate(start_time: datetime, attributes: Mapping[str, Any]) -> models.SpanCost | None:
        if attributes["llm"]["model_name"] == "cannot-calculate":
            if calculation_failure == "exception":
                raise ValueError("cannot calculate this span's cost")
            return None
        return models.SpanCost(span_start_time=start_time, total_cost=1.0, total_tokens=10)

    calculator.calculate_cost.side_effect = calculate
    await inserter._insert_spans(5)
    assert calculator.calculate_cost.call_count == 3
    assert not inserter._span_batch
    assert inserter._span_retry_attempts == 0
    async with db() as session:
        saved = {span.span_id: span for span in await session.scalars(select(models.Span))}
        assert set(saved) == {"first", "bad-cost", "last", "no-cost"}
        assert set(await session.scalars(select(models.SpanCost.span_rowid))) == {
            saved["first"].id,
            saved["last"].id,
        }
    assert not cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()


async def test_cost_save_failure_does_not_retry_committed_spans(db: DbSessionFactory) -> None:
    transactions_started = 0

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        nonlocal transactions_started
        transactions_started += 1
        async with db() as session:
            yield session
            if transactions_started == 2:
                raise RuntimeError("cost transaction failed")

    inserter = _inserter(DbSessionFactory(transaction, db.dialect.name_literal), _span("span"))
    await inserter._insert_spans(1)
    await inserter._insert_spans(0)
    assert transactions_started == 2
    cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_called_once()
    assert not inserter._span_batch
    assert inserter._span_retry_attempts == 0
    assert not cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 1
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 0


async def test_unknown_commit_outcome_is_released_without_replay_and_later_work_proceeds(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    calls = 0
    secret = "private-unresolved-payload-must-not-be-logged"
    unresolved = MagicMock()
    progress = MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_UNRESOLVED_SPANS", unresolved)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_LAST_SUCCESS", progress)

    @asynccontextmanager
    async def lost_confirmation() -> AsyncIterator[AsyncSession]:
        nonlocal calls
        calls += 1
        async with db() as session:
            yield session
        if calls == 1:
            raise ConnectionError(secret)

    inserter = _inserter(
        DbSessionFactory(lost_confirmation, db.dialect.name_literal), _span("span")
    )
    await inserter._insert_spans(1)
    assert secret not in caplog.text
    assert all(
        record.exc_info is None
        for record in caplog.records
        if record.name == bulk_inserter.__name__
    )
    cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_not_called()
    assert not inserter._span_batch and not inserter.is_full
    unresolved.inc.assert_called_once_with(1)
    progress.set.assert_not_called()
    assert cast(SimpleQueue[DmlEvent], inserter._event_queue).empty()
    async with db() as session:
        saved = await session.scalar(select(models.Span))
        assert saved is not None
        await session.delete(saved)
    await inserter._insert_spans(1)
    assert calls == 1
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    assert calls == 3  # New span transaction and its separate cost transaction.
    unresolved.inc.assert_called_once_with(1)
    progress.set.assert_called_once()
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"later"}
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 1


async def test_disconnect_at_commit_boundary_is_unresolved_without_replay(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = 0

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        nonlocal calls
        calls += 1
        async with db() as session:
            yield session
            if calls == 1:
                raise DBAPIError("COMMIT", {}, _PostgresError("08006"), connection_invalidated=True)

    unresolved = MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_UNRESOLVED_SPANS", unresolved)
    inserter = _inserter(DbSessionFactory(transaction, db.dialect.name_literal), _span("span"))
    await inserter._insert_spans(1)
    assert not inserter._span_batch and inserter._span_retry_attempts == 0
    unresolved.inc.assert_called_once_with(1)
    await inserter._insert_spans(1)
    assert calls == 1
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"later"}


@pytest.mark.parametrize("cleanup", ["rollback", "commit"])
async def test_savepoint_cleanup_failure_aborts_batch_without_reusing_session(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch, cleanup: str
) -> None:
    sessions: list[AsyncSession] = []
    calls: list[str] = []

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        async with db() as session:
            sessions.append(session)
            yield session

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        calls.append(span.name)
        if span.name == "failure":
            raise ValueError("span failed")
        return await insert_span(session, span, project_name)

    async def fail_cleanup(_: AsyncSessionTransaction) -> None:
        raise RuntimeError("savepoint cleanup failed")

    original_cleanup = getattr(AsyncSessionTransaction, cleanup)
    monkeypatch.setattr(AsyncSessionTransaction, cleanup, fail_cleanup)
    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    failures = MagicMock()
    unresolved = MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_UNRESOLVED_SPANS", unresolved)
    inserter = _inserter(
        DbSessionFactory(transaction, db.dialect.name_literal),
        _span("first"),
        _span("failure"),
        _span("last"),
    )
    await inserter._insert_spans(3)
    assert calls == (["first", "failure"] if cleanup == "rollback" else ["first"])
    assert not inserter._span_batch and not inserter.is_full
    failures.labels.assert_called_once_with(reason="transaction_error")
    failures.labels.return_value.inc.assert_called_once_with(3)
    unresolved.inc.assert_not_called()
    cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_not_called()
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 0
    monkeypatch.setattr(AsyncSessionTransaction, cleanup, original_cleanup)
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    assert sessions[0] is not sessions[1]
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"later"}


@pytest.mark.postgres_only
async def test_actual_precommit_disconnect_retries_whole_batch_with_fresh_session(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires terminating an independent PostgreSQL connection")
    sessions: list[AsyncSession] = []
    disconnects: list[DBAPIError] = []
    terminated = False

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        async with db() as session:
            sessions.append(session)
            yield session

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        nonlocal terminated
        if span.name == "second" and not terminated:
            backend_pid = await session.scalar(text("SELECT pg_backend_pid()"))
            async with db() as killer:
                assert await killer.scalar(
                    text("SELECT pg_terminate_backend(:pid)"), {"pid": backend_pid}
                )
            terminated = True
        try:
            return await insert_span(session, span, project_name)
        except DBAPIError as error:
            assert error.connection_invalidated
            disconnects.append(error)
            raise

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    failures, unresolved, progress = MagicMock(), MagicMock(), MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_UNRESOLVED_SPANS", unresolved)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_LAST_SUCCESS", progress)
    inserter = _inserter(
        DbSessionFactory(transaction, db.dialect.name_literal),
        _span("first"),
        _span("second"),
        max_spans_queue_size=2,
    )
    await inserter._insert_spans(2)
    assert len(disconnects) == 1 and len(inserter._span_batch) == 2
    assert inserter.is_full and inserter._span_retry_attempts == 1
    cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_not_called()
    failures.labels.assert_not_called()
    unresolved.inc.assert_not_called()
    progress.set.assert_not_called()
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 0
    await inserter._insert_spans(0)
    assert not inserter._span_batch and not inserter.is_full
    assert sessions[0] is not sessions[1]
    progress.set.assert_called_once()
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "second"}
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 2


async def test_failed_span_accounting_waits_for_final_transaction_outcome(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls = 0

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        nonlocal calls
        if span.name.startswith("invalid"):
            raise ValueError("invalid span")
        calls += 1
        if calls == 1:
            raise DBAPIError("rollback", {}, _PostgresError("40P01"))
        return await insert_span(session, span, project_name)

    failures = MagicMock()
    progress = MagicMock()
    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_LAST_SUCCESS", progress)
    inserter = _inserter(db, _span("invalid"), _span("invalid-too"), _span("valid"))
    await inserter._insert_spans(3)
    failures.labels.assert_not_called()
    progress.set.assert_not_called()
    await inserter._insert_spans(0)
    failures.labels.assert_called_once_with(reason="span_error")
    failures.labels.return_value.inc.assert_called_once_with(2)
    progress.set.assert_called_once()
    await inserter._enqueue_span(_span("valid"), "project")
    await inserter._insert_spans(1)
    progress.set.assert_called_once()  # A duplicate batch is not new insertion progress.


async def test_shutdown_awaits_rollback_and_keeps_pending_batch(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    written = asyncio.Event()
    never_released = asyncio.Event()

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        result = await insert_span(session, span, project_name)
        written.set()
        await never_released.wait()
        return result

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    inserter = _inserter(db, _span("span"), max_spans_queue_size=1)
    async with inserter:
        await asyncio.wait_for(written.wait(), timeout=10)
        assert inserter.is_full
    assert inserter._task is None and inserter.is_full
    assert len(inserter._span_batch) == 1
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 0


async def test_annotation_failure_still_awaits_other_annotation_writes(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    started = asyncio.Event()
    release = asyncio.Event()
    expected = SpanInsertEvent((1,))

    async def successful_write() -> list[DmlEvent]:
        started.set()
        await release.wait()
        return [expected]

    async def failed_write() -> None:
        await started.wait()
        raise RuntimeError("annotation failed")

    inserter = _inserter(db)
    good, bad = MagicMock(empty=False), MagicMock(empty=False)
    good.insert = AsyncMock(side_effect=successful_write)
    bad.insert = AsyncMock(side_effect=failed_write)
    monkeypatch.setattr(inserter._queue_inserters, "_queues", (good, bad))

    async def collect() -> list[DmlEvent]:
        return [event async for event in inserter._queue_inserters.insert()]

    task = asyncio.create_task(collect())
    try:
        await asyncio.wait_for(started.wait(), timeout=10)
        release.set()
        assert await asyncio.wait_for(task, timeout=10) == [expected]
    finally:
        release.set()
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_annotation_cancellation_awaits_all_child_cleanup(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    started = [asyncio.Event(), asyncio.Event()]
    cleaned = [asyncio.Event(), asyncio.Event()]
    cleanup_started = [asyncio.Event(), asyncio.Event()]
    allow_cleanup = asyncio.Event()
    never_released = asyncio.Event()

    async def write(index: int) -> None:
        started[index].set()
        try:
            await never_released.wait()
        finally:
            cleanup_started[index].set()
            await allow_cleanup.wait()
            cleaned[index].set()

    inserter = _inserter(db)
    queues = [MagicMock(empty=False), MagicMock(empty=False)]
    for index, queue in enumerate(queues):
        queue.insert = lambda index=index: write(index)
    monkeypatch.setattr(inserter._queue_inserters, "_queues", tuple(queues))

    async def collect() -> None:
        async for _ in inserter._queue_inserters.insert():
            pass

    task = asyncio.create_task(collect())
    try:
        await asyncio.wait_for(asyncio.gather(*(event.wait() for event in started)), timeout=10)
        task.cancel()
        await asyncio.wait_for(
            asyncio.gather(*(event.wait() for event in cleanup_started)), timeout=10
        )
        assert not task.done() and not any(event.is_set() for event in cleaned)
        allow_cleanup.set()
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=10)
        assert all(event.is_set() for event in cleaned)
    finally:
        allow_cleanup.set()
        if not task.done() and not task.cancelling():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


async def test_span_failure_diagnostics_include_locations_without_payloads(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    secret = "private-span-payload-must-not-be-logged"

    async def fail_insert(session: AsyncSession, span: Span, project_name: str) -> None:
        try:
            raise TypeError(secret)
        except TypeError as cause:
            raise DBAPIError(secret, {"attributes": secret}, cause) from cause

    monkeypatch.setattr(bulk_inserter, "insert_span", fail_insert)
    inserter = _inserter(db, _span("span"))
    await inserter._insert_spans(1)
    assert "phase=insert_span" in caplog.text
    assert "test_bulk_inserter.fail_insert:" in caplog.text
    assert "bulk_inserter._insert_spans:" in caplog.text
    assert secret not in caplog.text
    assert all(record.exc_info is None for record in caplog.records)


async def test_operation_transaction_failure_does_not_stop_span_worker(
    db: DbSessionFactory,
) -> None:
    calls = 0

    @asynccontextmanager
    async def transaction() -> AsyncIterator[AsyncSession]:
        nonlocal calls
        calls += 1
        async with db() as session:
            yield session
            if calls == 1:
                raise ConnectionError("operation commit failed")

    async def operation(session: AsyncSession) -> None:
        await session.execute(select(1))

    inserter = _inserter(DbSessionFactory(transaction, db.dialect.name_literal), _span("span"))
    inserter._operations = asyncio.Queue()
    inserter._operations.put_nowait(operation)
    await asyncio.wait_for(inserter._bulk_insert(), timeout=10)
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 1
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 1


@pytest.mark.parametrize("invalid_input", ["json", "tokens"])
async def test_invalid_span_does_not_block_valid_neighbors(
    db: DbSessionFactory,
    invalid_input: str,
) -> None:
    if invalid_input == "json":
        attributes: dict[str, Any] = {"unsupported": object()}
    else:
        attributes = {"llm": {"model_name": "test-model", "token_count": {"prompt": str(2**80)}}}
    invalid = _span("invalid")
    invalid = replace(invalid, attributes={**invalid.attributes, **attributes})
    inserter = _inserter(db, _span("first"), invalid, _span("last"), _span("first"))
    await inserter._insert_spans(4)
    assert cast(MagicMock, inserter._span_cost_calculator).calculate_cost.call_count == 2
    assert not inserter._span_batch and not inserter._spans
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "last"}
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 2


@pytest.mark.parametrize("existing_trace", [False, True], ids=["new-trace", "existing-trace"])
@pytest.mark.parametrize("field", ["name", "json_value", "project_name"])
async def test_nul_span_is_isolated_without_changing_sqlite_behavior(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
    existing_trace: bool,
    field: str,
) -> None:
    root = replace(
        _span("root", trace_id="invalid-trace"),
        span_kind=SpanKind.CHAIN,
        status_code=SpanStatusCode.OK,
        attributes={"session": {"id": "established-session"}},
    )
    if existing_trace:
        async with db() as session:
            await insert_span(session, root, "authoritative-project")

    value = "contains\x00nul"
    invalid = replace(
        _span("invalid", trace_id="invalid-trace", parent_id="root"),
        start_time=_START - timedelta(hours=1),
        end_time=_START + timedelta(hours=1),
    )
    attributes = {**invalid.attributes, "session": {"id": "invalid-session"}}
    project_name = "invalid-project"
    if field == "name":
        invalid = replace(invalid, name=value)
    elif field == "json_value":
        attributes["input"] = value
    else:
        project_name = value
    invalid = replace(invalid, attributes=attributes)
    inserter = _inserter(db, _span("first"), invalid, _span("last"))
    inserter._spans[1] = (invalid, project_name)
    await inserter._insert_spans(3)

    rejected = db.dialect.name_literal == "postgresql" and not (
        field == "project_name" and existing_trace
    )
    if rejected:
        assert f"sqlstate={'22P05' if field == 'json_value' else '22021'}" in caplog.text
    assert not inserter._span_batch and not inserter._spans and not inserter.is_full
    assert inserter._span_retry_attempts == 0
    cast(MagicMock, inserter._span_cost_calculator).calculate_cost.assert_any_call(
        _START, _span("first").attributes
    )
    assert cast(MagicMock, inserter._span_cost_calculator).calculate_cost.call_count == (
        2 if rejected else 3
    )
    async with db() as session:
        saved = {span.span_id: span for span in await session.scalars(select(models.Span))}
        expected = {"first", "last"} | ({"root"} if existing_trace else set())
        if not rejected:
            expected.add("invalid")
        assert set(saved) == expected
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == (
            2 if rejected else 3
        )
        if rejected:
            assert set(await session.scalars(select(models.Project.name))) == (
                {"project", "authoritative-project"} if existing_trace else {"project"}
            )
            assert set(await session.scalars(select(models.Trace.trace_id))) == (
                {"trace", "invalid-trace"} if existing_trace else {"trace"}
            )
            assert set(await session.scalars(select(models.ProjectSession.session_id))) == (
                {"established-session"} if existing_trace else set()
            )
            if existing_trace:
                trace = await session.scalar(
                    select(models.Trace).filter_by(trace_id="invalid-trace")
                )
                project_session = await session.scalar(select(models.ProjectSession))
                assert trace is not None and project_session is not None
                assert (trace.start_time, trace.end_time) == (root.start_time, root.end_time)
                assert (project_session.start_time, project_session.end_time) == (
                    root.start_time,
                    root.end_time,
                )
                assert saved["root"].cumulative_llm_token_count_prompt == 0
        else:
            stored = saved["invalid"]
            assert stored.name == invalid.name and stored.attributes == invalid.attributes
            trace = await session.get(models.Trace, stored.trace_rowid)
            assert trace is not None
            project = await session.get(models.Project, trace.project_rowid)
            assert project is not None
            assert project.name == ("authoritative-project" if existing_trace else project_name)


async def test_literal_nul_escape_and_json_null_are_preserved(db: DbSessionFactory) -> None:
    value = r"literal\u0000sequence"
    span = replace(
        _span(value, trace_id=value, parent_id=value + "-parent"),
        status_message=value,
        events=[SpanEvent(name=value, timestamp=_START, attributes={value: None})],
    )
    span = replace(
        span,
        attributes={**span.attributes, "session": {"id": value}, value: [None, "", value]},
    )
    inserter = _inserter(db, span)
    inserter._spans[0] = (span, value)
    await inserter._insert_spans(1)
    assert not inserter._span_batch and not inserter.is_full
    async with db() as session:
        stored = (await session.scalars(select(models.Span))).one()
        assert stored.span_id == stored.name == stored.status_message == value
        assert stored.parent_id == value + "-parent"
        assert stored.attributes == span.attributes
        assert stored.events == [
            {"name": value, "timestamp": _START.isoformat(), "attributes": {value: None}}
        ]
        assert (await session.scalars(select(models.Trace))).one().trace_id == value
        assert (await session.scalars(select(models.Project))).one().name == value
        assert (await session.scalars(select(models.ProjectSession))).one().session_id == value
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 1


@pytest.mark.parametrize("failure_at", ["span-insert", "ancestor-update"])
async def test_cumulative_overflow_preserves_existing_spans(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    failure_at: str,
) -> None:
    if failure_at == "ancestor-update" and db.dialect.name_literal != "postgresql":
        pytest.skip("SQLite promotes overflowing arithmetic results to REAL")
    maximum = (1 << (31 if db.dialect.name_literal == "postgresql" else 63)) - 1
    existing = replace(
        _span("existing", parent_id="incoming" if failure_at == "span-insert" else None),
        attributes={"llm": {"token_count": {"prompt": maximum}}},
    )
    async with db() as session:
        await insert_span(session, existing, "project")
    incoming = replace(
        _span("incoming", parent_id="existing" if failure_at == "ancestor-update" else None),
        attributes={"llm": {"token_count": {"prompt": 1}}},
    )
    inserter = _inserter(db, _span("neighbor"), incoming)
    failures = MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    await inserter._insert_spans(2)
    assert not inserter._span_batch and not inserter.is_full
    failures.labels.assert_called_once_with(reason="span_error")
    failures.labels.return_value.inc.assert_called_once_with(1)
    assert inserter._span_retry_attempts == 0
    async with db() as session:
        saved = await session.scalar(select(models.Span).filter_by(span_id="existing"))
        assert saved is not None
        assert saved.cumulative_llm_token_count_prompt == maximum
        assert set(await session.scalars(select(models.Span.span_id))) == {"existing", "neighbor"}
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {
            "existing",
            "neighbor",
            "later",
        }


@pytest.mark.parametrize(
    "error",
    [
        ValueError("programming failure"),
        StatementError("unrecognized bind failure", "test", {}, TypeError("binding bug")),
        DBAPIError("test", {}, Exception("the message mentions 40P01 without a SQLSTATE")),
    ],
)
async def test_unrecognized_span_errors_preserve_neighbors_after_savepoint_rollback(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    error: Exception,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        if span.name == "failure":
            raise error
        return await insert_span(session, span, project_name)

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    inserter = _inserter(db, _span("first"), _span("failure"), _span("last"))
    await inserter._insert_spans(3)
    assert not inserter._span_batch and not inserter.is_full
    assert inserter._span_retry_attempts == 0
    assert "reason=span_error" in caplog.text
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "last"}
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 2


@pytest.mark.postgres_only
@pytest.mark.parametrize("sqlstate", ["23503", "23505", "42501", "08006", "40003", "XX000"])
async def test_injected_driver_errors_preserve_same_batch_neighbors(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    sqlstate: str,
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires PostgreSQL driver errors")

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        if span.name == "failure":
            # Inject a driver error without breaking the connection itself.
            await session.execute(
                text(f"DO $$ BEGIN RAISE EXCEPTION 'injected' USING ERRCODE = '{sqlstate}'; END $$")
            )
        return await insert_span(session, span, project_name)

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    inserter = _inserter(db, _span("first"), _span("failure"), _span("last"))
    await inserter._insert_spans(3)
    assert not inserter._span_batch and not inserter.is_full
    assert inserter._span_retry_attempts == 0
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "last"}
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 2


@pytest.mark.postgres_only
async def test_concurrent_session_deletion_fails_one_span_without_stalling_ingestion(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires an independent PostgreSQL deletion transaction")
    async with db() as session:
        project = models.Project(name="project")
        session.add(project)
        await session.flush()
        orphan = models.ProjectSession(
            session_id="deleted-session",
            project_id=project.id,
            start_time=_START - timedelta(hours=1),
            end_time=_START + timedelta(hours=1),
        )
        session.add(orphan)
        await session.flush()
        orphan_id = orphan.id
    deleted = False
    original_scalar = AsyncSession.scalar

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        nonlocal deleted
        record = await original_scalar(session, statement, *args, **kwargs)
        if isinstance(record, models.ProjectSession) and record.id == orphan_id and not deleted:
            deleted = True
            async with db() as deleter:
                await deleter.execute(
                    delete(models.ProjectSession).where(models.ProjectSession.id == orphan_id)
                )
        return record

    monkeypatch.setattr(AsyncSession, "scalar", scalar)
    failure = replace(
        _span("failure", trace_id="failed-trace"),
        attributes={"session": {"id": "deleted-session"}},
    )
    inserter = _inserter(db, _span("first"), failure, _span("last"))
    await inserter._insert_spans(3)
    assert deleted and not inserter._span_batch and not inserter.is_full
    assert "reason=span_error" in caplog.text and "sqlstate=23503" in caplog.text
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "last"}
        assert set(await session.scalars(select(models.Trace.trace_id))) == {"trace"}
        assert await session.scalar(select(func.count()).select_from(models.ProjectSession)) == 0
        assert await session.scalar(select(func.count()).select_from(models.SpanCost)) == 2
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"first", "last", "later"}


async def test_legacy_pgcode_field_can_retry_known_rollbacks(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original = Exception("rollback")
    setattr(original, "pgcode", "40P01")
    calls = 0

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        nonlocal calls
        calls += 1
        if calls == 1:
            raise IntegrityError("driver changed its exception category", {}, original)
        return await insert_span(session, span, project_name)

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    inserter = _inserter(db, _span("span"))
    await inserter._insert_spans(1)
    assert inserter._span_retry_attempts == 1
    await inserter._insert_spans(0)
    assert not inserter._span_batch
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.Span)) == 1


async def test_retry_exhaustion_releases_batch_and_capacity_and_later_work_proceeds(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = 0

    async def fail(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        nonlocal calls
        calls += 1
        if span.name == "span":
            raise DBAPIError("rollback", {}, _PostgresError("40P01"))
        return await insert_span(session, span, project_name)

    monkeypatch.setattr(bulk_inserter, "insert_span", fail)
    inserter = _inserter(db, _span("span"), retry_allowance=1, max_spans_queue_size=1)
    failures = MagicMock()
    monkeypatch.setattr(bulk_inserter, "SPAN_INGESTION_FAILED_SPANS", failures)
    for _ in range(3):
        await inserter._insert_spans(1)
    assert calls == 2
    assert not inserter._span_batch and not inserter.is_full
    assert inserter._span_retry_attempts == 0 and inserter._span_retry_at == 0
    failures.labels.assert_called_once_with(reason="retry_exhausted")
    failures.labels.return_value.inc.assert_called_once_with(1)
    await inserter._enqueue_span(_span("later"), "project")
    await inserter._insert_spans(1)
    async with db() as session:
        assert set(await session.scalars(select(models.Span.span_id))) == {"later"}


@pytest.mark.postgres_only
@pytest.mark.parametrize("sqlstate", ["40P01", "40001"])
async def test_real_database_rollback_is_retried_without_span_or_count_loss(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    sqlstate: str,
) -> None:
    if db.dialect.name_literal != "postgresql":
        pytest.skip("Requires independent PostgreSQL transactions")
    async with db() as session:
        for trace_id in ("trace-a", "trace-b"):
            root = replace(
                _span(f"root-{trace_id}", trace_id),
                span_kind=SpanKind.CHAIN,
                attributes={},
                status_code=SpanStatusCode.OK,
                end_time=_START + timedelta(seconds=1),
            )
            await insert_span(session, root, "project")
    first_writes: set[AsyncSession] = set()
    both_locked = asyncio.Event()
    failures: list[str | None] = []

    @asynccontextmanager
    async def serializable_transaction() -> AsyncIterator[AsyncSession]:
        async with db() as session:
            await session.execute(text("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"))
            yield session

    original_scalar = AsyncSession.scalar

    async def scalar(session: AsyncSession, statement: Any, *args: Any, **kwargs: Any) -> Any:
        result = await original_scalar(session, statement, *args, **kwargs)
        if sqlstate == "40001" and isinstance(result, models.Trace) and session not in first_writes:
            first_writes.add(session)
            if len(first_writes) == 2:
                both_locked.set()
            await asyncio.wait_for(both_locked.wait(), timeout=10)
        return result

    monkeypatch.setattr(AsyncSession, "scalar", scalar)

    async def insert(
        session: AsyncSession, span: Span, project_name: str
    ) -> SpanInsertionEvent | None:
        try:
            result = await insert_span(session, span, project_name)
        except DBAPIError as error:
            failures.append(get_sqlstate(error))
            raise
        if sqlstate == "40P01" and len(first_writes) < 2 and session not in first_writes:
            first_writes.add(session)
            if len(first_writes) == 2:
                both_locked.set()
            await asyncio.wait_for(both_locked.wait(), timeout=10)
        return result

    monkeypatch.setattr(bulk_inserter, "insert_span", insert)
    writer_db = (
        db if sqlstate == "40P01" else DbSessionFactory(serializable_transaction, "postgresql")
    )
    trace_orders = (
        (("trace-a", "trace-b"), ("trace-b", "trace-a"))
        if sqlstate == "40P01"
        else (("trace-a",), ("trace-a",))
    )
    writers = [
        _inserter(
            writer_db,
            *[
                _span(f"child-{index}-{trace_id}", trace_id, f"root-{trace_id}")
                for trace_id in trace_ids
            ],
        )
        for index, trace_ids in enumerate(trace_orders)
    ]
    tasks = [asyncio.create_task(writer._insert_spans(2)) for writer in writers]
    try:
        await asyncio.wait_for(asyncio.gather(*tasks), timeout=20)
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    assert sum(bool(writer._span_batch) for writer in writers) == 1
    assert sum(writer._span_retry_attempts for writer in writers) == 1
    assert failures == [sqlstate]
    for writer in writers:
        await writer._insert_spans(0)
        assert not writer._span_batch
    async with db() as session:
        num_children = sum(len(trace_ids) for trace_ids in trace_orders)
        assert (
            await session.scalar(select(func.count()).select_from(models.Span)) == 2 + num_children
        )
        assert (
            await session.scalar(select(func.count()).select_from(models.SpanCost)) == num_children
        )
        for saved_root in await session.scalars(
            select(models.Span).where(models.Span.parent_id.is_(None))
        ):
            expected = sum(
                saved_root.span_id.removeprefix("root-") in trace_ids for trace_ids in trace_orders
            )
            assert saved_root.cumulative_error_count == expected
            assert saved_root.cumulative_llm_token_count_prompt == expected * 7
            assert saved_root.cumulative_llm_token_count_completion == expected * 3
