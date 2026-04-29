from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import delete, exists, select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.api.routers.v1.models import V1RoutesBaseModel
from phoenix.server.api.types.ProjectSessionAnnotation import (
    ProjectSessionAnnotation as SessionAnnotationNodeType,
)
from phoenix.server.api.types.SpanAnnotation import SpanAnnotation as SpanAnnotationNodeType
from phoenix.server.api.types.TraceAnnotation import TraceAnnotation as TraceAnnotationNodeType
from phoenix.server.api.types.User import User as UserNodeType
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    SpanAnnotationDeleteEvent,
    TraceAnnotationDeleteEvent,
)

from .utils import PaginatedResponseBody, add_errors_to_responses, get_project_by_identifier

logger = logging.getLogger(__name__)

SPAN_ANNOTATION_NODE_NAME = SpanAnnotationNodeType.__name__
TRACE_ANNOTATION_NODE_NAME = TraceAnnotationNodeType.__name__
SESSION_ANNOTATION_NODE_NAME = SessionAnnotationNodeType.__name__
MAX_TRACE_IDS = 1_000
USER_NODE_NAME = UserNodeType.__name__
MAX_SPAN_IDS = 1_000
MAX_SESSION_IDS = 1_000
MAX_ANNOTATION_IDENTIFIERS = 1_000

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


class SessionAnnotationData(AnnotationData):
    session_id: str = Field(description="Session ID")

    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.SessionAnnotation:
        return Precursors.SessionAnnotation(
            datetime.now(timezone.utc),
            self.session_id,
            models.ProjectSessionAnnotation(
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


class SessionAnnotation(SessionAnnotationData, Annotation):
    pass


class SessionAnnotationsResponseBody(PaginatedResponseBody[SessionAnnotation]):
    pass


@router.get(
    "/projects/{project_identifier}/span_annotations",
    operation_id="listSpanAnnotationsBySpanIds",
    summary="Get span annotations filtered by span_ids and/or identifier.",
    description=(
        "Return span annotations for a project, filtered by `span_ids`, `identifier`, "
        "or both. At least one of `span_ids` or `identifier` must be supplied. When "
        "both are supplied, results are the AND-intersection of the two filters."
    ),
    status_code=200,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project or spans not found"},
            {"status_code": 422, "description": "Invalid parameters"},
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
    span_ids: Optional[list[str]] = Query(
        default=None,
        description=(
            "Optional list of span ids to fetch annotations for. If omitted, "
            "`identifier` must be supplied."
        ),
    ),
    identifier: Optional[list[Annotated[str, Field(min_length=1)]]] = Query(
        default=None,
        description=(
            "Optional list of annotation identifiers to filter by. Each value must be "
            "non-empty. If omitted, `span_ids` must be supplied. When combined with "
            "`span_ids`, results are the AND-intersection of both filters."
        ),
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
    span_ids = list({*span_ids}) if span_ids else []
    if len(span_ids) > MAX_SPAN_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many span_ids supplied: {len(span_ids)} (max {MAX_SPAN_IDS})",
        )

    identifier = list({*identifier}) if identifier else []
    if len(identifier) > MAX_ANNOTATION_IDENTIFIERS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Too many identifiers supplied: {len(identifier)} "
                f"(max {MAX_ANNOTATION_IDENTIFIERS})"
            ),
        )

    if not span_ids and not identifier:
        raise HTTPException(
            status_code=422,
            detail="At least one of span_ids or identifier must be supplied",
        )

    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        # Build the base query
        where_conditions = [models.Project.id == project.id]
        if span_ids:
            where_conditions.append(models.Span.span_id.in_(span_ids))
        if identifier:
            where_conditions.append(models.SpanAnnotation.identifier.in_(identifier))

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
                    status_code=422,
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
            if span_ids and not identifier:
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
                        status_code=404,
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


@router.get(
    "/projects/{project_identifier}/trace_annotations",
    operation_id="listTraceAnnotationsByTraceIds",
    summary="Get trace annotations filtered by trace_ids and/or identifier.",
    description=(
        "Return trace annotations for a project, filtered by `trace_ids`, `identifier`, "
        "or both. At least one of `trace_ids` or `identifier` must be supplied. When "
        "both are supplied, results are the AND-intersection of the two filters."
    ),
    status_code=200,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project or traces not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
)
async def list_trace_annotations(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    trace_ids: Optional[list[str]] = Query(
        default=None,
        description=(
            "Optional list of trace ids to fetch annotations for. If omitted, "
            "`identifier` must be supplied."
        ),
    ),
    identifier: Optional[list[Annotated[str, Field(min_length=1)]]] = Query(
        default=None,
        description=(
            "Optional list of annotation identifiers to filter by. Each value must be "
            "non-empty. If omitted, `trace_ids` must be supplied. When combined with "
            "`trace_ids`, results are the AND-intersection of both filters."
        ),
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
) -> TraceAnnotationsResponseBody:
    trace_ids = list({*trace_ids}) if trace_ids else []
    if len(trace_ids) > MAX_TRACE_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many trace_ids supplied: {len(trace_ids)} (max {MAX_TRACE_IDS})",
        )

    identifier = list({*identifier}) if identifier else []
    if len(identifier) > MAX_ANNOTATION_IDENTIFIERS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Too many identifiers supplied: {len(identifier)} "
                f"(max {MAX_ANNOTATION_IDENTIFIERS})"
            ),
        )

    if not trace_ids and not identifier:
        raise HTTPException(
            status_code=422,
            detail="At least one of trace_ids or identifier must be supplied",
        )

    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        # Build the base query
        where_conditions = [models.Project.id == project.id]
        if trace_ids:
            where_conditions.append(models.Trace.trace_id.in_(trace_ids))
        if identifier:
            where_conditions.append(models.TraceAnnotation.identifier.in_(identifier))

        # Add annotation name filtering
        if include_annotation_names:
            where_conditions.append(models.TraceAnnotation.name.in_(include_annotation_names))

        if exclude_annotation_names:
            where_conditions.append(models.TraceAnnotation.name.not_in(exclude_annotation_names))

        stmt = (
            select(models.Trace.trace_id, models.TraceAnnotation)
            .join(models.Project, models.Trace.project_rowid == models.Project.id)
            .join(models.TraceAnnotation, models.TraceAnnotation.trace_rowid == models.Trace.id)
            .where(*where_conditions)
            .order_by(models.TraceAnnotation.id.desc())
            .limit(limit + 1)
        )

        if cursor:
            try:
                cursor_id = int(GlobalID.from_id(cursor).node_id)
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid cursor value",
                )
            stmt = stmt.where(models.TraceAnnotation.id <= cursor_id)

        rows: list[tuple[str, models.TraceAnnotation]] = [
            r async for r in (await session.stream(stmt))
        ]

        next_cursor: Optional[str] = None
        if len(rows) == limit + 1:
            *rows, extra = rows
            next_cursor = str(GlobalID(TRACE_ANNOTATION_NODE_NAME, str(extra[1].id)))

        if not rows:
            if trace_ids and not identifier:
                traces_exist = await session.scalar(
                    select(
                        exists().where(
                            models.Trace.trace_id.in_(trace_ids),
                            models.Trace.project_rowid == project.id,
                        )
                    )
                )
                if not traces_exist:
                    raise HTTPException(
                        detail="None of the supplied trace_ids exist in this project",
                        status_code=404,
                    )

            return TraceAnnotationsResponseBody(data=[], next_cursor=None)

        data = [
            TraceAnnotation(
                id=str(GlobalID(TRACE_ANNOTATION_NODE_NAME, str(anno.id))),
                trace_id=trace_id,
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
                user_id=str(GlobalID("User", str(anno.user_id))) if anno.user_id else None,
            )
            for trace_id, anno in rows
        ]

    return TraceAnnotationsResponseBody(data=data, next_cursor=next_cursor)


@router.get(
    "/projects/{project_identifier}/session_annotations",
    operation_id="listSessionAnnotationsBySessionIds",
    summary="Get session annotations filtered by session_ids and/or identifier.",
    description=(
        "Return session annotations for a project, filtered by `session_ids`, "
        "`identifier`, or both. At least one of `session_ids` or `identifier` must be "
        "supplied. When both are supplied, results are the AND-intersection of the two "
        "filters."
    ),
    status_code=200,
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project or sessions not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
)
async def list_session_annotations(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    session_ids: Optional[list[str]] = Query(
        default=None,
        description=(
            "Optional list of session ids to fetch annotations for. If omitted, "
            "`identifier` must be supplied."
        ),
    ),
    identifier: Optional[list[Annotated[str, Field(min_length=1)]]] = Query(
        default=None,
        description=(
            "Optional list of annotation identifiers to filter by. Each value must be "
            "non-empty. If omitted, `session_ids` must be supplied. When combined with "
            "`session_ids`, results are the AND-intersection of both filters."
        ),
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
) -> SessionAnnotationsResponseBody:
    session_ids = list({*session_ids}) if session_ids else []
    if len(session_ids) > MAX_SESSION_IDS:
        raise HTTPException(
            status_code=422,
            detail=f"Too many session_ids supplied: {len(session_ids)} (max {MAX_SESSION_IDS})",
        )

    identifier = list({*identifier}) if identifier else []
    if len(identifier) > MAX_ANNOTATION_IDENTIFIERS:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Too many identifiers supplied: {len(identifier)} "
                f"(max {MAX_ANNOTATION_IDENTIFIERS})"
            ),
        )

    if not session_ids and not identifier:
        raise HTTPException(
            status_code=422,
            detail="At least one of session_ids or identifier must be supplied",
        )

    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        # Build the base query
        where_conditions = [models.Project.id == project.id]
        if session_ids:
            where_conditions.append(models.ProjectSession.session_id.in_(session_ids))
        if identifier:
            where_conditions.append(models.ProjectSessionAnnotation.identifier.in_(identifier))

        # Add annotation name filtering
        if include_annotation_names:
            where_conditions.append(
                models.ProjectSessionAnnotation.name.in_(include_annotation_names)
            )

        if exclude_annotation_names:
            where_conditions.append(
                models.ProjectSessionAnnotation.name.not_in(exclude_annotation_names)
            )

        stmt = (
            select(models.ProjectSession.session_id, models.ProjectSessionAnnotation)
            .join(models.Project, models.ProjectSession.project_id == models.Project.id)
            .join(
                models.ProjectSessionAnnotation,
                models.ProjectSessionAnnotation.project_session_id == models.ProjectSession.id,
            )
            .where(*where_conditions)
            .order_by(models.ProjectSessionAnnotation.id.desc())
            .limit(limit + 1)
        )

        if cursor:
            try:
                cursor_id = int(GlobalID.from_id(cursor).node_id)
            except ValueError:
                raise HTTPException(
                    status_code=422,
                    detail="Invalid cursor value",
                )
            stmt = stmt.where(models.ProjectSessionAnnotation.id <= cursor_id)

        rows: list[tuple[str, models.ProjectSessionAnnotation]] = [
            r async for r in (await session.stream(stmt))
        ]

        next_cursor: Optional[str] = None
        if len(rows) == limit + 1:
            *rows, extra = rows
            next_cursor = str(GlobalID(SESSION_ANNOTATION_NODE_NAME, str(extra[1].id)))

        if not rows:
            if session_ids and not identifier:
                sessions_exist = await session.scalar(
                    select(
                        exists().where(
                            models.ProjectSession.session_id.in_(session_ids),
                            models.ProjectSession.project_id == project.id,
                        )
                    )
                )
                if not sessions_exist:
                    raise HTTPException(
                        detail="None of the supplied session_ids exist in this project",
                        status_code=404,
                    )

            return SessionAnnotationsResponseBody(data=[], next_cursor=None)

        data = [
            SessionAnnotation(
                id=str(GlobalID(SESSION_ANNOTATION_NODE_NAME, str(anno.id))),
                session_id=session_id,
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
            for session_id, anno in rows
        ]

    return SessionAnnotationsResponseBody(data=data, next_cursor=next_cursor)


def _resolve_non_admin_user_id(request: Request) -> Optional[int]:
    """Return the caller's user_id when auth is enabled and the caller is a
    non-admin PhoenixUser. Returns None when auth is disabled or the caller
    is an admin (admin/no-auth → unconditional delete; non-admin → narrow by
    user_id). System users are admins (PhoenixSystemUser.is_admin == True).
    """
    if not request.app.state.authentication_enabled:
        return None
    user = request.user
    if not isinstance(user, PhoenixUser):
        # is_authenticated dependency would have already rejected this with 401,
        # but guard defensively for typing.
        return None
    if user.is_admin:
        return None
    return int(user.identity)


@router.delete(
    "/projects/{project_identifier}/span_annotations",
    operation_id="deleteSpanAnnotationsByIdentifier",
    summary=(
        "Delete every span annotation in a project that matches the given "
        "(name, identifier) selector."
    ),
    description=(
        """
        Hard-delete all span annotations within the named project whose
        `name` and `identifier` match the supplied query parameters.

        - The `name` and `identifier` query parameters are both required and
          must be non-empty.
        - The endpoint is idempotent: a request that matches no rows still
          returns 204.
        - When authentication is enabled, non-admin callers can only delete
          rows they own (`user_id == current_user.id`); admins delete all
          matching rows.
        """
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_span_annotations_by_identifier(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    name: str = Query(
        ...,
        min_length=1,
        description="The annotation name. Required and non-empty.",
    ),
    identifier: str = Query(
        ...,
        min_length=1,
        description=(
            "The annotation identifier. Required and non-empty. Empty identifiers are rejected to "
            "prevent accidental mass-delete of the default identifier bucket."
        ),
    ),
) -> None:
    user_id_for_filter = _resolve_non_admin_user_id(request)
    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        span_rowids_in_project = (
            select(models.Span.id)
            .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
            .where(models.Trace.project_rowid == project.id)
        )
        predicate = [
            models.SpanAnnotation.name == name,
            models.SpanAnnotation.identifier == identifier,
            models.SpanAnnotation.span_rowid.in_(span_rowids_in_project),
        ]
        if user_id_for_filter is not None:
            predicate.append(models.SpanAnnotation.user_id == user_id_for_filter)

        stmt = delete(models.SpanAnnotation).where(*predicate).returning(models.SpanAnnotation.id)
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(SpanAnnotationDeleteEvent(tuple(deleted_ids)))


@router.delete(
    "/projects/{project_identifier}/trace_annotations",
    operation_id="deleteTraceAnnotationsByIdentifier",
    summary=(
        "Delete every trace annotation in a project that matches the given "
        "(name, identifier) selector."
    ),
    description=(
        """
        Hard-delete all trace annotations within the named project whose
        `name` and `identifier` match the supplied query parameters.

        - The `name` and `identifier` query parameters are both required and
          must be non-empty.
        - The endpoint is idempotent: a request that matches no rows still
          returns 204.
        - When authentication is enabled, non-admin callers can only delete
          rows they own (`user_id == current_user.id`); admins delete all
          matching rows.
        """
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_trace_annotations_by_identifier(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    name: str = Query(
        ...,
        min_length=1,
        description="The annotation name. Required and non-empty.",
    ),
    identifier: str = Query(
        ...,
        min_length=1,
        description=(
            "The annotation identifier. Required and non-empty. Empty identifiers are rejected to "
            "prevent accidental mass-delete of the default identifier bucket."
        ),
    ),
) -> None:
    user_id_for_filter = _resolve_non_admin_user_id(request)
    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        trace_rowids_in_project = select(models.Trace.id).where(
            models.Trace.project_rowid == project.id
        )
        predicate = [
            models.TraceAnnotation.name == name,
            models.TraceAnnotation.identifier == identifier,
            models.TraceAnnotation.trace_rowid.in_(trace_rowids_in_project),
        ]
        if user_id_for_filter is not None:
            predicate.append(models.TraceAnnotation.user_id == user_id_for_filter)

        stmt = delete(models.TraceAnnotation).where(*predicate).returning(models.TraceAnnotation.id)
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(TraceAnnotationDeleteEvent(tuple(deleted_ids)))


@router.delete(
    "/projects/{project_identifier}/session_annotations",
    operation_id="deleteSessionAnnotationsByIdentifier",
    summary=(
        "Delete every session annotation in a project that matches the given "
        "(name, identifier) selector."
    ),
    description=(
        """
        Hard-delete all session annotations within the named project whose
        `name` and `identifier` match the supplied query parameters.

        - The `name` and `identifier` query parameters are both required and
          must be non-empty.
        - The endpoint is idempotent: a request that matches no rows still
          returns 204.
        - When authentication is enabled, non-admin callers can only delete
          rows they own (`user_id == current_user.id`); admins delete all
          matching rows.
        """
    ),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_session_annotations_by_identifier(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name as "
            "the identifier, it cannot contain slash (/), question mark (?), or pound sign (#) "
            "characters."
        )
    ),
    name: str = Query(
        ...,
        min_length=1,
        description="The annotation name. Required and non-empty.",
    ),
    identifier: str = Query(
        ...,
        min_length=1,
        description=(
            "The annotation identifier. Required and non-empty. Empty identifiers are rejected to "
            "prevent accidental mass-delete of the default identifier bucket."
        ),
    ),
) -> None:
    user_id_for_filter = _resolve_non_admin_user_id(request)
    async with request.app.state.db() as session:
        project = await get_project_by_identifier(session, project_identifier)
        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project with identifier {project_identifier} not found",
            )

        session_rowids_in_project = select(models.ProjectSession.id).where(
            models.ProjectSession.project_id == project.id
        )
        predicate = [
            models.ProjectSessionAnnotation.name == name,
            models.ProjectSessionAnnotation.identifier == identifier,
            models.ProjectSessionAnnotation.project_session_id.in_(session_rowids_in_project),
        ]
        if user_id_for_filter is not None:
            predicate.append(models.ProjectSessionAnnotation.user_id == user_id_for_filter)

        stmt = (
            delete(models.ProjectSessionAnnotation)
            .where(*predicate)
            .returning(models.ProjectSessionAnnotation.id)
        )
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(ProjectSessionAnnotationDeleteEvent(tuple(deleted_ids)))
