import asyncio
import logging
from asyncio import Queue, as_completed, sleep
from collections import deque
from functools import singledispatchmethod
from random import uniform
from time import perf_counter, time
from typing import Any, AsyncIterator, Awaitable, Callable, Iterable, Optional, cast

from sqlalchemy.exc import DBAPIError
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.document_annotation import DocumentAnnotationQueueInserter
from phoenix.db.insertion.helpers import (
    DataManipulation,
    get_sqlstate,
    should_calculate_span_cost,
)
from phoenix.db.insertion.session_annotation import SessionAnnotationQueueInserter
from phoenix.db.insertion.span import SpanInsertionEvent, insert_span
from phoenix.db.insertion.span_annotation import SpanAnnotationQueueInserter
from phoenix.db.insertion.trace_annotation import TraceAnnotationQueueInserter
from phoenix.db.insertion.types import Precursors
from phoenix.server.cost_tracking.span_cost_calculator import (
    SpanCostCalculator,
)
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.prometheus import (
    BULK_LOADER_EXCEPTIONS,
    BULK_LOADER_LAST_ACTIVITY,
    BULK_LOADER_SPAN_EXCEPTIONS,
    BULK_LOADER_SPAN_INSERTION_TIME,
    SPAN_INGESTION_FAILED_SPANS,
    SPAN_INGESTION_LAST_SUCCESS,
    SPAN_INGESTION_UNRESOLVED_SPANS,
    SPAN_QUEUE_SIZE,
)
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)


def _is_retryable_span_error(error: Exception) -> bool:
    # Only these server codes confirm a rollback suitable for replay.
    return isinstance(error, DBAPIError) and get_sqlstate(error) in ("40P01", "40001")


def _span_error_locations(error: BaseException) -> str:
    """Describe traceback locations without messages, source text, or locals."""
    locations: list[str] = []
    seen: set[int] = set()
    current: Optional[BaseException] = error
    while current is not None and id(current) not in seen and len(seen) < 4:
        seen.add(id(current))
        frames: list[str] = []
        traceback = current.__traceback__
        while traceback is not None:
            frame = traceback.tb_frame
            frames.append(
                f"{frame.f_globals.get('__name__', '?')}."
                f"{frame.f_code.co_name}:{traceback.tb_lineno}"
            )
            traceback = traceback.tb_next
        locations.extend(frames[-8:])
        current = current.__cause__ or current.__context__
    return ";".join(locations) or "unavailable"


ProjectName: TypeAlias = str


class BulkInserter:
    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: CanPutItem[DmlEvent],
        span_cost_calculator: SpanCostCalculator,
        initial_batch_of_spans: Iterable[tuple[Span, ProjectName]] = (),
        sleep: float = 0.1,
        max_ops_per_transaction: int = 100,
        max_queue_size: int = 1000,
        max_spans_queue_size: Optional[int] = None,
        retry_delay_sec: float = DEFAULT_RETRY_DELAY_SEC,
        retry_allowance: int = DEFAULT_RETRY_ALLOWANCE,
    ) -> None:
        """
        :param db: A function to initiate a new database session.
        :param initial_batch_of_spans: Initial batch of spans to insert.
        :param sleep: The polling interval when idle or waiting to retry failed writes.
        :param max_ops_per_transaction: The maximum number of spans or queued operations
        to dequeue for each transaction.
        :param max_queue_size: The maximum length of the operations queue.
        """
        self._db = db
        self._running = False
        self._sleep = sleep
        self._max_ops_per_transaction = max_ops_per_transaction
        self._operations: Optional[Queue[DataManipulation]] = None
        self._max_queue_size = max_queue_size
        self._max_spans_queue_size = max_spans_queue_size
        self._spans: deque[tuple[Span, ProjectName]] = deque(initial_batch_of_spans)
        self._span_batch: list[tuple[Span, ProjectName]] = []
        self._span_retry_attempts = 0
        self._span_retry_at = 0.0
        self._task: Optional[asyncio.Task[None]] = None
        self._event_queue = event_queue
        self._retry_delay_sec = retry_delay_sec
        self._retry_allowance = retry_allowance
        self._queue_inserters = _QueueInserters(db, self._retry_delay_sec, self._retry_allowance)
        self._span_cost_calculator = span_cost_calculator

    @property
    def is_full(self) -> bool:
        return bool(
            self._max_spans_queue_size
            and self._max_spans_queue_size <= len(self._spans) + len(self._span_batch)
        )

    async def __aenter__(
        self,
    ) -> tuple[
        Callable[[Any], Awaitable[None]],
        Callable[[Span, str], Awaitable[None]],
        Callable[[DataManipulation], None],
    ]:
        self._running = True
        self._operations = Queue(maxsize=self._max_queue_size)
        self._task = asyncio.create_task(self._bulk_insert())
        return (
            self._enqueue_annotations,
            self._enqueue_span,
            self._enqueue_operation,
        )

    async def __aexit__(self, *args: Any) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if remaining := len(self._spans) + len(self._span_batch):
            logger.warning("Span ingestion stopped with %s spans still pending", remaining)

    async def _enqueue_annotations(self, *items: Any) -> None:
        await self._queue_inserters.enqueue(*items)

    def _enqueue_operation(self, operation: DataManipulation) -> None:
        cast("Queue[DataManipulation]", self._operations).put_nowait(operation)

    async def _enqueue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    async def _bulk_insert(self) -> None:
        assert isinstance(self._operations, Queue)
        # start first insert immediately if the inserter has not run recently
        while (
            self._running
            or not self._queue_inserters.empty
            or not self._operations.empty()
            or self._spans
            or self._span_batch
        ):
            BULK_LOADER_LAST_ACTIVITY.set(time())
            SPAN_QUEUE_SIZE.set(len(self._spans) + len(self._span_batch))
            if (
                self._queue_inserters.empty
                and self._operations.empty()
                and (
                    (not self._spans and not self._span_batch)
                    or (self._span_batch and perf_counter() < self._span_retry_at)
                )
            ):
                await sleep(self._sleep)
                continue
            sleep_delay = 0.0
            ops_remaining = self._max_ops_per_transaction
            if not self._operations.empty():
                try:
                    async with self._db() as session:
                        while ops_remaining and not self._operations.empty():
                            ops_remaining -= 1
                            op = await self._operations.get()
                            try:
                                async with session.begin_nested():
                                    await op(session)
                            except Exception as e:
                                BULK_LOADER_EXCEPTIONS.inc()
                                logger.exception(str(e))
                except Exception:
                    BULK_LOADER_EXCEPTIONS.inc()
                    logger.exception("Failed to insert queued operations")
                    sleep_delay = self._sleep
            num_spans_to_insert = min(self._max_ops_per_transaction, len(self._spans))
            await self._insert_spans(num_spans_to_insert)
            try:
                async for event in self._queue_inserters.insert():
                    self._event_queue.put(event)
            except Exception:
                BULK_LOADER_EXCEPTIONS.inc()
                logger.exception("Failed to insert queued annotations")
                sleep_delay = self._sleep
            await sleep(sleep_delay)

    async def _insert_spans(self, num_spans_to_insert: int) -> None:
        if perf_counter() < self._span_retry_at:
            return
        if not self._span_batch:
            self._span_batch = [
                self._spans.popleft() for _ in range(min(num_spans_to_insert, len(self._spans)))
            ]
        if not self._span_batch:
            return
        project_ids = set()
        inserted_spans: list[tuple[Span, SpanInsertionEvent]] = []
        failed_spans = 0
        commit_may_have_started = False
        phase = "connect"
        try:
            start = perf_counter()
            async with self._db() as session:
                # Checkout failures precede all span writes and are safe to retry.
                await session.connection()
                for span, project_name in self._span_batch:
                    result: Optional[SpanInsertionEvent] = None
                    phase = "begin_savepoint"
                    savepoint = await session.begin_nested()
                    try:
                        phase = "insert_span"
                        result = await insert_span(session, span, project_name)
                    except Exception as error:
                        if _is_retryable_span_error(error) or (
                            isinstance(error, DBAPIError) and error.connection_invalidated
                        ):
                            raise
                        # Cleanup failures escape to the outer transaction handler. Never
                        # continue on a connection whose savepoint rollback failed.
                        phase = "rollback_savepoint"
                        await savepoint.rollback()
                        if not session.is_active:
                            raise
                        BULK_LOADER_SPAN_EXCEPTIONS.inc()
                        failed_spans += 1
                        logger.error(
                            "Span insertion failed after savepoint rollback: span_id=%s "
                            "reason=span_error error_type=%s sqlstate=%s "
                            "phase=insert_span locations=%s",
                            span.context.span_id,
                            type(error).__name__,
                            get_sqlstate(error) if isinstance(error, DBAPIError) else None,
                            _span_error_locations(error),
                        )
                    else:
                        phase = "release_savepoint"
                        await savepoint.commit()
                    if result is None:
                        continue
                    project_ids.add(result.project_rowid)
                    inserted_spans.append((span, result))
                # Errors while exiting the context may have occurred after COMMIT was
                # sent. Only a database-confirmed rollback is safe to replay then.
                commit_may_have_started = True
                phase = "commit"
            BULK_LOADER_SPAN_INSERTION_TIME.observe(perf_counter() - start)
        except Exception as error:
            BULK_LOADER_SPAN_EXCEPTIONS.inc()
            retryable = _is_retryable_span_error(error) or (
                not commit_may_have_started
                and (
                    phase == "connect"
                    or (isinstance(error, DBAPIError) and error.connection_invalidated)
                )
            )
            sqlstate = get_sqlstate(error) if isinstance(error, DBAPIError) else None
            if retryable and self._span_retry_attempts < self._retry_allowance:
                self._span_retry_attempts += 1
                delay = max(0.0, self._retry_delay_sec) * uniform(0.5, 1.5)
                self._span_retry_at = perf_counter() + delay
                logger.warning(
                    "Span transaction failed before commit or confirmed rollback; retaining "
                    "%s spans for retry %s in %.2fs: error_type=%s sqlstate=%s "
                    "phase=%s locations=%s",
                    len(self._span_batch),
                    self._span_retry_attempts,
                    delay,
                    type(error).__name__,
                    sqlstate,
                    phase,
                    _span_error_locations(error),
                )
            else:
                if commit_may_have_started and not retryable:
                    outcome = "unresolved_commit"
                    SPAN_INGESTION_UNRESOLVED_SPANS.inc(len(self._span_batch))
                else:
                    outcome = "retry_exhausted" if retryable else "transaction_error"
                    SPAN_INGESTION_FAILED_SPANS.labels(reason=outcome).inc(len(self._span_batch))
                logger.error(
                    "Releasing %s spans without replay: outcome=%s error_type=%s sqlstate=%s "
                    "phase=%s locations=%s. "
                    "Later batches can proceed; these accepted spans may be missing, or an "
                    "unresolved commit may have saved them without costs or notifications.",
                    len(self._span_batch),
                    outcome,
                    type(error).__name__,
                    sqlstate,
                    phase,
                    _span_error_locations(error),
                )
                self._span_batch.clear()
                self._span_retry_attempts = 0
                self._span_retry_at = 0.0
            return
        self._span_batch.clear()
        self._span_retry_attempts = 0
        self._span_retry_at = 0.0
        if failed_spans:
            SPAN_INGESTION_FAILED_SPANS.labels(reason="span_error").inc(failed_spans)
        if inserted_spans:
            SPAN_INGESTION_LAST_SUCCESS.set(time())
        if project_ids:
            self._event_queue.put(SpanInsertEvent(tuple(project_ids)))
        span_costs: list[models.SpanCost] = []
        for span, result in inserted_spans:
            try:
                if not should_calculate_span_cost(span.attributes):
                    continue
                span_cost = self._span_cost_calculator.calculate_cost(
                    span.start_time,
                    span.attributes,
                )
            except Exception:
                logger.exception(
                    f"Failed to calculate span cost for span with span_id={span.context.span_id}"
                )
            else:
                if span_cost is None:
                    continue
                span_cost.span_rowid = result.span_rowid
                span_cost.trace_rowid = result.trace_rowid
                span_costs.append(span_cost)
        if not span_costs:
            return
        try:
            async with self._db() as session:
                session.add_all(span_costs)
        except Exception:
            logger.exception("Failed to insert span costs")


class _QueueInserters:
    def __init__(
        self,
        db: DbSessionFactory,
        retry_delay_sec: float = DEFAULT_RETRY_DELAY_SEC,
        retry_allowance: int = DEFAULT_RETRY_ALLOWANCE,
    ) -> None:
        self._db = db
        args = (db, retry_delay_sec, retry_allowance)
        self._span_annotations = SpanAnnotationQueueInserter(*args)
        self._trace_annotations = TraceAnnotationQueueInserter(*args)
        self._document_annotations = DocumentAnnotationQueueInserter(*args)
        self._session_annotations = SessionAnnotationQueueInserter(*args)
        self._queues = (
            self._span_annotations,
            self._trace_annotations,
            self._document_annotations,
            self._session_annotations,
        )

    async def insert(self) -> AsyncIterator[DmlEvent]:
        if self.empty:
            return
        tasks = [asyncio.create_task(queue.insert()) for queue in self._queues if not queue.empty]
        try:
            for coro in as_completed(tasks):
                try:
                    events = cast(Optional[list[DmlEvent]], await coro)
                except Exception:
                    BULK_LOADER_EXCEPTIONS.inc()
                    logger.exception("Failed to insert queued annotations")
                    continue
                if events:
                    for event in events:
                        yield event
        finally:
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    @property
    def empty(self) -> bool:
        return all(q.empty for q in self._queues)

    async def enqueue(self, *items: Any) -> None:
        for item in items:
            await self._enqueue(item)

    @singledispatchmethod
    async def _enqueue(self, item: Any) -> None: ...

    @_enqueue.register(Precursors.SpanAnnotation)
    async def _(self, item: Precursors.SpanAnnotation) -> None:
        await self._span_annotations.enqueue(item)

    @_enqueue.register(Precursors.TraceAnnotation)
    async def _(self, item: Precursors.TraceAnnotation) -> None:
        await self._trace_annotations.enqueue(item)

    @_enqueue.register(Precursors.DocumentAnnotation)
    async def _(self, item: Precursors.DocumentAnnotation) -> None:
        await self._document_annotations.enqueue(item)

    @_enqueue.register(Precursors.SessionAnnotation)
    async def _(self, item: Precursors.SessionAnnotation) -> None:
        await self._session_annotations.enqueue(item)
