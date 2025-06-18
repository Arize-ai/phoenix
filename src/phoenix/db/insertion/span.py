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
    span_rowid: int
    trace_rowid: int


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
            select(models.Project.id).filter_by(name=project_name)
        )
    ) is None:
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_name).returning(models.Project.id)
        )
    assert project_rowid is not None

    trace_id = span.context.trace_id
    trace: models.Trace = await session.scalar(
        select(models.Trace).filter_by(trace_id=trace_id)
    ) or models.Trace(trace_id=trace_id)

    if trace.id is not None:
        # Trace record may need to be updated.
        if trace.end_time < span.end_time:
            trace.end_time = span.end_time
            trace.project_rowid = project_rowid
        if span.start_time < trace.start_time:
            trace.start_time = span.start_time
    else:
        # Trace record needs to be persisted for the first time.
        trace.start_time = span.start_time
        trace.end_time = span.end_time
        trace.project_rowid = project_rowid
        session.add(trace)

    session_id = get_attribute_value(span.attributes, SpanAttributes.SESSION_ID)
    session_id = str(session_id).strip() if session_id is not None else ""
    assert isinstance(session_id, str)

    project_session: Optional[models.ProjectSession] = None
    if trace.project_session_rowid is not None:
        # ProjectSession record already exists in database for this Trace record, so we fetch
        # it because it may need to be updated. However, the session_id on the span, if exists,
        # will be ignored at this point. Otherwise, if session_id is different, we will need
        # to create a new ProjectSession record, as well as to determine whether the old record
        # needs to be deleted if this is the last Trace associated with it.
        project_session = await session.scalar(
            select(models.ProjectSession).filter_by(id=trace.project_session_rowid)
        )
    elif session_id:
        project_session = await session.scalar(
            select(models.ProjectSession).filter_by(session_id=session_id)
        ) or models.ProjectSession(session_id=session_id)

    if project_session is not None:
        if project_session.id is None:
            # ProjectSession record needs to be persisted for the first time.
            project_session.start_time = trace.start_time
            project_session.end_time = trace.end_time
            project_session.project_id = project_rowid
            session.add(project_session)
            await session.flush()
            assert project_session.id is not None
            trace.project_session_rowid = project_session.id
        else:
            # ProjectSession record may need to be updated.
            if trace.project_session_rowid is None:
                trace.project_session_rowid = project_session.id
            if trace.start_time < project_session.start_time:
                project_session.start_time = trace.start_time
            if project_session.end_time < trace.end_time:
                project_session.end_time = trace.end_time

    await session.flush()
    assert trace.id is not None
    assert project_session is None or (
        project_session.id is not None and project_session.id == trace.project_session_rowid
    )

    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
    try:
        cumulative_llm_token_count_prompt = int(
            get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT) or 0
        )
    except BaseException:
        cumulative_llm_token_count_prompt = 0
    try:
        cumulative_llm_token_count_completion = int(
            get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION) or 0
        )
    except BaseException:
        cumulative_llm_token_count_completion = 0
    try:
        llm_token_count_prompt = int(
            get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT) or 0
        )
    except BaseException:
        llm_token_count_prompt = 0
    try:
        llm_token_count_completion = int(
            get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION) or 0
        )
    except BaseException:
        llm_token_count_completion = 0
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
                trace_rowid=trace.id,
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
                llm_token_count_prompt=llm_token_count_prompt,
                llm_token_count_completion=llm_token_count_completion,
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
    return SpanInsertionEvent(project_rowid, span_rowid, trace.id)
