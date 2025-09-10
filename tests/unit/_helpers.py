from datetime import datetime, timedelta, timezone
from functools import singledispatch
from secrets import token_hex
from typing import Any, Dict, Optional, Type, TypeVar, cast

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Span import Span


@singledispatch
def _gid(_: models.Base) -> str:
    raise NotImplementedError


@_gid.register
def _(obj: models.ProjectSession) -> str:
    return str(GlobalID(ProjectSession.__name__, str(obj.id)))


@_gid.register
def _(obj: models.Span) -> str:
    return str(GlobalID(Span.__name__, str(obj.id)))


async def _node(
    field: str,
    type_name: str,
    id_: int,
    httpx_client: httpx.AsyncClient,
) -> dict[str, Any]:
    query = "query($id:ID!){node(id:$id){... on " + type_name + "{" + field + "}}}"
    gid = str(GlobalID(type_name, str(id_)))
    response = await httpx_client.post(
        "/graphql",
        json={"query": query, "variables": {"id": gid}},
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    key = field.split("{")[0].split("(")[0]
    return cast(dict[str, Any], response_json["data"]["node"][key])


_RecordT = TypeVar("_RecordT", bound=models.Base)


async def _get_record_by_id(
    session: AsyncSession,
    table: Type[_RecordT],
    id_: int,
) -> Optional[_RecordT]:
    return cast(Optional[_RecordT], await session.scalar(select(table).filter_by(id=id_)))


async def _add_project(
    session: AsyncSession,
    name: Optional[str] = None,
) -> models.Project:
    project = models.Project(name=name or token_hex(4))
    session.add(project)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Project, project.id), models.Project)
    return project


async def _add_trace(
    session: AsyncSession,
    project: models.Project,
    project_session: Optional[models.ProjectSession] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
) -> models.Trace:
    start_time = start_time or datetime.now(timezone.utc)
    end_time = end_time or (start_time + timedelta(seconds=10))
    trace = models.Trace(
        trace_id=token_hex(16),
        start_time=start_time,
        end_time=end_time,
        project_rowid=project.id,
        project_session_rowid=None if project_session is None else project_session.id,
    )
    session.add(trace)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Trace, trace.id), models.Trace)
    return trace


async def _add_span(
    session: AsyncSession,
    trace: Optional[models.Trace] = None,
    parent_span: Optional[models.Span] = None,
    attributes: Optional[Dict[str, Any]] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    span_kind: str = "LLM",
    cumulative_error_count: int = 0,
    cumulative_llm_token_count_prompt: int = 0,
    cumulative_llm_token_count_completion: int = 0,
) -> models.Span:
    start_time = start_time or datetime.now(timezone.utc)
    end_time = end_time or (start_time + timedelta(seconds=10))
    if trace is None and parent_span is None:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
    if parent_span is not None:
        trace_rowid = parent_span.trace_rowid
    elif trace is not None:
        trace_rowid = trace.id
    else:
        raise ValueError("Either `trace` or `parent_span` must be provided")
    span = models.Span(
        name=token_hex(4),
        span_id=token_hex(8),
        parent_id=None if parent_span is None else parent_span.span_id,
        span_kind=span_kind,
        start_time=start_time,
        end_time=end_time,
        status_code="OK",
        status_message="test_status_message",
        cumulative_error_count=cumulative_error_count,
        cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
        cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
        attributes=attributes or {},
        trace_rowid=trace_rowid,
    )
    session.add(span)
    await session.flush()
    assert isinstance(await _get_record_by_id(session, models.Span, span.id), models.Span)
    return span


async def _add_project_session(
    session: AsyncSession,
    project: models.Project,
    session_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
) -> models.ProjectSession:
    start_time = start_time or datetime.now(timezone.utc)
    project_session = models.ProjectSession(
        session_id=session_id or token_hex(4),
        project_id=project.id,
        start_time=start_time,
        end_time=start_time,
    )
    session.add(project_session)
    await session.flush()
    assert isinstance(
        await _get_record_by_id(session, models.ProjectSession, project_session.id),
        models.ProjectSession,
    )
    return project_session
