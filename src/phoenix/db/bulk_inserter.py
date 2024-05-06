import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from itertools import islice
from time import perf_counter, time
from typing import (
    Any,
    AsyncContextManager,
    Awaitable,
    Callable,
    Iterable,
    List,
    Optional,
    Set,
    Tuple,
)

from cachetools import LRUCache
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.db.insertion.evaluation import (
    EvaluationInsertionResult,
    InsertEvaluationError,
    insert_evaluation,
)
from phoenix.db.insertion.span import SpanInsertionResult, insert_span
from phoenix.server.api.dataloaders import CacheForDataLoaders
from phoenix.trace.schemas import Span

logger = logging.getLogger(__name__)

ProjectRowId: TypeAlias = int


@dataclass(frozen=True)
class TransactionResult:
    updated_project_rowids: Set[ProjectRowId] = field(default_factory=set)


class BulkInserter:
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        *,
        cache_for_dataloaders: Optional[CacheForDataLoaders] = None,
        initial_batch_of_spans: Optional[Iterable[Tuple[Span, str]]] = None,
        initial_batch_of_evaluations: Optional[Iterable[pb.Evaluation]] = None,
        run_interval_in_seconds: float = 2,
        max_num_per_transaction: int = 1000,
        enable_prometheus: bool = False,
    ) -> None:
        """
        :param db: A function to initiate a new database session.
        :param initial_batch_of_spans: Initial batch of spans to insert.
        :param run_interval_in_seconds: The time interval between the starts of each
        bulk insert. If there's nothing to insert, the inserter goes back to sleep.
        :param max_num_per_transaction: The maximum number of items to insert in a single
        transaction. Multiple transactions will be used if there are more items in the batch.
        """
        self._db = db
        self._running = False
        self._run_interval_seconds = run_interval_in_seconds
        self._max_num_per_transaction = max_num_per_transaction
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

    def last_updated_at(self, project_rowid: Optional[ProjectRowId] = None) -> Optional[datetime]:
        if isinstance(project_rowid, ProjectRowId):
            return self._last_updated_at_by_project.get(project_rowid)
        return max(self._last_updated_at_by_project.values(), default=None)

    async def __aenter__(
        self,
    ) -> Tuple[Callable[[Span, str], Awaitable[None]], Callable[[pb.Evaluation], Awaitable[None]]]:
        self._running = True
        self._task = asyncio.create_task(self._bulk_insert())
        return self._queue_span, self._queue_evaluation

    async def __aexit__(self, *args: Any) -> None:
        self._running = False

    async def _queue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    async def _queue_evaluation(self, evaluation: pb.Evaluation) -> None:
        self._evaluations.append(evaluation)

    async def _bulk_insert(self) -> None:
        spans_buffer, evaluations_buffer = None, None
        next_run_at = time() + self._run_interval_seconds
        while self._spans or self._evaluations or self._running:
            await asyncio.sleep(next_run_at - time())
            next_run_at = time() + self._run_interval_seconds
            if not (self._spans or self._evaluations):
                continue
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

    async def _insert_spans(self, spans: List[Tuple[Span, str]]) -> TransactionResult:
        transaction_result = TransactionResult()
        for i in range(0, len(spans), self._max_num_per_transaction):
            try:
                start = perf_counter()
                async with self._db() as session:
                    for span, project_name in islice(spans, i, i + self._max_num_per_transaction):
                        if self._enable_prometheus:
                            from phoenix.server.prometheus import BULK_LOADER_SPAN_INSERTIONS

                            BULK_LOADER_SPAN_INSERTIONS.inc()
                        result: Optional[SpanInsertionResult] = None
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
        for i in range(0, len(evaluations), self._max_num_per_transaction):
            try:
                start = perf_counter()
                async with self._db() as session:
                    for evaluation in islice(evaluations, i, i + self._max_num_per_transaction):
                        if self._enable_prometheus:
                            from phoenix.server.prometheus import BULK_LOADER_EVALUATION_INSERTIONS

                            BULK_LOADER_EVALUATION_INSERTIONS.inc()
                        result: Optional[EvaluationInsertionResult] = None
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
