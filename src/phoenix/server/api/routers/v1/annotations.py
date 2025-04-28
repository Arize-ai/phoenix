from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import and_, select
from starlette.requests import Request
from starlette.status import (
    HTTP_200_OK,
    HTTP_404_NOT_FOUND,
    HTTP_422_UNPROCESSABLE_ENTITY,
)

from phoenix.db import models
from phoenix.server.api.types.node import GlobalID
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation as SpanAnnotationNodeType

from .models import V1RoutesBaseModel
from .utils import (
    PaginatedResponseBody,
    add_errors_to_responses,
)

logger = logging.getLogger(__name__)

SPAN_ANNOTATION_NODE_NAME = SpanAnnotationNodeType.__name__

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
    user_id: Optional[int]


class SpanAnnotationsResponseBody(PaginatedResponseBody[SpanAnnotation]):
    pass


@router.get(
    "/projects/{project_name}/span_annotations",
    operation_id="listAnnotationsBySpanIds",
    summary="Get span & document-level annotations for a list of span_ids",
    status_code=HTTP_200_OK,
    responses=add_errors_to_responses(
        [
            {"status_code": HTTP_404_NOT_FOUND, "description": "Project or spans not found"},
            {"status_code": HTTP_422_UNPROCESSABLE_ENTITY, "description": "Invalid parameters"},
        ]
    ),
)
async def list_annotations(
    request: Request,
    project_name: str = Path(description="Name of the project"),
    span_ids: list[str] = Query(
        ...,  # required
        description="One or more span_id values (repeat the query param to send multiple)",
        min_length=1,
    ),
) -> SpanAnnotationsResponseBody:
    async with request.app.state.db() as session:
        project = await session.scalar(
            select(models.Project).where(models.Project.name == project_name)
        )
        if project is None:
            raise HTTPException(
                detail=f"Project '{project_name}' not found", status_code=HTTP_404_NOT_FOUND
            )

        span_subquery = (
            select(models.Span.id.label("rowid"), models.Span.span_id.label("span_id"))
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(
                and_(
                    models.Trace.project_rowid == project.id,
                    models.Span.span_id.in_(span_ids),
                )
            )
            .subquery()
        )

        span_rows = {row.span_id: row.rowid async for row in await session.stream(span_subquery)}
        if not span_rows:
            raise HTTPException(
                detail="None of the supplied span_ids exist in this project",
                status_code=HTTP_404_NOT_FOUND,
            )

        span_ann_stmt = (
            select(
                span_subquery.c.span_id,
                models.SpanAnnotation,
            )
            .join(
                span_subquery,
                span_subquery.c.rowid == models.SpanAnnotation.span_rowid,
            )
            .order_by(models.SpanAnnotation.created_at.asc())
        )

        span_annos = {}
        async for span_id, anno in await session.stream(span_ann_stmt):
            span_annos.setdefault(span_id, []).append(
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
                    user_id=anno.user_id,
                )
            )

    data: list[SpanAnnotation] = []
    for span_id in span_ids:
        data.append(
            SpanAnnotation(
                span_id=span_id,
                span_annotations=span_annos.get(span_id, []),
            )
        )

    return SpanAnnotationsResponseBody(data=data)
