import warnings
from asyncio import get_running_loop
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from secrets import token_urlsafe
from typing import Any, Literal, Optional

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.db.insertion.types import Precursors
from phoenix.server.api.routers.utils import df_to_bytes
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import SpanAnnotationInsertEvent
from phoenix.trace.dsl import SpanQuery as SpanQuery_
from phoenix.utilities.json import encode_df_as_json_string

from .models import V1RoutesBaseModel
from .utils import (
    RequestBody,
    ResponseBody,
    PaginatedResponseBody,
    _get_project_by_identifier,
    add_errors_to_responses,
)

DEFAULT_SPAN_LIMIT = 1000

router = APIRouter(tags=["spans"])


class SpanQuery(V1RoutesBaseModel):
    select: Optional[dict[str, Any]] = None
    filter: Optional[dict[str, Any]] = None
    explode: Optional[dict[str, Any]] = None
    concat: Optional[dict[str, Any]] = None
    rename: Optional[dict[str, Any]] = None
    index: Optional[dict[str, Any]] = None


class QuerySpansRequestBody(V1RoutesBaseModel):
    queries: list[SpanQuery]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = DEFAULT_SPAN_LIMIT
    root_spans_only: Optional[bool] = None
    orphan_span_as_root_span: bool = True
    project_name: Optional[str] = Field(
        default=None,
        description=(
            "The name of the project to query. "
            "This parameter has been deprecated, use the project_name query parameter instead."
        ),
        deprecated=True,
    )
    stop_time: Optional[datetime] = Field(
        default=None,
        description=(
            "An upper bound on the time to query for. "
            "This parameter has been deprecated, use the end_time parameter instead."
        ),
        deprecated=True,
    )


class Span(V1RoutesBaseModel):
    id: str = Field(
        description="The Global Relay-style ID of the span (based on the DB primary key)."
    )
    span_id: str = Field(description="The OpenTelemetry span ID (hex format w/o 0x prefix).")
    trace_id: Optional[str] = Field(
        default=None, description="The OpenTelemetry trace ID of the span."
    )

    # Common span columns
    name: Optional[str] = None
    span_kind: Optional[str] = Field(
        default=None, description="The kind of span e.g. LLM, RETRIEVER …"
    )
    parent_id: Optional[str] = Field(default=None, description="The parent span ID if present.")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status_code: Optional[str] = None
    status_message: Optional[str] = None
    events: Optional[list[dict[str, Any]]] = None
    attributes: Optional[dict[str, Any]] = None

    model_config = {
        **V1RoutesBaseModel.model_config,  # inherit json encoders etc.
        "extra": "allow",  # allow dynamic columns resulting from SpanQuery DSL
    }


class SpanSearchResponseBody(PaginatedResponseBody[Span]):
    pass


# TODO: Add property details to SpanQuery schema
@router.post(
    "/spans",
    operation_id="querySpans",
    summary="Query spans with query DSL",
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY]),
    include_in_schema=False,
)
async def query_spans_handler(
    request: Request,
    request_body: QuerySpansRequestBody,
    accept: Optional[str] = Header(None),
    project_name: Optional[str] = Query(
        default=None, description="The project name to get evaluations from"
    ),
) -> Response:
    queries = request_body.queries
    project_name = (
        project_name
        or request.query_params.get("project-name")  # for backward compatibility
        or request.headers.get(
            "project-name"
        )  # read from headers/payload for backward-compatibility
        or request_body.project_name
        or DEFAULT_PROJECT_NAME
    )
    end_time = request_body.end_time or request_body.stop_time
    try:
        span_queries = [SpanQuery_.from_dict(query.dict()) for query in queries]
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid query: {e}",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    async with request.app.state.db() as session:
        results = []
        for query in span_queries:
            results.append(
                await session.run_sync(
                    query,
                    project_name=project_name,
                    start_time=normalize_datetime(
                        request_body.start_time,
                        timezone.utc,
                    ),
                    end_time=normalize_datetime(
                        end_time,
                        timezone.utc,
                    ),
                    limit=request_body.limit,
                    root_spans_only=request_body.root_spans_only,
                    orphan_span_as_root_span=request_body.orphan_span_as_root_span,
                )
            )
    if not results:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND)

    if accept == "application/json":
        boundary_token = token_urlsafe(64)
        return StreamingResponse(
            content=_json_multipart(results, boundary_token),
            media_type=f"multipart/mixed; boundary={boundary_token}",
        )

    async def content() -> AsyncIterator[bytes]:
        for result in results:
            yield df_to_bytes(result)

    return StreamingResponse(
        content=content(),
        media_type="application/x-pandas-arrow",
    )


async def _json_multipart(
    results: list[pd.DataFrame],
    boundary_token: str,
) -> AsyncIterator[str]:
    for df in results:
        yield f"--{boundary_token}\r\n"
        yield "Content-Type: application/json\r\n\r\n"
        yield await get_running_loop().run_in_executor(None, encode_df_as_json_string, df)
        yield "\r\n"
    yield f"--{boundary_token}--\r\n"


@router.get(
    "/projects/{project_identifier}/span_search",
    operation_id="spanSearch",
    summary="Search spans with simple filters (no DSL)",
    description="Return spans within a project filtered by time range, annotation names, "
    "and ordered by start_time. Supports cursor-based pagination.",
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY]),
)
async def span_search(
    request: Request,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name, "
            "it cannot contain slash (/), question mark (?), or pound sign (#) characters."
        )
    ),
    cursor: Optional[str] = Query(default=None, description="Pagination cursor (GlobalID of Span)"),
    limit: int = Query(default=100, gt=0, le=1000, description="Maximum number of spans to return"),
    sort_direction: Literal["asc", "desc"] = Query(
        default="desc", description="Sort direction for the sort field",
    ),
    start_time: Optional[datetime] = Query(default=None, description="Inclusive lower bound time"),
    end_time: Optional[datetime] = Query(default=None, description="Exclusive upper bound time"),
    annotation_names: Optional[list[str]] = Query(
        default=None,
        description="If provided, only include spans that have at least one annotation with one of these names.",
        alias="annotationNames",
    ),
) -> SpanSearchResponseBody:
    """Search spans with minimal filters instead of the old SpanQuery DSL."""

    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)

    project_id: int = project.id
    order_exprs = [models.Span.id.asc() if sort_direction == "asc" else models.Span.id.desc()]

    stmt = (
        select(
            models.Span,
            models.Trace.trace_id,
        )
        .join(models.Trace)
        .join(models.Project)
        .where(models.Project.id == project_id)
        .order_by(*order_exprs)
    )

    if start_time:
        stmt = stmt.where(models.Span.start_time >= normalize_datetime(start_time, timezone.utc))
    if end_time:
        stmt = stmt.where(models.Span.start_time < normalize_datetime(end_time, timezone.utc))

    if annotation_names:
        stmt = (
            stmt.join(models.SpanAnnotation)
            .where(models.SpanAnnotation.name.in_(annotation_names))
            .group_by(models.Span.id, models.Trace.trace_id)
        )

    if cursor:
        try:
            cursor_rowid = int(GlobalID.from_id(cursor).node_id)
            if sort_direction == "asc":
                stmt = stmt.where(models.Span.id > cursor_rowid)
            else:
                stmt = stmt.where(models.Span.id < cursor_rowid)
        except Exception:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid cursor")

    stmt = stmt.limit(limit + 1)

    async with request.app.state.db() as session:
        rows: list[tuple[models.Span, str]] = [r async for r in await session.stream(stmt)]

    if not rows:
        return SpanSearchResponseBody(next_cursor=None, data=[])

    next_cursor: Optional[str] = None
    if len(rows) == limit + 1:
        *rows, extra = rows
        span_extra, _ = extra
        next_cursor = str(GlobalID("Span", str(span_extra.id)))

    # Convert rows to Span Pydantic model
    result_spans: list[Span] = []
    for span_orm, trace_id in rows:
        result_spans.append(
            Span(
                id=str(GlobalID("Span", str(span_orm.id))),
                span_id=span_orm.span_id,
                trace_id=trace_id,
                name=span_orm.name,
                span_kind=span_orm.span_kind,
                parent_id=span_orm.parent_id,
                start_time=span_orm.start_time,
                end_time=span_orm.end_time,
                status_code=span_orm.status_code,
                status_message=span_orm.status_message,
                events=span_orm.events or [],
                attributes=span_orm.attributes or {},
            )
        )

    return SpanSearchResponseBody(next_cursor=next_cursor, data=result_spans)


@router.get("/spans", include_in_schema=False, deprecated=True)
async def get_spans_handler(
    request: Request,
    request_body: QuerySpansRequestBody,
    project_name: Optional[str] = Query(
        default=None, description="The project name to get evaluations from"
    ),
) -> Response:
    return await query_spans_handler(request, request_body, project_name)


class SpanAnnotationResult(V1RoutesBaseModel):
    label: Optional[str] = Field(default=None, description="The label assigned by the annotation")
    score: Optional[float] = Field(default=None, description="The score assigned by the annotation")
    explanation: Optional[str] = Field(
        default=None, description="Explanation of the annotation result"
    )


class SpanAnnotationData(V1RoutesBaseModel):
    span_id: str = Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)")
    name: str = Field(description="The name of the annotation")
    annotator_kind: Literal["LLM", "CODE", "HUMAN"] = Field(
        description="The kind of annotator used for the annotation"
    )
    result: Optional[SpanAnnotationResult] = Field(
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

    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.SpanAnnotation:
        return Precursors.SpanAnnotation(
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


class AnnotateSpansRequestBody(RequestBody[list[SpanAnnotationData]]):
    data: list[SpanAnnotationData]


class InsertedSpanAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted span annotation")


class AnnotateSpansResponseBody(ResponseBody[list[InsertedSpanAnnotation]]):
    pass


@router.post(
    "/span_annotations",
    operation_id="annotateSpans",
    summary="Create span annotations",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Span not found"}]
    ),
    response_description="Span annotations inserted successfully",
    include_in_schema=True,
)
async def annotate_spans(
    request: Request,
    request_body: AnnotateSpansRequestBody,
    sync: bool = Query(default=False, description="If true, fulfill request synchronously."),
) -> AnnotateSpansResponseBody:
    if not request_body.data:
        return AnnotateSpansResponseBody(data=[])

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    span_annotations = request_body.data
    filtered_span_annotations = list(filter(lambda d: d.name != "note", span_annotations))
    if len(filtered_span_annotations) != len(span_annotations):
        warnings.warn(
            (
                "Span annotations with the name 'note' are not supported in this endpoint. "
                "They will be ignored."
            ),
            UserWarning,
        )
    precursors = [d.as_precursor(user_id=user_id) for d in filtered_span_annotations]
    if not sync:
        await request.state.enqueue(*precursors)
        return AnnotateSpansResponseBody(data=[])

    span_ids = {p.span_id for p in precursors}
    async with request.app.state.db() as session:
        existing_spans = {
            span.span_id: span.id
            async for span in await session.stream_scalars(
                select(models.Span).filter(models.Span.span_id.in_(span_ids))
            )
        }

        missing_span_ids = span_ids - set(existing_spans.keys())
        if missing_span_ids:
            raise HTTPException(
                detail=f"Spans with IDs {', '.join(missing_span_ids)} do not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )
        inserted_ids = []
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_spans[p.span_id]).row))
            span_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.SpanAnnotation,
                    unique_by=("name", "span_rowid", "identifier"),
                ).returning(models.SpanAnnotation.id)
            )
            inserted_ids.append(span_annotation_id)
    request.state.event_queue.put(SpanAnnotationInsertEvent(tuple(inserted_ids)))
    return AnnotateSpansResponseBody(
        data=[
            InsertedSpanAnnotation(id=str(GlobalID("SpanAnnotation", str(id_))))
            for id_ in inserted_ids
        ]
    )
