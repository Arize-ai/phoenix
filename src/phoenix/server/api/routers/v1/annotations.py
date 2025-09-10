from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import exists, select
from starlette.requests import Request
from starlette.status import HTTP_200_OK, HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation as SpanAnnotationNodeType
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation as TraceAnnotationNodeType
from phoenix.server.api.types.User import User as UserNodeType

from .utils import PaginatedResponseBody, _get_project_by_identifier, add_errors_to_responses

logger = logging.getLogger(__name__)

SPAN_ANNOTATION_NODE_NAME = SpanAnnotationNodeType.__name__
TRACE_ANNOTATION_NODE_NAME = TraceAnnotationNodeType.__name__
MAX_TRACE_IDS = 1_000
USER_NODE_NAME = UserNodeType.__name__
MAX_SPAN_IDS = 1_000
MAX_SESSION_IDS = 1_000

router = APIRouter(tags=["annotations"])


class Annotation(V1RoutesBaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    source: Literal["API", "APP"]
    user_id: Optional[str]


class AnnotationResult(V1RoutesBaseModel):
    label: Optional[str] = Field(default=None, description="The label assigned by the annotation")
    score: Optional[float] = Field(default=None, description="The score assigned by the annotation")
    explanation: Optional[str] = Field(
        default=None, description="Explanation of the annotation result"
    )


class AnnotationData(V1RoutesBaseModel):
    name: str = Field(description="The name of the annotation")
    annotator_kind: Literal["LLM", "CODE", "HUMAN"] = Field(
        description="The kind of annotator used for the annotation"
    )
    result: Optional[AnnotationResult] = Field(
        default=None, description="The result of the annotation"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Metadata for the annotation"
    )
    identifier: str = Field(
        default="",
        description=(
            "The identifier of the annotation. "
            "If provided, the annotation will be updated if it already exists."
        ),
    )


class SpanAnnotationData(AnnotationData):
    span_id: str = Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)")

    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.SpanAnnotation:
        return Precursors.SpanAnnotation(
            datetime.now(timezone.utc),
            self.span_id,
            models.SpanAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
                identifier=self.identifier,
                source="API",
                user_id=user_id,
            ),
        )


class SpanAnnotation(SpanAnnotationData, Annotation):
    pass


class SpanAnnotationsResponseBody(PaginatedResponseBody[SpanAnnotation]):
    pass


class SpanDocumentAnnotationData(AnnotationData):
    span_id: str = Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)")
    document_position: int = Field(
        description="A 0 based index of the document. E.x. the first document during retrieval is 0"
    )

    # Precursor here means a value to add to a queue for processing async
    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.DocumentAnnotation:
        return Precursors.DocumentAnnotation(
            datetime.now(timezone.utc),
            self.span_id,
            self.document_position,
            models.DocumentAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                document_position=self.document_position,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
                identifier=self.identifier,
                source="API",
                user_id=user_id,
            ),
        )


class SpanDocumentAnnotation(SpanDocumentAnnotationData, Annotation):
    pass


class SpanDocumentAnnotationsResponseBody(PaginatedResponseBody[SpanDocumentAnnotation]):
    pass


class TraceAnnotationData(AnnotationData):
    trace_id: str = Field(description="OpenTelemetry Trace ID (hex format w/o 0x prefix)")

    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.TraceAnnotation:
        return Precursors.TraceAnnotation(
            datetime.now(timezone.utc),
            self.trace_id,
            models.TraceAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
                identifier=self.identifier,
                source="API",
                user_id=user_id,
            ),
        )


class TraceAnnotation(TraceAnnotationData, Annotation):
    pass


class TraceAnnotationsResponseBody(PaginatedResponseBody[TraceAnnotation]):
    pass


@router.get(
    "/projects/{project_identifier}/span_annotations",
    operation_id="listSpanAnnotationsBySpanIds",
    summary="Get span annotations for a list of span_ids.",
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
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    span_ids: list[str] = Query(
        ..., min_length=1, description="One or more span id to fetch annotations for"
    ),
    include_annotation_names: Optional[list[str]] = Query(
        default=None,
        description=(
            "Optional list of annotation names to include. If provided, only annotations with "
            "these names will be returned. 'note' annotations are excluded by default unless "
            "explicitly included in this list."
        ),
    ),
    exclude_annotation_names: Optional[list[str]] = Query(
        default=None, description="Optional list of annotation names to exclude from results."
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
        project = await _get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=HTTP_404_NOT_FOUND,
                detail=f"Project with identifier {project_identifier} not found",
            )

        # Build the base query
        where_conditions = [
            models.Project.id == project.id,
            models.Span.span_id.in_(span_ids),
        ]

        # Add annotation name filtering
        if include_annotation_names:
            where_conditions.append(models.SpanAnnotation.name.in_(include_annotation_names))

        if exclude_annotation_names:
            where_conditions.append(models.SpanAnnotation.name.not_in(exclude_annotation_names))

        stmt = (
            select(models.Span.span_id, models.SpanAnnotation)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .join(models.Project, models.Trace.project_rowid == models.Project.id)
            .join(models.SpanAnnotation, models.SpanAnnotation.span_rowid == models.Span.id)
            .where(*where_conditions)
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

        rows: list[tuple[str, models.SpanAnnotation]] = [
            r async for r in (await session.stream(stmt))
        ]

        next_cursor: Optional[str] = None
        if len(rows) == limit + 1:
            *rows, extra = rows
            next_cursor = str(GlobalID(SPAN_ANNOTATION_NODE_NAME, str(extra[1].id)))

        if not rows:
            spans_exist = await session.scalar(
                select(
                    exists().where(
                        models.Span.span_id.in_(span_ids),
                        models.Span.trace_rowid.in_(
                            select(models.Trace.id)
                            .join(models.Project)
                            .where(models.Project.id == project.id)
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
                result=AnnotationResult(
                    label=anno.label,
                    score=anno.score,
                    explanation=anno.explanation,
                ),
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
