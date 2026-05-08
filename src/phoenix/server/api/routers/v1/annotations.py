from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import ColumnElement, delete, exists, select
from starlette.requests import Request
from strawberry.relay import GlobalID

from phoenix.datetime_utils import normalize_datetime
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
            "these names will be returned (allowlist). When omitted, the response includes "
            "every matching row regardless of name (no annotation names are excluded by default)."
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
            "these names will be returned (allowlist). When omitted, the response includes "
            "every matching row regardless of name (no annotation names are excluded by default)."
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
            "these names will be returned (allowlist). When omitted, the response includes "
            "every matching row regardless of name (no annotation names are excluded by default)."
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


_DELETE_FILTER_DESCRIPTIONS: dict[str, str] = {
    "name": (
        "Optional annotation name. When provided, must be non-empty and narrows the delete to "
        "annotations of that name."
    ),
    "identifier": (
        "Optional annotation identifier. When provided, must be non-empty and narrows the "
        "delete to annotations with that identifier."
    ),
    "annotator_kind": (
        "Optional annotator kind. When provided, narrows the delete to annotations produced by "
        "this annotator kind."
    ),
    "start_time": (
        "Optional inclusive lower bound on `created_at` (>=). Naive datetimes are interpreted "
        "as UTC."
    ),
    "end_time": (
        "Optional exclusive upper bound on `created_at` (<). Naive datetimes are interpreted "
        "as UTC."
    ),
    "delete_all": (
        "Opt-in flag that authorizes the request without a bounded "
        "`[start_time, end_time)` time window. When `false` (default) or absent, the "
        "request must supply both `start_time` AND `end_time` to bound the delete. "
        "When `true`, the time-range bound is waived and any other filters (`name`, "
        "`identifier`, `annotator_kind`) still narrow the delete within the project — e.g. "
        "`delete_all=true&name=X` deletes all annotations named X regardless of time."
    ),
}

_DELETE_DESCRIPTION_TEMPLATE = """
Hard-delete {kind} annotations within the named project that match the
supplied filter.

- The request must either supply both `start_time` AND `end_time`
  to bound the delete to a `[start_time, end_time)` time window,
  OR set `delete_all=true` to acknowledge an unbounded sweep. A request
  that satisfies neither is rejected with 422.
- `name`, `identifier`, and `annotator_kind` are optional narrowing
  filters; on their own they do NOT authorize the request — they only
  narrow within an already-authorized request (bounded time range or
  `delete_all=true`).
- All supplied filters are combined with AND. `name` and `identifier`,
  when present, must be non-empty.
- `start_time` is inclusive (`>=`); `end_time` is exclusive
  (`<`). When both are supplied, `start_time` must be strictly earlier
  than `end_time` (else 422). A half-bounded range (only one of
  the two) does NOT satisfy the gate and is rejected unless
  `delete_all=true` is also set. Naive datetimes are interpreted as UTC.
- The endpoint is idempotent: a request that matches no rows still
  returns 204.
- When authentication is enabled, non-admin callers can only delete rows
  they own (`user_id == current_user.id`); admins delete all matching
  rows.
"""


def _validate_delete_filters(
    *,
    start_time: Optional[datetime],
    end_time: Optional[datetime],
    delete_all: bool,
) -> tuple[Optional[datetime], Optional[datetime]]:
    """Enforce the delete-bound gate (`(start_time AND end_time) OR
    delete_all=True`) and the `start_time < end_time` invariant.
    Normalize tz-naive datetimes to UTC for SQL comparison. Returns the
    normalized (start_time, end_time) pair.

    The gate subsumes the prior ≥1-filter rule: other filters (`name`,
    `identifier`, `annotator_kind`) only narrow within an already-authorized
    request — they do not unlock the gate, so they are not validator inputs.
    Their non-empty rules are enforced by `Query(min_length=1)` on the
    handler signatures. A half-bounded time range fails the gate unless
    `delete_all=True` is also set.
    """
    fully_bounded = start_time is not None and end_time is not None
    if not delete_all and not fully_bounded:
        raise HTTPException(
            status_code=422,
            detail=(
                "Delete is unbounded. Set delete_all=true to acknowledge, or "
                "supply both start_time and end_time to bound the time range."
            ),
        )
    normalized_start = normalize_datetime(start_time, timezone.utc)
    normalized_end = normalize_datetime(end_time, timezone.utc)
    if (
        normalized_start is not None
        and normalized_end is not None
        and normalized_start >= normalized_end
    ):
        raise HTTPException(
            status_code=422,
            detail="`start_time` must be strictly earlier than `end_time`.",
        )
    return normalized_start, normalized_end


def _build_annotation_filter_predicates(
    annotation_model: Any,
    *,
    name: Optional[str],
    identifier: Optional[str],
    annotator_kind: Optional[str],
    created_after: Optional[datetime],
    created_before: Optional[datetime],
    user_id_for_filter: Optional[int],
) -> list[ColumnElement[bool]]:
    """Build the per-annotation-table predicate list shared across the three
    DELETE handlers. Project-scoping and parent-FK subquery predicates are
    appended by the caller (they differ per kind).
    """
    predicates: list[ColumnElement[bool]] = []
    if name is not None:
        predicates.append(annotation_model.name == name)
    if identifier is not None:
        predicates.append(annotation_model.identifier == identifier)
    if annotator_kind is not None:
        predicates.append(annotation_model.annotator_kind == annotator_kind)
    if created_after is not None:
        predicates.append(annotation_model.created_at >= created_after)
    if created_before is not None:
        predicates.append(annotation_model.created_at < created_before)
    if user_id_for_filter is not None:
        predicates.append(annotation_model.user_id == user_id_for_filter)
    return predicates


@router.delete(
    "/projects/{project_identifier}/span_annotations",
    operation_id="deleteSpanAnnotations",
    summary="Delete span annotations in a project that match the supplied filter.",
    description=_DELETE_DESCRIPTION_TEMPLATE.format(kind="span"),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_span_annotations(
    request: Request,
    project_identifier: Annotated[
        str,
        Path(
            description=(
                "The project identifier: either project ID or project name. If using a project "
                "name as the identifier, it cannot contain slash (/), question mark (?), or "
                "pound sign (#) characters."
            )
        ),
    ],
    name: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["name"]),
    ] = None,
    identifier: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["identifier"]),
    ] = None,
    annotator_kind: Annotated[
        Optional[Literal["LLM", "CODE", "HUMAN"]],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["annotator_kind"]),
    ] = None,
    start_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["start_time"]),
    ] = None,
    end_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["end_time"]),
    ] = None,
    delete_all: Annotated[
        bool,
        Query(description=_DELETE_FILTER_DESCRIPTIONS["delete_all"]),
    ] = False,
) -> None:
    start_time, end_time = _validate_delete_filters(
        start_time=start_time,
        end_time=end_time,
        delete_all=delete_all,
    )
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
        predicate = _build_annotation_filter_predicates(
            models.SpanAnnotation,
            name=name,
            identifier=identifier,
            annotator_kind=annotator_kind,
            created_after=start_time,
            created_before=end_time,
            user_id_for_filter=user_id_for_filter,
        )
        predicate.append(models.SpanAnnotation.span_rowid.in_(span_rowids_in_project))

        stmt = delete(models.SpanAnnotation).where(*predicate).returning(models.SpanAnnotation.id)
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(SpanAnnotationDeleteEvent(tuple(deleted_ids)))


@router.delete(
    "/projects/{project_identifier}/trace_annotations",
    operation_id="deleteTraceAnnotations",
    summary="Delete trace annotations in a project that match the supplied filter.",
    description=_DELETE_DESCRIPTION_TEMPLATE.format(kind="trace"),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_trace_annotations(
    request: Request,
    project_identifier: Annotated[
        str,
        Path(
            description=(
                "The project identifier: either project ID or project name. If using a project "
                "name as the identifier, it cannot contain slash (/), question mark (?), or "
                "pound sign (#) characters."
            )
        ),
    ],
    name: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["name"]),
    ] = None,
    identifier: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["identifier"]),
    ] = None,
    annotator_kind: Annotated[
        Optional[Literal["LLM", "CODE", "HUMAN"]],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["annotator_kind"]),
    ] = None,
    start_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["start_time"]),
    ] = None,
    end_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["end_time"]),
    ] = None,
    delete_all: Annotated[
        bool,
        Query(description=_DELETE_FILTER_DESCRIPTIONS["delete_all"]),
    ] = False,
) -> None:
    start_time, end_time = _validate_delete_filters(
        start_time=start_time,
        end_time=end_time,
        delete_all=delete_all,
    )
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
        predicate = _build_annotation_filter_predicates(
            models.TraceAnnotation,
            name=name,
            identifier=identifier,
            annotator_kind=annotator_kind,
            created_after=start_time,
            created_before=end_time,
            user_id_for_filter=user_id_for_filter,
        )
        predicate.append(models.TraceAnnotation.trace_rowid.in_(trace_rowids_in_project))

        stmt = delete(models.TraceAnnotation).where(*predicate).returning(models.TraceAnnotation.id)
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(TraceAnnotationDeleteEvent(tuple(deleted_ids)))


@router.delete(
    "/projects/{project_identifier}/session_annotations",
    operation_id="deleteSessionAnnotations",
    summary="Delete session annotations in a project that match the supplied filter.",
    description=_DELETE_DESCRIPTION_TEMPLATE.format(kind="session"),
    responses=add_errors_to_responses(
        [
            {"status_code": 404, "description": "Project not found"},
            {"status_code": 422, "description": "Invalid parameters"},
        ]
    ),
    status_code=204,
)
async def delete_session_annotations(
    request: Request,
    project_identifier: Annotated[
        str,
        Path(
            description=(
                "The project identifier: either project ID or project name. If using a project "
                "name as the identifier, it cannot contain slash (/), question mark (?), or "
                "pound sign (#) characters."
            )
        ),
    ],
    name: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["name"]),
    ] = None,
    identifier: Annotated[
        Optional[str],
        Query(min_length=1, description=_DELETE_FILTER_DESCRIPTIONS["identifier"]),
    ] = None,
    annotator_kind: Annotated[
        Optional[Literal["LLM", "CODE", "HUMAN"]],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["annotator_kind"]),
    ] = None,
    start_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["start_time"]),
    ] = None,
    end_time: Annotated[
        Optional[datetime],
        Query(description=_DELETE_FILTER_DESCRIPTIONS["end_time"]),
    ] = None,
    delete_all: Annotated[
        bool,
        Query(description=_DELETE_FILTER_DESCRIPTIONS["delete_all"]),
    ] = False,
) -> None:
    start_time, end_time = _validate_delete_filters(
        start_time=start_time,
        end_time=end_time,
        delete_all=delete_all,
    )
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
        predicate = _build_annotation_filter_predicates(
            models.ProjectSessionAnnotation,
            name=name,
            identifier=identifier,
            annotator_kind=annotator_kind,
            created_after=start_time,
            created_before=end_time,
            user_id_for_filter=user_id_for_filter,
        )
        predicate.append(
            models.ProjectSessionAnnotation.project_session_id.in_(session_rowids_in_project)
        )

        stmt = (
            delete(models.ProjectSessionAnnotation)
            .where(*predicate)
            .returning(models.ProjectSessionAnnotation.id)
        )
        deleted_ids = list((await session.scalars(stmt)).all())

    if deleted_ids:
        request.state.event_queue.put(ProjectSessionAnnotationDeleteEvent(tuple(deleted_ids)))
