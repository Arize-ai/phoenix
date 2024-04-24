import asyncio
import logging
from datetime import datetime, timezone
from itertools import islice
from time import time
from typing import (
    Any,
    AsyncContextManager,
    Callable,
    Iterable,
    List,
    Optional,
    Tuple,
    cast,
)

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import assert_never

import phoenix.trace.v1 as pb
from phoenix.db import models
from phoenix.exceptions import PhoenixException
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.schemas import Span, SpanStatusCode

logger = logging.getLogger(__name__)


class InsertEvaluationError(PhoenixException):
    pass


class BulkInserter:
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        *,
        initial_batch_of_spans: Optional[Iterable[Tuple[Span, str]]] = None,
        initial_batch_of_evaluations: Optional[Iterable[pb.Evaluation]] = None,
        run_interval_in_seconds: float = 0.5,
        max_num_per_transaction: int = 100,
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

    @property
    def last_inserted_at(self) -> Optional[datetime]:
        return self._last_inserted_at

    async def __aenter__(
        self,
    ) -> Tuple[Callable[[Span, str], None], Callable[[pb.Evaluation], None]]:
        self._running = True
        self._task = asyncio.create_task(self._bulk_insert())
        return self._queue_span, self._queue_evaluation

    async def __aexit__(self, *args: Any) -> None:
        self._running = False

    def _queue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    def _queue_evaluation(self, evaluation: pb.Evaluation) -> None:
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
                async with self._db() as session:
                    for span, project_name in islice(spans, i, i + self._max_num_per_transaction):
                        try:
                            async with session.begin_nested():
                                await _insert_span(session, span, project_name)
                        except Exception:
                            logger.exception(
                                f"Failed to insert span with span_id={span.context.span_id}"
                            )
            except Exception:
                logger.exception("Failed to insert spans")
        self._last_inserted_at = datetime.now(timezone.utc)

    async def _insert_evaluations(self, evaluations: List[pb.Evaluation]) -> None:
        for i in range(0, len(evaluations), self._max_num_per_transaction):
            try:
                async with self._db() as session:
                    for evaluation in islice(evaluations, i, i + self._max_num_per_transaction):
                        try:
                            async with session.begin_nested():
                                await _insert_evaluation(session, evaluation)
                        except InsertEvaluationError as error:
                            logger.exception(f"Failed to insert evaluation: {str(error)}")
            except Exception:
                logger.exception("Failed to insert evaluations")
        self._last_inserted_at = datetime.now(timezone.utc)


async def _insert_evaluation(session: AsyncSession, evaluation: pb.Evaluation) -> None:
    evaluation_name = evaluation.name
    result = evaluation.result
    label = result.label.value if result.HasField("label") else None
    score = result.score.value if result.HasField("score") else None
    explanation = result.explanation.value if result.HasField("explanation") else None
    if (evaluation_kind := evaluation.subject_id.WhichOneof("kind")) is None:
        raise InsertEvaluationError("Cannot insert an evaluation that has no evaluation kind")
    elif evaluation_kind == "trace_id":
        trace_id = evaluation.subject_id.trace_id
        if not (
            trace_rowid := await session.scalar(
                select(models.Trace.id).where(models.Trace.trace_id == trace_id)
            )
        ):
            raise InsertEvaluationError(
                f"Cannot insert a trace evaluation for a missing trace: {trace_id=}"
            )
        await session.scalar(
            insert(models.TraceAnnotation)
            .values(
                trace_rowid=trace_rowid,
                name=evaluation_name,
                label=label,
                score=score,
                explanation=explanation,
                metadata_={},
                annotator_kind="LLM",
            )
            .returning(models.TraceAnnotation.id)
        )
    elif evaluation_kind == "span_id":
        span_id = evaluation.subject_id.span_id
        if not (
            span_rowid := await session.scalar(
                select(models.Span.id).where(models.Span.span_id == span_id)
            )
        ):
            raise InsertEvaluationError(
                f"Cannot insert a span evaluation for a missing span: {span_id=}"
            )
        await session.scalar(
            insert(models.SpanAnnotation)
            .values(
                span_rowid=span_rowid,
                name=evaluation_name,
                label=label,
                score=score,
                explanation=explanation,
                metadata_={},
                annotator_kind="LLM",
            )
            .returning(models.SpanAnnotation.id)
        )
    elif evaluation_kind == "document_retrieval_id":
        span_id = evaluation.subject_id.document_retrieval_id.span_id
        if not (
            span_rowid := await session.scalar(
                select(models.Span.id).where(models.Span.span_id == span_id)
            )
        ):
            raise InsertEvaluationError(
                f"Cannot insert a document evaluation for a missing span: {span_id=}"
            )
        await session.scalar(
            insert(models.DocumentAnnotation)
            .values(
                span_rowid=span_rowid,
                document_position=evaluation.subject_id.document_retrieval_id.document_position,
                name=evaluation_name,
                label=label,
                score=score,
                explanation=explanation,
                metadata_={},
                annotator_kind="LLM",
            )
            .returning(models.DocumentAnnotation.id)
        )
    else:
        assert_never(evaluation_kind)


async def _insert_span(session: AsyncSession, span: Span, project_name: str) -> None:
    if await session.scalar(select(1).where(models.Span.span_id == span.context.span_id)):
        # Span already exists
        return
    if not (
        project_rowid := await session.scalar(
            select(models.Project.id).where(models.Project.name == project_name)
        )
    ):
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_name).returning(models.Project.id)
        )
    if trace := await session.scalar(
        select(models.Trace).where(models.Trace.trace_id == span.context.trace_id)
    ):
        trace_rowid = trace.id
        # TODO(persistence): Figure out how to reliably retrieve timezone-aware
        # datetime from the (sqlite) database, because all datetime in our
        # programs should be timezone-aware.
        if span.start_time < trace.start_time or trace.end_time < span.end_time:
            trace_start_time = min(trace.start_time, span.start_time)
            trace_end_time = max(trace.end_time, span.end_time)
            await session.execute(
                update(models.Trace)
                .where(models.Trace.id == trace_rowid)
                .values(
                    start_time=trace_start_time,
                    end_time=trace_end_time,
                )
            )
    else:
        trace_rowid = cast(
            int,
            await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_rowid,
                    trace_id=span.context.trace_id,
                    start_time=span.start_time,
                    end_time=span.end_time,
                )
                .returning(models.Trace.id)
            ),
        )
    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
    cumulative_llm_token_count_prompt = cast(
        int, get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT) or 0
    )
    cumulative_llm_token_count_completion = cast(
        int, get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION) or 0
    )
    if accumulation := (
        await session.execute(
            select(
                func.sum(models.Span.cumulative_error_count),
                func.sum(models.Span.cumulative_llm_token_count_prompt),
                func.sum(models.Span.cumulative_llm_token_count_completion),
            ).where(models.Span.parent_id == span.context.span_id)
        )
    ).first():
        cumulative_error_count += cast(int, accumulation[0] or 0)
        cumulative_llm_token_count_prompt += cast(int, accumulation[1] or 0)
        cumulative_llm_token_count_completion += cast(int, accumulation[2] or 0)
    session.add(
        models.Span(
            span_id=span.context.span_id,
            trace_rowid=trace_rowid,
            parent_id=span.parent_id,
            span_kind=span.span_kind.value,
            name=span.name,
            start_time=span.start_time,
            end_time=span.end_time,
            attributes=span.attributes,
            events=span.events,
            status_code=span.status_code.value,
            status_message=span.status_message,
            cumulative_error_count=cumulative_error_count,
            cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
            cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
        )
    )
    # Propagate cumulative values to ancestors. This is usually a no-op, since
    # the parent usually arrives after the child. But in the event that a
    # child arrives after its parent, we need to make sure that all the
    # ancestors' cumulative values are updated.
    ancestors = (
        select(models.Span.id, models.Span.parent_id)
        .where(models.Span.span_id == span.parent_id)
        .cte(recursive=True)
    )
    child = ancestors.alias()
    ancestors = ancestors.union_all(
        select(models.Span.id, models.Span.parent_id).join(
            child, models.Span.span_id == child.c.parent_id
        )
    )
    await session.execute(
        update(models.Span)
        .where(models.Span.id.in_(select(ancestors.c.id)))
        .values(
            cumulative_error_count=models.Span.cumulative_error_count + cumulative_error_count,
            cumulative_llm_token_count_prompt=models.Span.cumulative_llm_token_count_prompt
            + cumulative_llm_token_count_prompt,
            cumulative_llm_token_count_completion=models.Span.cumulative_llm_token_count_completion
            + cumulative_llm_token_count_completion,
        )
    )
