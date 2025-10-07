from __future__ import annotations

import warnings
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser

from .annotations import SessionAnnotationData
from .utils import RequestBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["sessions"])


class InsertedSessionAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted session annotation")


class AnnotateSessionsRequestBody(RequestBody[list[SessionAnnotationData]]):
    pass


class AnnotateSessionsResponseBody(ResponseBody[list[InsertedSessionAnnotation]]):
    pass


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
