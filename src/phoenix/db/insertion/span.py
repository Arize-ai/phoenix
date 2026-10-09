from dataclasses import asdict
from datetime import datetime
from typing import Any, NamedTuple, Optional, TypeVar

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import and_, case, func, literal, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect, random_project_gradient
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.schemas import Span, SpanKind, SpanStatusCode


class SpanInsertionEvent(NamedTuple):
    project_rowid: int
    span_rowid: int
    trace_rowid: int


class ClearProjectSpansEvent(NamedTuple):
    project_rowid: int


_Record = TypeVar("_Record", bound=models.Base)
_TimedRecord = TypeVar("_TimedRecord", models.Trace, models.ProjectSession)


async def _extend_time_range(
    session: AsyncSession,
    record: _TimedRecord,
    start_time: datetime,
    end_time: datetime,
) -> _TimedRecord:
    if record.start_time <= start_time and end_time <= record.end_time:
        return record
    table = type(record)
    result = await session.scalar(
        update(table)
        .where(table.id == record.id)
        .values(
            start_time=case(
                (table.start_time > start_time, literal(start_time, type_=table.start_time.type)),
                else_=table.start_time,
            ),
            end_time=case(
                (table.end_time < end_time, literal(end_time, type_=table.end_time.type)),
                else_=table.end_time,
            ),
        )
        .returning(table)
        .execution_options(populate_existing=True, synchronize_session=False)
    )
    if result is None:
        raise RuntimeError(f"{table.__tablename__} record disappeared during range update")
    return result


async def _get_or_create(
    session: AsyncSession,
    table: type[_Record],
    key: dict[str, Any],
    values: dict[str, Any],
    *,
    skip_initial_lookup: bool = False,
) -> _Record:
    query = select(table).filter_by(**key).execution_options(populate_existing=True)
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    for attempt in range(2):
        if (not skip_initial_lookup or attempt > 0) and (
            record := await session.scalar(query)
        ) is not None:
            return record
        await session.execute(
            insert_on_conflict(
                {**key, **values},
                table=table,
                dialect=dialect,
                unique_by=tuple(key),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        # A separate statement can see a competing insert's committed row on PostgreSQL.
        if (record := await session.scalar(query)) is not None:
            return record
    raise RuntimeError(f"{table.__tablename__} record disappeared during creation: {key}")


# TODO: Preserve spans by replacing NUL with U+FFFD in descriptive values, rejecting
# affected identifiers and JSON keys. Share repaired inputs with costs and direct tracer
# writers without mutating caller-owned attributes or events.
async def insert_span(
    session: AsyncSession,
    span: Span,
    project_name: str,
) -> Optional[SpanInsertionEvent]:
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)

    trace_id = span.context.trace_id
    trace = await session.scalar(select(models.Trace).filter_by(trace_id=trace_id))
    if trace is None:
        project = await _get_or_create(
            session, models.Project, {"name": project_name}, random_project_gradient()
        )
        trace = await _get_or_create(
            session,
            models.Trace,
            {"trace_id": trace_id},
            dict(
                project_rowid=project.id,
                start_time=span.start_time,
                end_time=span.end_time,
            ),
            skip_initial_lookup=True,
        )

    # The existing trace's memberships win, including after a project transfer.
    trace = await _extend_time_range(session, trace, span.start_time, span.end_time)

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
        project_session = await _get_or_create(
            session,
            models.ProjectSession,
            {"session_id": session_id},
            dict(
                project_id=trace.project_rowid,
                start_time=trace.start_time,
                end_time=trace.end_time,
            ),
        )
        # Coalesce is evaluated against the locked row, so a concurrent attachment
        # wins over our earlier read of a sessionless trace.
        attached_trace = await session.scalar(
            update(models.Trace)
            .where(models.Trace.id == trace.id)
            .values(
                project_session_rowid=func.coalesce(
                    models.Trace.project_session_rowid, project_session.id
                )
            )
            .returning(models.Trace)
            .execution_options(populate_existing=True, synchronize_session=False)
        )
        if attached_trace is None:
            raise RuntimeError("Trace record disappeared during session attachment")
        trace = attached_trace
        if trace.project_session_rowid != project_session.id:
            project_session = await session.scalar(
                select(models.ProjectSession).filter_by(id=trace.project_session_rowid)
            )

    if project_session is not None:
        await _extend_time_range(session, project_session, trace.start_time, trace.end_time)

    await session.flush()
    assert trace.id is not None
    assert project_session is None or (
        project_session.id is not None and project_session.id == trace.project_session_rowid
    )

    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
    llm_token_count_prompt: Optional[int] = None
    llm_token_count_completion: Optional[int] = None
    if span.span_kind is SpanKind.LLM:
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
    cumulative_llm_token_count_prompt = llm_token_count_prompt or 0
    cumulative_llm_token_count_completion = llm_token_count_completion or 0
    if accumulation := (
        await session.execute(
            select(
                func.sum(models.Span.cumulative_error_count),
                func.sum(models.Span.cumulative_llm_token_count_prompt),
                func.sum(models.Span.cumulative_llm_token_count_completion),
            ).where(
                models.Span.trace_rowid == trace.id,
                models.Span.parent_id == span.context.span_id,
            )
        )
    ).first():
        cumulative_error_count += accumulation[0] or 0
        cumulative_llm_token_count_prompt += accumulation[1] or 0
        cumulative_llm_token_count_completion += accumulation[2] or 0
    statement = insert_on_conflict(
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
    span_rowid = await session.scalar(statement)
    if span_rowid is None:
        return None
    if span.parent_id is None or not (
        cumulative_error_count
        or cumulative_llm_token_count_prompt
        or cumulative_llm_token_count_completion
    ):
        return SpanInsertionEvent(trace.project_rowid, span_rowid, trace.id)
    # Propagate cumulative values to ancestors. This is usually a no-op, since
    # the parent usually arrives after the child. But in the event that a
    # child arrives after its parent, we need to make sure that all the
    # ancestors' cumulative values are updated.
    ancestors = (
        select(models.Span.id, models.Span.parent_id, models.Span.trace_rowid)
        .where(
            models.Span.trace_rowid == trace.id,
            models.Span.span_id == span.parent_id,
        )
        .cte(recursive=True)
    )
    child = ancestors.alias()
    ancestors = ancestors.union_all(
        select(models.Span.id, models.Span.parent_id, models.Span.trace_rowid).join(
            child,
            and_(
                models.Span.trace_rowid == child.c.trace_rowid,
                models.Span.span_id == child.c.parent_id,
            ),
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
    return SpanInsertionEvent(trace.project_rowid, span_rowid, trace.id)
