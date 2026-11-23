from collections.abc import Mapping, Sequence
from dataclasses import asdict, replace
from datetime import datetime
from typing import Any, NamedTuple, Optional, TypeVar, Union

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import (
    ColumnElement,
    Executable,
    TextClause,
    and_,
    case,
    func,
    literal,
    select,
    text,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import PLAYGROUND_PROJECT_NAME
from phoenix.db import models
from phoenix.db.cleanup_tasks import (
    is_generated_evaluator_trace_project_name,
    is_generated_experiment_project_name,
    live_row_predicate,
)
from phoenix.db.helpers import SupportedSQLDialect, random_project_gradient
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.schemas import Span, SpanEvent, SpanKind, SpanStatusCode


class SpanInsertionEvent(NamedTuple):
    project_rowid: int
    span_rowid: int
    trace_rowid: int
    project_session_rowid: Optional[int]


class ClearProjectSpansEvent(NamedTuple):
    project_rowid: int


# Plain rows rather than ORM instances: these records change through Core statements,
# and a savepoint rollback only expires instances the ORM saw change. A cached instance
# would keep rolled-back values for later spans in the same session.
class _ProjectRow(NamedTuple):
    id: int


class _TraceRow(NamedTuple):
    id: int
    project_rowid: int
    project_session_rowid: Optional[int]
    start_time: datetime
    end_time: datetime


class _ProjectSessionRow(NamedTuple):
    id: int
    project_id: int
    start_time: datetime
    end_time: datetime


_RowT = TypeVar("_RowT", _ProjectRow, _TraceRow, _ProjectSessionRow)
_TimedRowT = TypeVar("_TimedRowT", _TraceRow, _ProjectSessionRow)


def _columns(table: type[models.Base], row_type: type[_RowT]) -> list[Any]:
    return [getattr(table, name) for name in row_type._fields]


async def _fetch_row(
    session: AsyncSession, statement: Executable, row_type: type[_RowT]
) -> Optional[_RowT]:
    row = (await session.execute(statement)).first()
    return None if row is None else row_type(*row)


async def _extend_time_range(
    session: AsyncSession,
    table: Union[type[models.Trace], type[models.ProjectSession]],
    record: _TimedRowT,
    start_time: datetime,
    end_time: datetime,
) -> Optional[_TimedRowT]:
    if record.start_time <= start_time and end_time <= record.end_time:
        return record
    return await _fetch_row(
        session,
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
        .returning(*_columns(table, type(record)))
        .execution_options(synchronize_session=False),
        type(record),
    )


async def _get_or_create(
    session: AsyncSession,
    table: type[models.Base],
    row_type: type[_RowT],
    key: dict[str, Any],
    values: dict[str, Any],
    *,
    skip_initial_lookup: bool = False,
    where: Sequence[ColumnElement[bool]] = (),
    index_where: Optional[Union[ColumnElement[bool], TextClause]] = None,
    lock_for_share: bool = False,
) -> _RowT:
    query = select(*_columns(table, row_type)).filter_by(**key).where(*where)
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    if lock_for_share and dialect is SupportedSQLDialect.POSTGRESQL:
        query = query.with_for_update(read=True, key_share=True)
    for attempt in range(2):
        if (not skip_initial_lookup or attempt > 0) and (
            record := await _fetch_row(session, query, row_type)
        ) is not None:
            return record
        await session.execute(
            insert_on_conflict(
                {**key, **values},
                table=table,
                dialect=dialect,
                unique_by=tuple(key),
                on_conflict=OnConflict.DO_NOTHING,
                index_where=index_where,
            )
        )
        # A separate statement can see a competing insert's committed row on PostgreSQL.
        if (record := await _fetch_row(session, query, row_type)) is not None:
            return record
    raise RuntimeError(f"{table.__tablename__} record disappeared during creation: {key}")


_NUL = "\x00"


def _replace_nul(value: Any) -> Any:
    """
    Replace NUL with U+FFFD in string values, copying only the containers that change.
    Keys are left as they are: merging two keys would change the data, so PostgreSQL
    rejects the span instead.
    """
    if isinstance(value, str):
        return value.replace(_NUL, "\ufffd") if _NUL in value else value
    if isinstance(value, Mapping):
        items = {}
        changed = False
        for key, item in value.items():
            items[key] = repaired = _replace_nul(item)
            changed = changed or repaired is not item
        return items if changed else value
    if isinstance(value, (list, tuple)):
        elements = [_replace_nul(item) for item in value]
        return elements if any(e is not v for e, v in zip(elements, value)) else value
    return value


def _replace_event_nul(event: SpanEvent) -> SpanEvent:
    name = _replace_nul(event.name)
    attributes = _replace_nul(event.attributes)
    if name is event.name and attributes is event.attributes:
        return event
    # Not dataclasses.replace: subclasses such as SpanException have their own __init__.
    return SpanEvent(name=name, timestamp=event.timestamp, attributes=attributes)


def _replace_descriptive_nul(span: Span) -> Span:
    """
    PostgreSQL rejects NUL in text and jsonb values, so descriptive values get U+FFFD
    instead. Identifiers are left as they are, so PostgreSQL still rejects a span whose
    identifiers it would store. The caller's span is not mutated.
    """
    name = _replace_nul(span.name)
    status_message = _replace_nul(span.status_message)
    attributes = _replace_nul(span.attributes)
    events = [_replace_event_nul(event) for event in span.events]
    if (
        name is span.name
        and status_message is span.status_message
        and attributes is span.attributes
        and all(e is v for e, v in zip(events, span.events))
    ):
        return span
    return replace(
        span, name=name, status_message=status_message, attributes=attributes, events=events
    )


async def insert_span(
    session: AsyncSession,
    span: Span,
    project_name: str,
) -> Optional[SpanInsertionEvent]:
    dialect = SupportedSQLDialect(session.get_bind().dialect.name)
    # Read before the repair, since the session id is an identifier.
    session_id = get_attribute_value(span.attributes, SpanAttributes.SESSION_ID)
    if dialect is SupportedSQLDialect.POSTGRESQL:
        span = _replace_descriptive_nul(span)

    trace_id = span.context.trace_id
    existing_trace = (
        await session.execute(
            select(
                models.Trace.id,
                models.Trace.project_rowid,
                models.Trace.project_session_rowid,
                models.Trace.start_time,
                models.Trace.end_time,
                models.Project.deleted_at,
            )
            .join(models.Project, models.Project.id == models.Trace.project_rowid)
            .where(models.Trace.trace_id == trace_id)
        )
    ).first()
    trace: _TraceRow
    if existing_trace is not None:
        if existing_trace.deleted_at is not None:
            return None
        trace = _TraceRow(
            existing_trace.id,
            existing_trace.project_rowid,
            existing_trace.project_session_rowid,
            existing_trace.start_time,
            existing_trace.end_time,
        )
    else:
        project_stmt = select(models.Project.id).where(
            models.Project.name == project_name, models.Project.deleted_at.is_(None)
        )
        if dialect is SupportedSQLDialect.POSTGRESQL:
            project_stmt = project_stmt.with_for_update(read=True, key_share=True)
        project = await _fetch_row(
            session,
            project_stmt,
            _ProjectRow,
        )
        if project is None:
            tombstoned_internal = await session.scalar(
                select(models.Project.id)
                .where(
                    models.Project.name == project_name,
                    models.Project.deleted_at.is_not(None),
                    models.Project.kind.in_(("EXPERIMENT", "EVALUATOR")),
                )
                .limit(1)
            )
            if tombstoned_internal is not None:
                return None
            if is_generated_evaluator_trace_project_name(project_name):
                return None
            if is_generated_experiment_project_name(project_name):
                live_experiment_id = await session.scalar(
                    select(models.Experiment.id)
                    .join(models.Project, models.Project.id == models.Experiment.project_id)
                    .where(
                        models.Experiment.project_name == project_name,
                        models.Project.deleted_at.is_(None),
                    )
                    .limit(1)
                )
                if live_experiment_id is None:
                    return None
            project_kind: models.ProjectKindName = (
                "PLAYGROUND" if project_name == PLAYGROUND_PROJECT_NAME else "STANDARD"
            )
            project = await _get_or_create(
                session,
                models.Project,
                _ProjectRow,
                {"name": project_name},
                {**random_project_gradient(), "kind": project_kind},
                skip_initial_lookup=True,
                where=(models.Project.deleted_at.is_(None),),
                index_where=text(live_row_predicate()),
                lock_for_share=True,
            )
        trace_values: dict[str, Any] = dict(
            project_rowid=project.id,
            start_time=span.start_time,
            end_time=span.end_time,
        )
        trace = await _get_or_create(
            session,
            models.Trace,
            _TraceRow,
            {"trace_id": trace_id},
            trace_values,
            skip_initial_lookup=True,
        )
        if trace.project_rowid != project.id:
            owner_deleted_at = await session.scalar(
                select(models.Project.deleted_at).where(models.Project.id == trace.project_rowid)
            )
            if owner_deleted_at is not None:
                return None

    # The existing trace's memberships win, including after a project transfer.
    extended_trace = await _extend_time_range(
        session, models.Trace, trace, span.start_time, span.end_time
    )
    if extended_trace is None:
        return None
    trace = extended_trace

    session_id = str(session_id).strip() if session_id is not None else ""
    assert isinstance(session_id, str)

    project_session: Optional[_ProjectSessionRow] = None
    if trace.project_session_rowid is not None:
        # ProjectSession record already exists in database for this Trace record, so we fetch
        # it because it may need to be updated. However, the session_id on the span, if exists,
        # will be ignored at this point. Otherwise, if session_id is different, we will need
        # to create a new ProjectSession record, as well as to determine whether the old record
        # needs to be deleted if this is the last Trace associated with it.
        project_session = await _fetch_row(
            session,
            select(*_columns(models.ProjectSession, _ProjectSessionRow)).filter_by(
                id=trace.project_session_rowid
            ),
            _ProjectSessionRow,
        )
    elif session_id:
        project_session = await _get_or_create(
            session,
            models.ProjectSession,
            _ProjectSessionRow,
            {"session_id": session_id},
            dict(
                project_id=trace.project_rowid,
                start_time=trace.start_time,
                end_time=trace.end_time,
            ),
        )
        # Coalesce is evaluated against the locked row, so a concurrent attachment
        # wins over our earlier read of a sessionless trace.
        attached_trace = await _fetch_row(
            session,
            update(models.Trace)
            .where(models.Trace.id == trace.id)
            .values(
                project_session_rowid=func.coalesce(
                    models.Trace.project_session_rowid, project_session.id
                )
            )
            .returning(*_columns(models.Trace, _TraceRow))
            .execution_options(synchronize_session=False),
            _TraceRow,
        )
        if attached_trace is None:
            return None
        trace = attached_trace
        if trace.project_session_rowid != project_session.id:
            project_session = await _fetch_row(
                session,
                select(*_columns(models.ProjectSession, _ProjectSessionRow)).filter_by(
                    id=trace.project_session_rowid
                ),
                _ProjectSessionRow,
            )

    if project_session is not None:
        await _extend_time_range(
            session, models.ProjectSession, project_session, trace.start_time, trace.end_time
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
        return SpanInsertionEvent(
            trace.project_rowid,
            span_rowid,
            trace.id,
            project_session.id if project_session is not None else None,
        )
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
    return SpanInsertionEvent(
        trace.project_rowid,
        span_rowid,
        trace.id,
        project_session.id if project_session is not None else None,
    )
