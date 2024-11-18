from asyncio import get_running_loop
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from secrets import token_urlsafe
from typing import Any, Literal, Optional

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, Query
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
from phoenix.server.dml_event import SpanAnnotationInsertEvent
from phoenix.trace.dsl import SpanQuery as SpanQuery_
from phoenix.utilities.json import encode_df_as_json_string

from .pydantic_compat import V1RoutesBaseModel
from .utils import RequestBody, ResponseBody, add_errors_to_responses

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
    span_id: str = Field(description="OpenTelemetry Span ID (hex format w/o 0x prefix)")
    name: str = Field(description="The name of the annotation")
    annotator_kind: Literal["LLM", "HUMAN"] = Field(
        description="The kind of annotator used for the annotation"
    )
    result: Optional[SpanAnnotationResult] = Field(
        default=None, description="The result of the annotation"
    )
    metadata: Optional[dict[str, Any]] = Field(
        default=None, description="Metadata for the annotation"
    )

    def as_precursor(self) -> Precursors.SpanAnnotation:
        return Precursors.SpanAnnotation(
            self.span_id,
            models.SpanAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
            ),
        )


class AnnotateSpansRequestBody(RequestBody[list[SpanAnnotation]]):
    data: list[SpanAnnotation]


class InsertedSpanAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted span annotation")


class AnnotateSpansResponseBody(ResponseBody[list[InsertedSpanAnnotation]]):
    pass


@router.post(
    "/span_annotations",
    operation_id="annotateSpans",
    summary="Create or update span annotations",
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
    precursors = [d.as_precursor() for d in request_body.data]
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
                    unique_by=("name", "span_rowid"),
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
