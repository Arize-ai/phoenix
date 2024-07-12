from dataclasses import asdict
from typing import NamedTuple, Optional, cast

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.schemas import Span, SpanStatusCode


class SpanInsertionEvent(NamedTuple):
    project_rowid: int


class ClearProjectSpansEvent(NamedTuple):
    project_rowid: int


async def insert_span(
    session: AsyncSession,
    span: Span,
    project_name: str,
) -> Optional[SpanInsertionEvent]:
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    if (
        project_rowid := await session.scalar(
            select(models.Project.id).where(models.Project.name == project_name)
        )
    ) is None:
        project_rowid = await session.scalar(
            insert(models.Project).values(dict(name=project_name)).returning(models.Project.id)
        )
    assert project_rowid is not None
    if trace := await session.scalar(
        select(models.Trace).where(models.Trace.trace_id == span.context.trace_id)
    ):
        trace_rowid = trace.id
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
    span_rowid = await session.scalar(
        insert_on_conflict(
            dict(
                span_id=span.context.span_id,
                trace_rowid=trace_rowid,
                parent_id=span.parent_id,
                span_kind=span.span_kind.value,
                name=span.name,
                start_time=span.start_time,
                end_time=span.end_time,
                attributes=span.attributes,
                events=[asdict(event) for event in span.events],
                status_code=span.status_code.value,
                status_message=span.status_message,
                cumulative_error_count=cumulative_error_count,
                cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
                cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
            ),
            dialect=dialect,
            table=models.Span,
            unique_by=("span_id",),
            on_conflict=OnConflict.DO_NOTHING,
        ).returning(models.Span.id)
    )
    if span_rowid is None:
        return None
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
    return SpanInsertionEvent(project_rowid)
