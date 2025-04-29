from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional, Tuple

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import exists, select
from starlette.requests import Request
from starlette.status import HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation as SpanAnnotationNodeType
from phoenix.server.api.types.User import User as UserNodeType

from .models import V1RoutesBaseModel
from .utils import PaginatedResponseBody, add_errors_to_responses

logger = logging.getLogger(__name__)

SPAN_ANNOTATION_NODE_NAME = SpanAnnotationNodeType.__name__
USER_NODE_NAME = UserNodeType.__name__
MAX_SPAN_IDS = 1_000

router = APIRouter(tags=["annotations"])


class SpanAnnotation(V1RoutesBaseModel):
    id: str
    span_id: str
    name: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: dict[str, Any]
    annotator_kind: str
    created_at: datetime
    updated_at: datetime
    identifier: Optional[str]
    source: str
    user_id: Optional[str]


class SpanAnnotationsResponseBody(PaginatedResponseBody[SpanAnnotation]):
    pass


@router.get(
    "/projects/{project_name}/span_annotations",
    operation_id="listSpanAnnotationsBySpanIds",
    summary="Get span annotations for a list of span_ids",
    status_code=HTTP_200_OK,
    responses=add_errors_to_responses(
        [
            {"status_code": HTTP_404_NOT_FOUND, "description": "Project or spans not found"},
            {"status_code": HTTP_422_UNPROCESSABLE_ENTITY, "description": "Invalid parameters"},
        ]
    ),
)
async def list_span_annotations(
    request: Request,
    project_name: str = Path(description="Name of the project"),
    span_ids: list[str] = Query(
        ..., min_length=1, description="One or more span id to fetch annotations for"
    ),
    cursor: Optional[str] = Query(default=None, description="A cursor for pagination"),
    limit: int = Query(
        default=10,
        gt=0,
        le=10000,
        description="The maximum number of annotations to return in a single request",
    ),
) -> SpanAnnotationsResponseBody:
    span_ids = list({*span_ids})
    if len(span_ids) > MAX_SPAN_IDS:
        raise HTTPException(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Too many span_ids supplied: {len(span_ids)} (max {MAX_SPAN_IDS})",
        )

    async with request.app.state.db() as session:
        stmt = (
            select(models.Span.span_id, models.SpanAnnotation)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .join(models.Project, models.Trace.project_rowid == models.Project.id)
            .join(models.SpanAnnotation, models.SpanAnnotation.span_rowid == models.Span.id)
            .where(
                models.Project.name == project_name,
                models.Span.span_id.in_(span_ids),
            )
            .order_by(models.SpanAnnotation.id.desc())
            .limit(limit + 1)
        )

        if cursor:
            try:
                cursor_id = int(GlobalID.from_id(cursor).node_id)
            except ValueError:
                raise HTTPException(
                    status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid cursor value",
                )
            stmt = stmt.where(models.SpanAnnotation.id <= cursor_id)

        rows: list[Tuple[str, models.SpanAnnotation]] = [r async for r in session.stream(stmt)]

        next_cursor: Optional[str] = None
        if len(rows) == limit + 1:
            *rows, extra = rows
            next_cursor = str(GlobalID(SPAN_ANNOTATION_NODE_NAME, str(extra[1].id)))

        if not rows:
            project_exists = await session.scalar(
                select(exists().where(models.Project.name == project_name))
            )
            if not project_exists:
                raise HTTPException(
                    detail=f"Project '{project_name}' not found", status_code=HTTP_404_NOT_FOUND
                )

            spans_exist = await session.scalar(
                select(
                    exists().where(
                        models.Span.span_id.in_(span_ids),
                        models.Span.trace_rowid.in_(
                            select(models.Trace.id)
                            .join(models.Project)
                            .where(models.Project.name == project_name)
                        ),
                    )
                )
            )
            if not spans_exist:
                raise HTTPException(
                    detail="None of the supplied span_ids exist in this project",
                    status_code=HTTP_404_NOT_FOUND,
                )

            return SpanAnnotationsResponseBody(data=[], next_cursor=None)

        data = [
            SpanAnnotation(
                id=str(GlobalID(SPAN_ANNOTATION_NODE_NAME, str(anno.id))),
                span_id=span_id,
                name=anno.name,
                label=anno.label,
                score=anno.score,
                explanation=anno.explanation,
                metadata=anno.metadata_,
                annotator_kind=anno.annotator_kind,
                created_at=anno.created_at,
                updated_at=anno.updated_at,
                identifier=anno.identifier,
                source=anno.source,
                user_id=str(GlobalID(USER_NODE_NAME, str(anno.user_id))) if anno.user_id else None,
            )
            for span_id, anno in rows
        ]

    return SpanAnnotationsResponseBody(data=data, next_cursor=next_cursor)
