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
            select(models.Project.id).filter_by(name=project_name)
        )
    ) is None:
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_name).returning(models.Project.id)
        )
    assert project_rowid is not None

    project_session: Optional[models.ProjectSession] = None
    session_id = get_attribute_value(span.attributes, SpanAttributes.SESSION_ID)
    session_user = get_attribute_value(span.attributes, SpanAttributes.USER_ID)
    if session_id is not None and (not isinstance(session_id, str) or session_id.strip()):
        session_id = str(session_id).strip()
        assert isinstance(session_id, str)
        session_user = str(session_user).strip()
        assert isinstance(session_user, str)
        project_session = await session.scalar(
            select(models.ProjectSession).filter_by(session_id=session_id)
        )
        if project_session:
            if project_session.end_time < span.end_time:
                project_session.end_time = span.end_time
                project_session.project_id = project_rowid
            if span.start_time < project_session.start_time:
                project_session.start_time = span.start_time
            if session_user and project_session.session_user != session_user:
                project_session.session_user = session_user
        else:
            project_session = models.ProjectSession(
                project_id=project_rowid,
                session_id=session_id,
                session_user=session_user if session_user else None,
                start_time=span.start_time,
                end_time=span.end_time,
            )
            session.add(project_session)
        if project_session in session.dirty:
            await session.flush()

    trace_id = span.context.trace_id
    trace = await session.scalar(select(models.Trace).filter_by(trace_id=trace_id))
    if trace:
        if project_session and (
            trace.project_session_rowid is None
            or (
                trace.end_time < span.end_time and trace.project_session_rowid != project_session.id
            )
        ):
            trace.project_session_rowid = project_session.id
        if trace.end_time < span.end_time:
            trace.end_time = span.end_time
            trace.project_rowid = project_rowid
        if span.start_time < trace.start_time:
            trace.start_time = span.start_time
    else:
        trace = models.Trace(
            project_rowid=project_rowid,
            trace_id=span.context.trace_id,
            start_time=span.start_time,
            end_time=span.end_time,
            project_session_rowid=project_session.id if project_session else None,
        )
        session.add(trace)
    if trace in session.dirty:
        await session.flush()

    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
    cumulative_llm_token_count_prompt = cast(
        int, get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT) or 0
    )
    cumulative_llm_token_count_completion = cast(
        int, get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION) or 0
    )
    llm_token_count_prompt = cast(
        Optional[int], get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_PROMPT)
    )
    llm_token_count_completion = cast(
        Optional[int],
        get_attribute_value(span.attributes, SpanAttributes.LLM_TOKEN_COUNT_COMPLETION),
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
    return SpanInsertionEvent(project_rowid)
