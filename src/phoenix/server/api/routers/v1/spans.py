from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
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
from phoenix.db.insertion.helpers import insert_on_conflict
from phoenix.server.api.routers.utils import df_to_bytes
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.trace.dsl import SpanQuery as SpanQuery_

from .pydantic_compat import V1RoutesBaseModel
from .utils import RequestBody, ResponseBody, add_errors_to_responses

DEFAULT_SPAN_LIMIT = 1000

router = APIRouter(tags=["traces"], include_in_schema=False)


class SpanQuery(V1RoutesBaseModel):
    select: Optional[Dict[str, Any]] = None
    filter: Optional[Dict[str, Any]] = None
    explode: Optional[Dict[str, Any]] = None
    concat: Optional[Dict[str, Any]] = None
    rename: Optional[Dict[str, Any]] = None
    index: Optional[Dict[str, Any]] = None


class QuerySpansRequestBody(V1RoutesBaseModel):
    queries: List[SpanQuery]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = DEFAULT_SPAN_LIMIT
    root_spans_only: Optional[bool] = None
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


# TODO: Add property details to SpanQuery schema
@router.post(
    "/spans",
    operation_id="querySpans",
    summary="Query spans with query DSL",
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY]),
)
async def query_spans_handler(
    request: Request,
    request_body: QuerySpansRequestBody,
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
                )
            )
    if not results:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND)

    async def content() -> AsyncIterator[bytes]:
        for result in results:
            yield df_to_bytes(result)

    return StreamingResponse(
        content=content(),
        media_type="application/x-pandas-arrow",
    )


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


class SpanAnnotation(V1RoutesBaseModel):
    span_id: str = Field(description="The ID of the span being annotated")
    name: str = Field(description="The name of the annotation")
    annotator_kind: Literal["LLM", "HUMAN"] = Field(
        description="The kind of annotator used for the annotation"
    )
    result: Optional[SpanAnnotationResult] = Field(
        default=None, description="The result of the annotation"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Metadata for the annotation"
    )


class AnnotateSpansRequestBody(RequestBody[List[SpanAnnotation]]):
    data: List[SpanAnnotation]


class InsertedSpanAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted span annotation")


class AnnotateSpansResponseBody(ResponseBody[List[InsertedSpanAnnotation]]):
    pass


@router.post(
    "/span_annotations",
    operation_id="annotateSpans",
    summary="Create or update span annotations",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Span not found"}]
    ),
    response_description="Span annotations inserted successfully",
)
async def annotate_spans(
    request: Request, request_body: AnnotateSpansRequestBody
) -> AnnotateSpansResponseBody:
    span_annotations = request_body.data
    span_gids = [GlobalID.from_id(annotation.span_id) for annotation in span_annotations]

    resolved_span_ids = []
    for span_gid in span_gids:
        try:
            resolved_span_ids.append(from_global_id_with_expected_type(span_gid, "Span"))
        except ValueError:
            raise HTTPException(
                detail="Span with ID {span_gid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        spans = await session.execute(
            select(models.Span).filter(models.Span.id.in_(resolved_span_ids))
        )
        existing_span_ids = {span.id for span in spans.scalars()}

        missing_span_ids = set(resolved_span_ids) - existing_span_ids
        if missing_span_ids:
            missing_span_gids = [
                str(GlobalID("Span", str(span_gid))) for span_gid in missing_span_ids
            ]
            raise HTTPException(
                detail=f"Spans with IDs {', '.join(missing_span_gids)} do not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )

        inserted_annotations = []
        for annotation in span_annotations:
            span_gid = GlobalID.from_id(annotation.span_id)
            span_id = from_global_id_with_expected_type(span_gid, "Span")
            name = annotation.name
            annotator_kind = annotation.annotator_kind
            result = annotation.result
            label = result.label if result else None
            score = result.score if result else None
            explanation = result.explanation if result else None
            metadata = annotation.metadata or {}

            values = dict(
                span_rowid=span_id,
                name=name,
                label=label,
                score=score,
                explanation=explanation,
                annotator_kind=annotator_kind,
                metadata_=metadata,
            )
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            span_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.SpanAnnotation,
                    unique_by=("name", "span_rowid"),
                ).returning(models.SpanAnnotation.id)
            )
            inserted_annotations.append(
                InsertedSpanAnnotation(id=str(GlobalID("SpanAnnotation", str(span_annotation_id))))
            )

    return AnnotateSpansResponseBody(data=inserted_annotations)
