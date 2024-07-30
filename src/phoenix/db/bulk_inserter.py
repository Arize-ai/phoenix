import asyncio
import logging
from asyncio import Queue, as_completed
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import singledispatchmethod
from itertools import islice
from time import perf_counter
from typing import (
    Any,
    Awaitable,
    Callable,
    DefaultDict,
    Dict,
    Iterable,
    List,
    Mapping,
    Optional,
    Set,
    Tuple,
    Type,
    cast,
)

from cachetools import LRUCache
from sqlalchemy import Select, select
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.db import models
from phoenix.db.insertion.constants import DEFAULT_RETRY_ALLOWANCE, DEFAULT_RETRY_DELAY_SEC
from phoenix.db.insertion.document_annotation import DocumentAnnotationQueueInserter
from phoenix.db.insertion.evaluation import (
    EvaluationInsertionEvent,
    InsertEvaluationError,
    insert_evaluation,
)
from phoenix.db.insertion.helpers import DataManipulation, DataManipulationEvent
from phoenix.db.insertion.span import SpanInsertionEvent, insert_span
from phoenix.db.insertion.span_annotation import SpanAnnotationQueueInserter
from phoenix.db.insertion.trace_annotation import TraceAnnotationQueueInserter
from phoenix.db.insertion.types import Insertables, Precursors
from phoenix.server.api.dataloaders import CacheForDataLoaders
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)

ProjectRowId: TypeAlias = int


@dataclass(frozen=True)
class TransactionResult:
    updated_project_rowids: Set[ProjectRowId] = field(default_factory=set)


class BulkInserter:
    def __init__(
        self,
        db: DbSessionFactory,
        *,
        cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
        initial_batch_of_operations: Iterable[DataManipulation] = (),
        initial_batch_of_spans: Optional[Iterable[Tuple[Span, str]]] = None,
        initial_batch_of_evaluations: Optional[Iterable[pb.Evaluation]] = None,
        sleep: float = 0.1,
        max_ops_per_transaction: int = 1000,
        max_queue_size: int = 1000,
        enable_prometheus: bool = False,
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
        :param enable_prometheus: Whether Prometheus is enabled.
        """
        self._db = db
        self._running = False
        self._sleep = sleep
        self._max_ops_per_transaction = max_ops_per_transaction
        self._operations: Optional[Queue[DataManipulation]] = None
        self._max_queue_size = max_queue_size
        self._spans: List[Tuple[Span, str]] = (
            [] if initial_batch_of_spans is None else list(initial_batch_of_spans)
        )
        self._evaluations: List[pb.Evaluation] = (
            [] if initial_batch_of_evaluations is None else list(initial_batch_of_evaluations)
        )
        self._task: Optional[asyncio.Task[None]] = None
        self._last_updated_at_by_project: LRUCache[ProjectRowId, datetime] = LRUCache(maxsize=100)
        self._cache_for_dataloaders = cache_for_dataloaders
        self._enable_prometheus = enable_prometheus
        self._retry_delay_sec = retry_delay_sec
        self._retry_allowance = retry_allowance
        self._queue_inserters = _QueueInserters(db, self._retry_delay_sec, self._retry_allowance)

    def last_updated_at(self, project_rowid: Optional[ProjectRowId] = None) -> Optional[datetime]:
        if isinstance(project_rowid, ProjectRowId):
            return self._last_updated_at_by_project.get(project_rowid)
        return max(self._last_updated_at_by_project.values(), default=None)

    async def __aenter__(
        self,
    ) -> Tuple[
        Callable[[Any], Awaitable[None]],
        Callable[[Span, str], Awaitable[None]],
        Callable[[pb.Evaluation], Awaitable[None]],
        Callable[[DataManipulation], None],
    ]:
        self._running = True
        self._operations = Queue(maxsize=self._max_queue_size)
        self._task = asyncio.create_task(self._bulk_insert())
        return (
            self._enqueue,
            self._queue_span,
            self._queue_evaluation,
            self._enqueue_operation,
        )

    async def __aexit__(self, *args: Any) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _enqueue(self, *items: Any) -> None:
        await self._queue_inserters.enqueue(*items)

    def _enqueue_operation(self, operation: DataManipulation) -> None:
        cast("Queue[DataManipulation]", self._operations).put_nowait(operation)

    async def _queue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    async def _queue_evaluation(self, evaluation: pb.Evaluation) -> None:
        self._evaluations.append(evaluation)

    async def _process_events(self, events: Iterable[Optional[DataManipulationEvent]]) -> None: ...

    async def _bulk_insert(self) -> None:
        assert isinstance(self._operations, Queue)
        spans_buffer, evaluations_buffer = None, None
        # start first insert immediately if the inserter has not run recently
        while (
            self._running
            or not self._queue_inserters.empty
            or not self._operations.empty()
            or self._spans
            or self._evaluations
        ):
            if not self._queue_inserters.empty:
                if inserted_ids := await self._queue_inserters.insert():
                    for project_rowid in await self._get_project_rowids(inserted_ids):
                        self._last_updated_at_by_project[project_rowid] = datetime.now(timezone.utc)
            if self._operations.empty() and not (self._spans or self._evaluations):
                await asyncio.sleep(self._sleep)
                continue
            ops_remaining, events = self._max_ops_per_transaction, []
            async with self._db() as session:
                while ops_remaining and not self._operations.empty():
                    ops_remaining -= 1
                    op = await self._operations.get()
                    try:
                        async with session.begin_nested():
                            events.append(await op(session))
                    except Exception as e:
                        if self._enable_prometheus:
                            from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                            BULK_LOADER_EXCEPTIONS.inc()
                        logger.exception(str(e))
            await self._process_events(events)
            # It's important to grab the buffers at the same time so there's
            # no race condition, since an eval insertion will fail if the span
            # it references doesn't exist. Grabbing the eval buffer later may
            # include an eval whose span is in the queue but missed being
            # included in the span buffer that was grabbed previously.
            if self._spans:
                spans_buffer = self._spans
                self._spans = []
            if self._evaluations:
                evaluations_buffer = self._evaluations
                self._evaluations = []
            # Spans should be inserted before the evaluations, since an evaluation
            # insertion will fail if the span it references doesn't exist.
            transaction_result = TransactionResult()
            if spans_buffer:
                result = await self._insert_spans(spans_buffer)
                transaction_result.updated_project_rowids.update(result.updated_project_rowids)
                spans_buffer = None
            if evaluations_buffer:
                result = await self._insert_evaluations(evaluations_buffer)
                transaction_result.updated_project_rowids.update(result.updated_project_rowids)
                evaluations_buffer = None
            for project_rowid in transaction_result.updated_project_rowids:
                self._last_updated_at_by_project[project_rowid] = datetime.now(timezone.utc)
            await asyncio.sleep(self._sleep)

    async def _insert_spans(self, spans: List[Tuple[Span, str]]) -> TransactionResult:
        transaction_result = TransactionResult()
        for i in range(0, len(spans), self._max_ops_per_transaction):
            try:
                start = perf_counter()
                async with self._db() as session:
                    for span, project_name in islice(spans, i, i + self._max_ops_per_transaction):
                        if self._enable_prometheus:
                            from phoenix.server.prometheus import BULK_LOADER_SPAN_INSERTIONS

                            BULK_LOADER_SPAN_INSERTIONS.inc()
                        result: Optional[SpanInsertionEvent] = None
                        try:
                            async with session.begin_nested():
                                result = await insert_span(session, span, project_name)
                        except Exception:
                            if self._enable_prometheus:
                                from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                                BULK_LOADER_EXCEPTIONS.inc()
                            logger.exception(
                                f"Failed to insert span with span_id={span.context.span_id}"
                            )
                        if result is not None:
                            transaction_result.updated_project_rowids.add(result.project_rowid)
                            if (cache := self._cache_for_dataloaders) is not None:
                                cache.invalidate(result)
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_INSERTION_TIME

                    BULK_LOADER_INSERTION_TIME.observe(perf_counter() - start)
            except Exception:
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                    BULK_LOADER_EXCEPTIONS.inc()
                logger.exception("Failed to insert spans")
        return transaction_result

    async def _insert_evaluations(self, evaluations: List[pb.Evaluation]) -> TransactionResult:
        transaction_result = TransactionResult()
        for i in range(0, len(evaluations), self._max_ops_per_transaction):
            try:
                start = perf_counter()
                async with self._db() as session:
                    for evaluation in islice(evaluations, i, i + self._max_ops_per_transaction):
                        if self._enable_prometheus:
                            from phoenix.server.prometheus import BULK_LOADER_EVALUATION_INSERTIONS

                            BULK_LOADER_EVALUATION_INSERTIONS.inc()
                        result: Optional[EvaluationInsertionEvent] = None
                        try:
                            async with session.begin_nested():
                                result = await insert_evaluation(session, evaluation)
                        except InsertEvaluationError as error:
                            if self._enable_prometheus:
                                from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                                BULK_LOADER_EXCEPTIONS.inc()
                            logger.exception(f"Failed to insert evaluation: {str(error)}")
                        if result is not None:
                            transaction_result.updated_project_rowids.add(result.project_rowid)
                            if (cache := self._cache_for_dataloaders) is not None:
                                cache.invalidate(result)
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_INSERTION_TIME

                    BULK_LOADER_INSERTION_TIME.observe(perf_counter() - start)
            except Exception:
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                    BULK_LOADER_EXCEPTIONS.inc()
                logger.exception("Failed to insert evaluations")
        return transaction_result

    async def _get_project_rowids(
        self,
        inserted_ids: Mapping[Type[models.Base], List[int]],
    ) -> Set[int]:
        ans: Set[int] = set()
        if not inserted_ids:
            return ans
        stmt: Select[Tuple[int]]
        for table, ids in inserted_ids.items():
            if not ids:
                continue
            if issubclass(table, models.SpanAnnotation):
                stmt = (
                    select(models.Project.id)
                    .join(models.Trace)
                    .join_from(models.Trace, models.Span)
                    .join_from(models.Span, models.SpanAnnotation)
                    .where(models.SpanAnnotation.id.in_(ids))
                )
            elif issubclass(table, models.DocumentAnnotation):
                stmt = (
                    select(models.Project.id)
                    .join(models.Trace)
                    .join_from(models.Trace, models.Span)
                    .join_from(models.Span, models.DocumentAnnotation)
                    .where(models.DocumentAnnotation.id.in_(ids))
                )
            elif issubclass(table, models.TraceAnnotation):
                stmt = (
                    select(models.Project.id)
                    .join(models.Trace)
                    .join_from(models.Trace, models.TraceAnnotation)
                    .where(models.TraceAnnotation.id.in_(ids))
                )
            else:
                continue
            async with self._db() as session:
                project_rowids = [_ async for _ in await session.stream_scalars(stmt)]
                ans.update(project_rowids)
        return ans


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
        self._queues = (
            self._span_annotations,
            self._trace_annotations,
            self._document_annotations,
        )

    async def insert(self) -> Dict[Type[models.Base], List[int]]:
        ans: DefaultDict[Type[models.Base], List[int]] = defaultdict(list)
        for coro in as_completed([q.insert() for q in self._queues]):
            table, inserted_ids = await coro
            if inserted_ids:
                ans[table].extend(inserted_ids)
        return ans

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
