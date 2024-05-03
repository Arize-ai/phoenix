import asyncio
import logging
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
    Tuple,
)

from sqlalchemy.ext.asyncio import AsyncSession

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
        self._last_inserted_at: Optional[datetime] = None
        self._cache_for_dataloaders = cache_for_dataloaders
        self._enable_prometheus = enable_prometheus

    @property
    def last_inserted_at(self) -> Optional[datetime]:
        return self._last_inserted_at

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
            if spans_buffer:
                await self._insert_spans(spans_buffer)
                spans_buffer = None
            if evaluations_buffer:
                await self._insert_evaluations(evaluations_buffer)
                evaluations_buffer = None

    async def _insert_spans(self, spans: List[Tuple[Span, str]]) -> None:
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
                        if (
                            cache := self._cache_for_dataloaders
                        ) is not None and result is not None:
                            cache.invalidate(result)
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_INSERTION_TIME

                    BULK_LOADER_INSERTION_TIME.observe(perf_counter() - start)
            except Exception:
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                    BULK_LOADER_EXCEPTIONS.inc()
                logger.exception("Failed to insert spans")
        self._last_inserted_at = datetime.now(timezone.utc)

    async def _insert_evaluations(self, evaluations: List[pb.Evaluation]) -> None:
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
                        if (
                            cache := self._cache_for_dataloaders
                        ) is not None and result is not None:
                            cache.invalidate(result)
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_INSERTION_TIME

                    BULK_LOADER_INSERTION_TIME.observe(perf_counter() - start)
            except Exception:
                if self._enable_prometheus:
                    from phoenix.server.prometheus import BULK_LOADER_EXCEPTIONS

                    BULK_LOADER_EXCEPTIONS.inc()
                logger.exception("Failed to insert evaluations")
        self._last_inserted_at = datetime.now(timezone.utc)
