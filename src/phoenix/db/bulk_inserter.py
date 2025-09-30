import asyncio
import logging
from asyncio import Queue, as_completed
from collections import deque
from dataclasses import dataclass, field
from functools import singledispatchmethod
from time import perf_counter, time
from typing import Any, AsyncIterator, Awaitable, Callable, Iterable, Optional, cast

from openinference.semconv.trace import SpanAttributes
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.db import models
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.document_annotation import DocumentAnnotationQueueInserter
from phoenix.db.insertion.evaluation import (
    InsertEvaluationError,
    insert_evaluation,
)
from phoenix.db.insertion.helpers import (
    DataManipulation,
    DataManipulationEvent,
    should_calculate_span_cost,
)
from phoenix.db.insertion.session_annotation import SessionAnnotationQueueInserter
from phoenix.db.insertion.span import SpanInsertionEvent, insert_span
from phoenix.db.insertion.span_annotation import SpanAnnotationQueueInserter
from phoenix.db.insertion.trace_annotation import TraceAnnotationQueueInserter
from phoenix.db.insertion.types import Insertables, Precursors
from phoenix.server.daemons.span_cost_calculator import (
    SpanCostCalculator,
)
from phoenix.server.dml_event import DmlEvent, SpanInsertEvent
from phoenix.server.prometheus import (
    BULK_LOADER_EVALUATION_INSERTIONS,
    BULK_LOADER_EXCEPTIONS,
    BULK_LOADER_LAST_ACTIVITY,
    BULK_LOADER_SPAN_EXCEPTIONS,
    BULK_LOADER_SPAN_INSERTION_TIME,
    SPAN_QUEUE_SIZE,
)
from phoenix.server.types import CanPutItem, DbSessionFactory
from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)

ProjectRowId: TypeAlias = int
ProjectName: TypeAlias = str


@dataclass(frozen=True)
class TransactionResult:
    updated_project_rowids: set[ProjectRowId] = field(default_factory=set)


class BulkInserter:
    def __init__(
        self,
        db: DbSessionFactory,
        *,
        event_queue: CanPutItem[DmlEvent],
        span_cost_calculator: SpanCostCalculator,
        initial_batch_of_spans: Iterable[tuple[Span, ProjectName]] = (),
        initial_batch_of_evaluations: Iterable[pb.Evaluation] = (),
        sleep: float = 0.1,
        max_ops_per_transaction: int = 1000,
        max_queue_size: int = 1000,
        max_spans_queue_size: Optional[int] = None,
        retry_delay_sec: float = DEFAULT_RETRY_DELAY_SEC,
        retry_allowance: int = DEFAULT_RETRY_ALLOWANCE,
    ) -> None:
        """
        :param db: A function to initiate a new database session.
        :param initial_batch_of_spans: Initial batch of spans to insert.
        :param sleep: The time to sleep between bulk insertions
        :param max_ops_per_transaction: The maximum number of operations to dequeue from
        the operations queue for each transaction.
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
        self._evaluations: deque[pb.Evaluation] = deque(initial_batch_of_evaluations)
        self._task: Optional[asyncio.Task[None]] = None
        self._event_queue = event_queue
        self._retry_delay_sec = retry_delay_sec
        self._retry_allowance = retry_allowance
        self._queue_inserters = _QueueInserters(db, self._retry_delay_sec, self._retry_allowance)
        self._span_cost_calculator = span_cost_calculator

    @property
    def is_full(self) -> bool:
        return bool(self._max_spans_queue_size and self._max_spans_queue_size <= len(self._spans))

    async def __aenter__(
        self,
    ) -> tuple[
        Callable[[Any], Awaitable[None]],
        Callable[[Span, str], Awaitable[None]],
        Callable[[pb.Evaluation], Awaitable[None]],
        Callable[[DataManipulation], None],
    ]:
        self._running = True
        self._operations = Queue(maxsize=self._max_queue_size)
        self._task = asyncio.create_task(self._bulk_insert())
        return (
            self._enqueue_annotations,
            self._enqueue_span,
            self._enqueue_evaluation,
            self._enqueue_operation,
        )

    async def __aexit__(self, *args: Any) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _enqueue_annotations(self, *items: Any) -> None:
        await self._queue_inserters.enqueue(*items)

    def _enqueue_operation(self, operation: DataManipulation) -> None:
        cast("Queue[DataManipulation]", self._operations).put_nowait(operation)

    async def _enqueue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    async def _enqueue_evaluation(self, evaluation: pb.Evaluation) -> None:
        self._evaluations.append(evaluation)

    async def _process_events(self, events: Iterable[Optional[DataManipulationEvent]]) -> None: ...

    async def _bulk_insert(self) -> None:
        assert isinstance(self._operations, Queue)
        # start first insert immediately if the inserter has not run recently
        while (
            self._running
            or not self._queue_inserters.empty
            or not self._operations.empty()
            or self._spans
            or self._evaluations
        ):
            BULK_LOADER_LAST_ACTIVITY.set(time())
            SPAN_QUEUE_SIZE.set(len(self._spans))
            if (
                self._queue_inserters.empty
                and self._operations.empty()
                and not self._spans
                and not self._evaluations
            ):
                await asyncio.sleep(self._sleep)
                continue
            ops_remaining = self._max_ops_per_transaction
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
            # It's important to grab the buffers at the same time so there's
            # no race condition, since an eval insertion will fail if the span
            # it references doesn't exist. Grabbing the eval buffer later may
            # include an eval whose span is in the queue but missed being
            # included in the span buffer that was grabbed previously.
            num_spans_to_insert = min(self._max_ops_per_transaction, len(self._spans))
            num_evals_to_insert = min(self._max_ops_per_transaction, len(self._evaluations))
            # Spans should be inserted before the evaluations, since an evaluation
            # insertion will fail if the span it references doesn't exist.
            await self._insert_spans(num_spans_to_insert)
            await self._insert_evaluations(num_evals_to_insert)
            async for event in self._queue_inserters.insert():
                self._event_queue.put(event)
            await asyncio.sleep(self._sleep)

    async def _insert_spans(self, num_spans_to_insert: int) -> None:
        if not num_spans_to_insert or not self._spans:
            return
        project_ids = set()
        span_costs: list[models.SpanCost] = []
        try:
            start = perf_counter()
            async with self._db() as session:
                while num_spans_to_insert > 0:
                    num_spans_to_insert -= 1
                    if not self._spans:
                        break
                    span, project_name = self._spans.popleft()
                    result: Optional[SpanInsertionEvent] = None
                    try:
                        async with session.begin_nested():
                            result = await insert_span(session, span, project_name)
                    except Exception:
                        BULK_LOADER_SPAN_EXCEPTIONS.inc()
                        logger.exception(
                            f"Failed to insert span with span_id={span.context.span_id}"
                        )
                    if result is None:
                        continue
                    project_ids.add(result.project_rowid)
                    try:
                        if not should_calculate_span_cost(span.attributes):
                            continue
                        span_cost = self._span_cost_calculator.calculate_cost(
                            span.start_time,
                            span.attributes,
                        )
                    except Exception:
                        logger.exception(
                            f"Failed to calculate span cost for span with "
                            f"span_id={span.context.span_id}"
                        )
                    else:
                        if span_cost is None:
                            continue
                        span_cost.span_rowid = result.span_rowid
                        span_cost.trace_rowid = result.trace_rowid
                        span_costs.append(span_cost)
            BULK_LOADER_SPAN_INSERTION_TIME.observe(perf_counter() - start)
        except Exception:
            BULK_LOADER_SPAN_EXCEPTIONS.inc()
            logger.exception("Failed to insert spans")
        if project_ids:
            self._event_queue.put(SpanInsertEvent(tuple(project_ids)))
        if not span_costs:
            return
        try:
            async with self._db() as session:
                session.add_all(span_costs)
        except Exception:
            logger.exception("Failed to insert span costs")

    async def _insert_evaluations(self, num_evals_to_insert: int) -> None:
        if not num_evals_to_insert or not self._evaluations:
            return
        try:
            async with self._db() as session:
                while num_evals_to_insert > 0:
                    num_evals_to_insert -= 1
                    if not self._evaluations:
                        break
                    evaluation = self._evaluations.popleft()
                    BULK_LOADER_EVALUATION_INSERTIONS.inc()
                    try:
                        async with session.begin_nested():
                            await insert_evaluation(session, evaluation)
                    except InsertEvaluationError as error:
                        BULK_LOADER_EXCEPTIONS.inc()
                        logger.exception(f"Failed to insert evaluation: {str(error)}")
        except Exception:
            BULK_LOADER_EXCEPTIONS.inc()
            logger.exception("Failed to insert evaluations")


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
        for coro in as_completed([q.insert() for q in self._queues if not q.empty]):
            if events := cast(Optional[list[DmlEvent]], await coro):
                for event in events:
                    yield event

    @property
    def empty(self) -> bool:
        return all(q.empty for q in self._queues)

    async def enqueue(self, *items: Any) -> None:
        for item in items:
            await self._enqueue(item)

    @singledispatchmethod
    async def _enqueue(self, item: Any) -> None: ...

    @_enqueue.register(Precursors.SpanAnnotation)
    @_enqueue.register(Insertables.SpanAnnotation)
    async def _(self, item: Precursors.SpanAnnotation) -> None:
        await self._span_annotations.enqueue(item)

    @_enqueue.register(Precursors.TraceAnnotation)
    @_enqueue.register(Insertables.TraceAnnotation)
    async def _(self, item: Precursors.TraceAnnotation) -> None:
        await self._trace_annotations.enqueue(item)

    @_enqueue.register(Precursors.DocumentAnnotation)
    @_enqueue.register(Insertables.DocumentAnnotation)
    async def _(self, item: Precursors.DocumentAnnotation) -> None:
        await self._document_annotations.enqueue(item)

    @_enqueue.register(Precursors.SessionAnnotation)
    @_enqueue.register(Insertables.SessionAnnotation)
    async def _(self, item: Precursors.SessionAnnotation) -> None:
        await self._session_annotations.enqueue(item)


LLM_MODEL_NAME = SpanAttributes.LLM_MODEL_NAME
LLM_PROVIDER = SpanAttributes.LLM_PROVIDER
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION
LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_AUDIO
LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING = (
    SpanAttributes.LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING
)
LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT
LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_AUDIO
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ = SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ
LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE = (
    SpanAttributes.LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_WRITE
)
