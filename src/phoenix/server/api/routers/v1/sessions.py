from __future__ import annotations

import warnings
from collections import defaultdict
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.routers.v1.utils import (
    PaginatedResponseBody,
    ResponseBody,
    add_errors_to_responses,
    get_project_by_identifier,
)
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser

from .annotations import SessionAnnotationData
from .utils import RequestBody

router = APIRouter(tags=["sessions"])


class InsertedSessionAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted session annotation")


class AnnotateSessionsRequestBody(RequestBody[list[SessionAnnotationData]]):
    pass


class AnnotateSessionsResponseBody(ResponseBody[list[InsertedSessionAnnotation]]):
    pass


class SessionTraceData(V1RoutesBaseModel):
    id: str
    trace_id: str
    start_time: datetime
    end_time: datetime


class SessionData(V1RoutesBaseModel):
    id: str
    session_id: str
    project_id: str
    start_time: datetime
    end_time: datetime
    traces: list[SessionTraceData]


class GetSessionResponseBody(ResponseBody[SessionData]):
    pass


class GetSessionsResponseBody(PaginatedResponseBody[SessionData]):
    pass


async def _get_session_by_identifier(
    session: AsyncSession,
    session_identifier: str,
) -> models.ProjectSession:
    try:
        id_ = from_global_id_with_expected_type(
            GlobalID.from_id(session_identifier),
            ProjectSessionNodeType.__name__,
        )
    except Exception:
        stmt = select(models.ProjectSession).filter_by(session_id=session_identifier)
        project_session = await session.scalar(stmt)
        if project_session is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session with session_id {session_identifier} not found",
            )
    else:
        project_session = await session.get(models.ProjectSession, id_)
        if project_session is None:
            raise HTTPException(
                status_code=404,
                detail=f"Session with ID {session_identifier} not found",
            )
    return project_session


def _to_trace_data(trace: models.Trace) -> SessionTraceData:
    return SessionTraceData(
        id=str(GlobalID(TraceNodeType.__name__, str(trace.id))),
        trace_id=trace.trace_id,
        start_time=trace.start_time,
        end_time=trace.end_time,
    )


def _to_session_data(
    project_session: models.ProjectSession,
    traces: list[models.Trace],
) -> SessionData:
    return SessionData(
        id=str(GlobalID(ProjectSessionNodeType.__name__, str(project_session.id))),
        session_id=project_session.session_id,
        project_id=str(GlobalID(ProjectNodeType.__name__, str(project_session.project_id))),
        start_time=project_session.start_time,
        end_time=project_session.end_time,
        traces=[_to_trace_data(t) for t in traces],
    )


@router.get(
    "/sessions/{session_identifier}",
    operation_id="getSession",
    summary="Get session by ID or session_id",
    responses=add_errors_to_responses([404, 422]),
)
async def get_session(
    request: Request,
    session_identifier: str = Path(
        description="The session identifier: either a GlobalID or user-provided session_id string.",
    ),
) -> GetSessionResponseBody:
    async with request.app.state.db() as db_session:
        project_session = await _get_session_by_identifier(db_session, session_identifier)
        traces_stmt = (
            select(models.Trace)
            .filter_by(project_session_rowid=project_session.id)
            .order_by(models.Trace.start_time.asc())
        )
        traces = list((await db_session.scalars(traces_stmt)).all())
    data = _to_session_data(project_session, traces)
    return GetSessionResponseBody(data=data)


@router.get(
    "/projects/{project_identifier}/sessions",
    operation_id="listProjectSessions",
    summary="List sessions for a project",
    responses=add_errors_to_responses([404, 422]),
)
async def list_project_sessions(
    request: Request,
    project_identifier: str = Path(
        description="The project identifier: either project ID or project name.",
    ),
    cursor: Optional[str] = Query(
        default=None,
        description="Cursor for pagination (session ID)",
    ),
    limit: int = Query(
        default=100,
        description="The max number of sessions to return at a time.",
        gt=0,
    ),
    order: Literal["asc", "desc"] = Query(
        default="asc",
        description="Sort order by ID: 'asc' (ascending) or 'desc' (descending).",
    ),
) -> GetSessionsResponseBody:
    async with request.app.state.db() as db_session:
        project = await get_project_by_identifier(db_session, project_identifier)

        if order == "desc":
            order_clause = models.ProjectSession.id.desc()
        else:
            order_clause = models.ProjectSession.id.asc()

        sessions_stmt = (
            select(models.ProjectSession).filter_by(project_id=project.id).order_by(order_clause)
        )

        if cursor:
            try:
                cursor_id = GlobalID.from_id(cursor).node_id
                if order == "desc":
                    sessions_stmt = sessions_stmt.filter(models.ProjectSession.id <= int(cursor_id))
                else:
                    sessions_stmt = sessions_stmt.filter(models.ProjectSession.id >= int(cursor_id))
            except ValueError:
                raise HTTPException(
                    detail=f"Invalid cursor format: {cursor}",
                    status_code=422,
                )

        sessions_stmt = sessions_stmt.limit(limit + 1)
        sessions = list((await db_session.scalars(sessions_stmt)).all())

        if not sessions:
            return GetSessionsResponseBody(next_cursor=None, data=[])

        next_cursor = None
        if len(sessions) == limit + 1:
            last_session = sessions[-1]
            next_cursor = str(GlobalID(ProjectSessionNodeType.__name__, str(last_session.id)))
            sessions = sessions[:-1]

        session_ids = [s.id for s in sessions]
        traces_stmt = (
            select(models.Trace)
            .filter(models.Trace.project_session_rowid.in_(session_ids))
            .order_by(models.Trace.start_time.asc())
        )
        traces = (await db_session.scalars(traces_stmt)).all()

        traces_by_session: dict[int, list[models.Trace]] = defaultdict(list)
        for trace in traces:
            if trace.project_session_rowid is not None:
                traces_by_session[trace.project_session_rowid].append(trace)

        data = [_to_session_data(s, traces_by_session.get(s.id, [])) for s in sessions]
    return GetSessionsResponseBody(next_cursor=next_cursor, data=data)


@router.post(
    "/session_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateSessions",
    summary="Create session annotations",
    responses=add_errors_to_responses([{"status_code": 404, "description": "Session not found"}]),
    response_description="Session annotations inserted successfully",
    include_in_schema=True,
)
async def annotate_sessions(
    request: Request,
    request_body: AnnotateSessionsRequestBody,
    sync: bool = Query(default=False, description="If true, fulfill request synchronously."),
) -> AnnotateSessionsResponseBody:
    if not request_body.data:
        return AnnotateSessionsResponseBody(data=[])

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    session_annotations = request_body.data
    filtered_session_annotations = list(filter(lambda d: d.name != "note", session_annotations))
    if len(filtered_session_annotations) != len(session_annotations):
        warnings.warn(
            (
                "Session annotations with the name 'note' are not supported in this endpoint. "
                "They will be ignored."
            ),
            UserWarning,
        )
    precursors = [d.as_precursor(user_id=user_id) for d in filtered_session_annotations]
    if not sync:
        await request.state.enqueue_annotations(*precursors)
        return AnnotateSessionsResponseBody(data=[])

    session_ids = {p.session_id for p in precursors}
    async with request.app.state.db() as session:
        existing_sessions = {
            session_id: rowid
            async for session_id, rowid in await session.stream(
                select(models.ProjectSession.session_id, models.ProjectSession.id).filter(
                    models.ProjectSession.session_id.in_(session_ids)
                )
            )
        }

    missing_session_ids = session_ids - set(existing_sessions.keys())
    # We prefer to fail the entire operation if there are missing sessions in sync mode
    if missing_session_ids:
        raise HTTPException(
            detail=f"Sessions with IDs {', '.join(missing_session_ids)} do not exist.",
            status_code=404,
        )

    async with request.app.state.db() as session:
        inserted_ids = []
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_sessions[p.session_id]).row))
            session_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.ProjectSessionAnnotation,
                    unique_by=("name", "project_session_id", "identifier"),
                ).returning(models.ProjectSessionAnnotation.id)
            )
            inserted_ids.append(session_annotation_id)

    return AnnotateSessionsResponseBody(
        data=[InsertedSessionAnnotation(id=str(inserted_id)) for inserted_id in inserted_ids]
    )
