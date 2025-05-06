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


class SpanRecord(V1RoutesBaseModel):
    """A REST representation of a span.

    Most fields correspond directly to columns in the `spans` table or the
    flattened dataframe returned by the `/v1/spans` endpoint.  Additional
    columns that may be produced by the SpanQuery DSL (e.g. via `select`,
    `explode`, `concat`, or `rename`) are accepted transparently thanks to
    the `extra = "allow"` model configuration.
    """

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


class SpanSearchResponseBody(ResponseBody[list[list[SpanRecord]]]):
    """The response body returned by the `/span_search` endpoint.

    The outer list aligns with the order of `queries` in the request body; each
    inner list contains the spans that satisfy the corresponding query.
    """

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


@router.post(
    "/projects/{project_identifier}/span_search",
    operation_id="spanSearch",
    summary="Query spans in a project and return JSON (not DataFrame)",
    response_description=(
        "For each SpanQuery in the request body, returns a list of matching spans scoped to the "
        "specified project."
    ),
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY]),
)
async def span_search_handler(
    request: Request,
    request_body: QuerySpansRequestBody,
    project_identifier: str = Path(
        description=(
            "The project identifier: either project ID or project name. If using a project name, "
            "it cannot contain slash (/), question mark (?), or pound sign (#) characters."
        )
    ),
) -> SpanSearchResponseBody:
    """A JSON alternative to the legacy `/v1/spans` route.

    It executes the same SpanQuery DSL but serialises the results into a list
    of Pydantic objects rather than a multipart-encoded pandas DataFrame.
    """

    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)
    project_name: str = project.name

    queries = request_body.queries
    end_time = request_body.end_time or request_body.stop_time

    # Parse the SpanQuery DSL – reuse the equivalent implementation used by the
    # existing `/spans` route.
    try:
        span_queries = [SpanQuery_.from_dict(query.dict()) for query in queries]
    except Exception as e:
        raise HTTPException(
            detail=f"Invalid query: {e}",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )

    async with request.app.state.db() as session:
        df_results: list[pd.DataFrame] = []
        for query in span_queries:
            df_results.append(
                await session.run_sync(
                    query,
                    project_name=project_name,
                    start_time=normalize_datetime(request_body.start_time, timezone.utc),
                    end_time=normalize_datetime(end_time, timezone.utc),
                    limit=request_body.limit,
                    root_spans_only=request_body.root_spans_only,
                )
            )

        if not df_results:
            raise HTTPException(status_code=HTTP_404_NOT_FOUND)

        # Build a mapping from span_id -> (rowid, trace_id, attributes, events)
        all_span_ids: set[str] = {
            *(
                span_id
                for df in df_results
                for span_id in (
                    df.get("context.span_id")
                    if "context.span_id" in df.columns
                    else df.get("span_id", pd.Series(dtype=str))
                )
                if isinstance(span_id, str)
            )
        }

        span_meta_stmt = (
            select(
                models.Span.id,
                models.Span.span_id,
                models.Trace.trace_id,
                models.Span.attributes,
                models.Span.events,
            )
            .join(models.Trace)
            .join(models.Project)
            .where(
                models.Project.id == project.id,
                models.Span.span_id.in_(all_span_ids),
            )
        )
        meta_mapping: dict[
            str, tuple[int, Optional[str], dict[str, Any], list[dict[str, Any]]]
        ] = {}
        for row in (await session.execute(span_meta_stmt)).all():
            rowid, span_id, trace_id, attributes, events = row
            meta_mapping[span_id] = (
                rowid,
                trace_id,
                attributes or {},
                events or [],
            )

    # Helper to transform a dataframe row into a SpanRecord
    def _row_to_span_record(row: pd.Series) -> SpanRecord:
        data: dict[str, Any] = row.to_dict()

        # Normalise context.* aliases
        if "context.span_id" in data:
            data["span_id"] = data.pop("context.span_id")
        if "context.trace_id" in data:
            data["trace_id"] = data.pop("context.trace_id")

        span_id_val: str = data.get("span_id")  # type: ignore[assignment]
        if span_id_val in meta_mapping:
            rowid, trace_id_val, attributes_val, events_val = meta_mapping[span_id_val]
            data.setdefault("id", str(GlobalID("Span", str(rowid))))
            data.setdefault("trace_id", trace_id_val)
            data.setdefault("attributes", attributes_val)
            data.setdefault("events", events_val)
        else:
            # Fallback – still provide an ID if we cannot map it (should be rare)
            data.setdefault("id", span_id_val)

        return SpanRecord(**data)  # extra columns are accepted

    response_data: list[list[SpanRecord]] = [
        [_row_to_span_record(row) for _, row in df.iterrows()] for df in df_results
    ]

    return SpanSearchResponseBody(data=response_data)


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
