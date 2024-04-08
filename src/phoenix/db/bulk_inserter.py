import asyncio
import logging
from itertools import islice
from time import time
from typing import Any, AsyncContextManager, Callable, Iterable, List, Optional, Tuple, cast

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.trace.schemas import Span, SpanStatusCode

logger = logging.getLogger(__name__)


class BulkInserter:
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
        initial_batch_of_spans: Optional[Iterable[Tuple[Span, str]]] = None,
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
        self._task: Optional[asyncio.Task[None]] = None

    async def __aenter__(self) -> Callable[[Span, str], None]:
        self._running = True
        self._task = asyncio.create_task(self._bulk_insert())
        return self._queue_span

    async def __aexit__(self, *args: Any) -> None:
        self._running = False

    def _queue_span(self, span: Span, project_name: str) -> None:
        self._spans.append((span, project_name))

    async def _bulk_insert(self) -> None:
        next_run_at = time() + self._run_interval_seconds
        while self._spans or self._running:
            await asyncio.sleep(next_run_at - time())
            next_run_at = time() + self._run_interval_seconds
            if self._spans:
                await self._insert_spans()

    async def _insert_spans(self) -> None:
        spans = self._spans
        self._spans = []
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
            trace.start_time = min(trace.start_time, span.start_time)
            trace.end_time = max(trace.end_time, span.end_time)
            await session.execute(
                update(models.Trace)
                .where(models.Trace.id == trace_rowid)
                .values(
                    start_time=min(trace.start_time, span.start_time),
                    end_time=max(trace.end_time, span.end_time),
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
        int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 0)
    )
    cumulative_llm_token_count_completion = cast(
        int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, 0)
    )
    if accumulation := (
        await session.execute(
            select(
                func.sum(models.Span.cumulative_error_count),
                func.sum(models.Span.cumulative_llm_token_count_prompt),
                func.sum(models.Span.cumulative_llm_token_count_completion),
            ).where(models.Span.parent_span_id == span.context.span_id)
        )
    ).first():
        cumulative_error_count += cast(int, accumulation[0] or 0)
        cumulative_llm_token_count_prompt += cast(int, accumulation[1] or 0)
        cumulative_llm_token_count_completion += cast(int, accumulation[2] or 0)
    latency_ms = (span.end_time - span.start_time).total_seconds() * 1000
    session.add(
        models.Span(
            span_id=span.context.span_id,
            trace_rowid=trace_rowid,
            parent_span_id=span.parent_id,
            kind=span.span_kind.value,
            name=span.name,
            start_time=span.start_time,
            end_time=span.end_time,
            attributes=span.attributes,
            events=span.events,
            status=span.status_code.value,
            status_message=span.status_message,
            latency_ms=latency_ms,
            cumulative_error_count=cumulative_error_count,
            cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
            cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
        )
    )
    # Propagate cumulative values to ancestors. This is usually a no-op, since
    # the parent usually arrives after the child. But in the event that a
    # child arrives after its parent, we need to make sure the all the
    # ancestors' cumulative values are updated.
    ancestors = (
        select(models.Span.id, models.Span.parent_span_id)
        .where(models.Span.span_id == span.parent_id)
        .cte(recursive=True)
    )
    child = ancestors.alias()
    ancestors = ancestors.union_all(
        select(models.Span.id, models.Span.parent_span_id).join(
            child, models.Span.span_id == child.c.parent_span_id
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
