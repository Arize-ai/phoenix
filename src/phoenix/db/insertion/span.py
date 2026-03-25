from dataclasses import asdict
from datetime import datetime
from typing import NamedTuple, Optional

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import Executable, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.trace.attributes import get_attribute_value
from phoenix.trace.schemas import Span, SpanStatusCode


async def resolve_projects(
    session: AsyncSession,
    project_names: set[str],
) -> dict[str, int]:
    """Return a name -> id mapping for the given project names, inserting missing ones."""
    if not project_names:
        return {}
    dialect = SupportedSQLDialect(session.bind.dialect.name)
    existing = (
        await session.execute(
            select(models.Project.name, models.Project.id).where(
                models.Project.name.in_(project_names)
            )
        )
    ).all()
    result: dict[str, int] = {name: rowid for name, rowid in existing}
    missing = project_names - result.keys()
    if missing:
        await session.execute(
            insert_on_conflict(
                *[{"name": name} for name in missing],
                dialect=dialect,
                table=models.Project,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        await session.flush()
        newly_inserted = (
            await session.execute(
                select(models.Project.name, models.Project.id).where(
                    models.Project.name.in_(missing)
                )
            )
        ).all()
        result.update({name: rowid for name, rowid in newly_inserted})
    return result


async def resolve_sessions(
    session: AsyncSession,
    session_ids: set[str],
) -> dict[str, int]:
    """Return a session_id -> rowid mapping for the given session ids (SELECT only)."""
    if not session_ids:
        return {}
    rows = (
        await session.execute(
            select(models.ProjectSession.session_id, models.ProjectSession.id).where(
                models.ProjectSession.session_id.in_(session_ids)
            )
        )
    ).all()
    return {session_id: rowid for session_id, rowid in rows}


def _upsert_trace(
    dialect: SupportedSQLDialect,
    trace_id: str,
    project_rowid: int,
    start_time: datetime,
    end_time: datetime,
) -> "Executable":
    """
    Return a dialect-aware INSERT ... ON CONFLICT DO UPDATE statement for Trace.

    On conflict (duplicate trace_id), the project_rowid is preserved (users may transfer
    traces between projects), and start_time/end_time are expanded to cover the new span.
    RETURNING id, project_rowid, project_session_rowid.
    """
    values = {
        "trace_id": trace_id,
        "project_rowid": project_rowid,
        "start_time": start_time,
        "end_time": end_time,
    }
    if dialect is SupportedSQLDialect.POSTGRESQL:
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        pg_stmt = pg_insert(models.Trace).values(**values)
        pg_stmt = pg_stmt.on_conflict_do_update(
            constraint="uq_traces_trace_id",
            set_={
                "start_time": func.least(models.Trace.start_time, pg_stmt.excluded.start_time),
                "end_time": func.greatest(models.Trace.end_time, pg_stmt.excluded.end_time),
            },
        )
        return pg_stmt.returning(
            models.Trace.id,
            models.Trace.project_rowid,
            models.Trace.project_session_rowid,
        )
    else:
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        sq_stmt = sqlite_insert(models.Trace).values(**values)
        sq_stmt = sq_stmt.on_conflict_do_update(
            ["trace_id"],
            set_={
                "start_time": func.min(models.Trace.start_time, sq_stmt.excluded.start_time),
                "end_time": func.max(models.Trace.end_time, sq_stmt.excluded.end_time),
            },
        )
        return sq_stmt.returning(
            models.Trace.id,
            models.Trace.project_rowid,
            models.Trace.project_session_rowid,
        )


def _upsert_session(
    dialect: SupportedSQLDialect,
    session_id: str,
    project_id: int,
    start_time: datetime,
    end_time: datetime,
) -> Executable:
    """
    Return a dialect-aware INSERT ... ON CONFLICT DO UPDATE statement for ProjectSession.

    On conflict (duplicate session_id), expand start_time/end_time to cover the new span.
    RETURNING id.
    """
    values = {
        "session_id": session_id,
        "project_id": project_id,
        "start_time": start_time,
        "end_time": end_time,
    }
    if dialect is SupportedSQLDialect.POSTGRESQL:
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        pg_stmt = pg_insert(models.ProjectSession).values(**values)
        pg_stmt = pg_stmt.on_conflict_do_update(
            constraint="uq_project_sessions_session_id",
            set_={
                "start_time": func.least(
                    models.ProjectSession.start_time, pg_stmt.excluded.start_time
                ),
                "end_time": func.greatest(
                    models.ProjectSession.end_time, pg_stmt.excluded.end_time
                ),
            },
        )
        return pg_stmt.returning(models.ProjectSession.id)
    from sqlalchemy.dialects.sqlite import insert as sqlite_insert

    sq_stmt = sqlite_insert(models.ProjectSession).values(**values)
    sq_stmt = sq_stmt.on_conflict_do_update(
        ["session_id"],
        set_={
            "start_time": func.min(models.ProjectSession.start_time, sq_stmt.excluded.start_time),
            "end_time": func.max(models.ProjectSession.end_time, sq_stmt.excluded.end_time),
        },
    )
    return sq_stmt.returning(models.ProjectSession.id)


async def _expand_session_time_range(
    session: AsyncSession,
    dialect: SupportedSQLDialect,
    session_rowid: int,
    start_time: datetime,
    end_time: datetime,
) -> None:
    """Issue a single UPDATE to expand a ProjectSession's time range to cover the given span."""
    await session.execute(
        update(models.ProjectSession)
        .where(models.ProjectSession.id == session_rowid)
        .values(
            start_time=func.least(models.ProjectSession.start_time, start_time)
            if dialect is SupportedSQLDialect.POSTGRESQL
            else func.min(models.ProjectSession.start_time, start_time),
            end_time=func.greatest(models.ProjectSession.end_time, end_time)
            if dialect is SupportedSQLDialect.POSTGRESQL
            else func.max(models.ProjectSession.end_time, end_time),
        )
    )


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
    project_rowid: Optional[int] = None,
    session_cache: Optional[dict[str, int]] = None,
) -> Optional[SpanInsertionEvent]:
    dialect = SupportedSQLDialect(session.bind.dialect.name)

    # Resolve project_rowid: upsert avoids SELECT-then-INSERT race on concurrent ingestion.
    if project_rowid is None:
        await session.execute(
            insert_on_conflict(
                {"name": project_name},
                dialect=dialect,
                table=models.Project,
                unique_by=("name",),
                on_conflict=OnConflict.DO_NOTHING,
            )
        )
        await session.flush()
        _pr = await session.scalar(select(models.Project.id).filter_by(name=project_name))
        assert _pr is not None
        project_rowid = _pr

    # Upsert the trace: expand time range on conflict, preserve project_rowid.
    trace_row = await session.execute(
        _upsert_trace(
            dialect,
            span.context.trace_id,
            project_rowid,
            span.start_time,
            span.end_time,
        )
    )
    trace_id_rowid, actual_project_rowid, project_session_rowid = trace_row.one()
    # The actual project_rowid may differ from the resolved one if the trace already existed
    # and was transferred to a different project.
    assert actual_project_rowid is not None
    project_rowid = actual_project_rowid

    session_id = get_attribute_value(span.attributes, SpanAttributes.SESSION_ID)
    session_id = str(session_id).strip() if session_id is not None else ""
    assert isinstance(session_id, str)

    if project_session_rowid is not None:
        # ProjectSession record already exists for this Trace; expand time range atomically.
        await _expand_session_time_range(
            session, dialect, project_session_rowid, span.start_time, span.end_time
        )
    elif session_id:
        # Resolve from cache first to avoid a round-trip on repeated sessions.
        if session_cache is not None and session_id in session_cache:
            session_rowid = session_cache[session_id]
            # Update times in-place (the session already exists).
            await _expand_session_time_range(
                session, dialect, session_rowid, span.start_time, span.end_time
            )
            await session.execute(
                update(models.Trace)
                .where(models.Trace.id == trace_id_rowid)
                .values(project_session_rowid=session_rowid)
            )
        else:
            # Upsert: insert or expand time range atomically, get back the id.
            session_row = await session.execute(
                _upsert_session(
                    dialect,
                    session_id,
                    project_rowid,
                    span.start_time,
                    span.end_time,
                )
            )
            session_rowid = session_row.scalar_one()
            await session.execute(
                update(models.Trace)
                .where(models.Trace.id == trace_id_rowid)
                .values(project_session_rowid=session_rowid)
            )

    await session.flush()

    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
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
    cumulative_llm_token_count_prompt = llm_token_count_prompt
    cumulative_llm_token_count_completion = llm_token_count_completion
    span_rowid = await session.scalar(
        insert_on_conflict(
            dict(
                span_id=span.context.span_id,
                trace_rowid=trace_id_rowid,
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
    return SpanInsertionEvent(project_rowid, span_rowid, trace_id_rowid)
