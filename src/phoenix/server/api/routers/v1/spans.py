import warnings
from asyncio import get_running_loop
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from enum import Enum, IntEnum
from secrets import token_urlsafe
from typing import Annotated, Any, Literal, Optional, Union

import pandas as pd
from fastapi import APIRouter, Header, HTTPException, Path, Query
from pydantic import BaseModel, Extra, Field
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
from phoenix.trace.attributes import flatten
from phoenix.trace.dsl import SpanQuery as SpanQuery_
from phoenix.utilities.json import encode_df_as_json_string

from .models import V1RoutesBaseModel
from .utils import (
    PaginatedResponseBody,
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


class DoubleValue(Enum):
    Infinity = "Infinity"
    field_Infinity = "-Infinity"
    NaN = "NaN"


class AnyValue(BaseModel):
    class Config:
        extra = Extra.forbid

    array_value: None = None  # TODO: Add ArrayValue model
    bool_value: Optional[bool] = None
    bytes_value: Optional[Annotated[str, Field(pattern=r"^[A-Za-z0-9+/]*={0,2}$")]] = None
    double_value: Optional[Union[float, DoubleValue, str]] = None
    int_value: Optional[
        Union[
            Annotated[int, Field(ge=-9223372036854775808, lt=9223372036854775808)],
            Annotated[str, Field(pattern=r"^-?[0-9]+$")],
        ]
    ] = None
    kvlist_value: None = None  # TODO: Add KeyValueList model
    string_value: Optional[str] = None


class KeyValue(BaseModel):
    class Config:
        extra = Extra.forbid

    key: Optional[str] = None
    value: Optional[AnyValue] = None


class StatusCode(IntEnum):
    UNSET = 0
    OK = 1
    ERROR = 2


class Status(BaseModel):
    class Config:
        extra = Extra.forbid

    code: Optional[Annotated[int, Field(ge=-2147483648, le=2147483647)]] = Field(
        None, description="The status code."
    )
    message: Optional[str] = Field(
        None, description="A developer-facing human readable error message."
    )


class Kind(Enum):
    SPAN_KIND_UNSPECIFIED = "SPAN_KIND_UNSPECIFIED"
    SPAN_KIND_INTERNAL = "SPAN_KIND_INTERNAL"
    SPAN_KIND_SERVER = "SPAN_KIND_SERVER"
    SPAN_KIND_CLIENT = "SPAN_KIND_CLIENT"
    SPAN_KIND_PRODUCER = "SPAN_KIND_PRODUCER"
    SPAN_KIND_CONSUMER = "SPAN_KIND_CONSUMER"


class OtlpSpan(BaseModel):
    class Config:
        extra = Extra.forbid

    attributes: Optional[list[KeyValue]] = Field(
        None,
        description=(
            "attributes is a collection of key/value pairs. Note, global attributes like server "
            "name can be set using the resource API. Examples of attributes:\n\n"
            '    "/http/user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) '
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36"\n'
            '    "/http/server_latency": 300\n'
            '    "example.com/myattribute": true\n'
            '    "example.com/score": 10.239\n\n'
            "The OpenTelemetry API specification further restricts the allowed value types:\n"
            "https://github.com/open-telemetry/opentelemetry-specification/blob/main/"
            "specification/common/README.md#attribute\n"
            "Attribute keys MUST be unique (it is not allowed to have more than one attribute "
            "with the same key)."
        ),
    )
    dropped_attributes_count: Optional[Annotated[int, Field(ge=0, le=4294967295)]] = Field(
        None,
        description=(
            "dropped_attributes_count is the number of attributes that were discarded. Attributes "
            "can be discarded because their keys are too long or because there are too many "
            "attributes. If this value is 0, then no attributes were dropped."
        ),
    )
    dropped_events_count: Optional[Annotated[int, Field(ge=0, le=4294967295)]] = Field(
        None,
        description=(
            "dropped_events_count is the number of dropped events. If the value is 0, then no "
            "events were dropped."
        ),
    )
    dropped_links_count: Optional[Annotated[int, Field(ge=0, le=4294967295)]] = Field(
        None,
        description=(
            "dropped_links_count is the number of dropped links after the maximum size was "
            "enforced. If this value is 0, then no links were dropped."
        ),
    )
    end_time_unix_nano: Optional[
        Union[
            Annotated[int, Field(ge=0, lt=18446744073709551616)],
            Annotated[str, Field(pattern=r"^[0-9]+$")],
        ]
    ] = Field(
        None,
        description=(
            "end_time_unix_nano is the end time of the span. On the client side, this is the time "
            "kept by the local machine where the span execution ends. On the server side, this is "
            "the time when the server application handler stops running.\n"
            "Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.\n\n"
            "This field is semantically required and it is expected that end_time >= start_time."
        ),
    )
    events: None = None  # TODO: Add Event model
    flags: Optional[Annotated[int, Field(ge=0, le=4294967295)]] = Field(
        None,
        description=(
            "Flags, a bit field.\n\n"
            "Bits 0-7 (8 least significant bits) are the trace flags as defined in W3C Trace "
            "Context specification. To read the 8-bit W3C trace flag, use "
            "`flags & SPAN_FLAGS_TRACE_FLAGS_MASK`.\n\n"
            "See https://www.w3.org/TR/trace-context-2/#trace-flags for the flag definitions.\n\n"
            "Bits 8 and 9 represent the 3 states of whether a span's parent is remote. The states "
            "are (unknown, is not remote, is remote).\n"
            "To read whether the value is known, use "
            "`(flags & SPAN_FLAGS_CONTEXT_HAS_IS_REMOTE_MASK) != 0`.\n"
            "To read whether the span is remote, use "
            "`(flags & SPAN_FLAGS_CONTEXT_IS_REMOTE_MASK) != 0`.\n\n"
            "When creating span messages, if the message is logically forwarded from another "
            "source with an equivalent flags fields (i.e., usually another OTLP span message), the "
            "field SHOULD be copied as-is. If creating from a source that does not have an "
            "equivalent flags field (such as a runtime representation of an OpenTelemetry span), "
            "the high 22 bits MUST be set to zero.\n"
            "Readers MUST NOT assume that bits 10-31 (22 most significant bits) will be zero.\n\n"
            "[Optional]."
        ),
    )
    kind: Optional[Union[Kind, Annotated[int, Field(ge=-2147483648, le=2147483647)]]] = Field(
        Kind.SPAN_KIND_INTERNAL,  # INTERNAL because OpenInference uses its own SpanKind attribute
        description=(
            "Distinguishes between spans generated in a particular context. For example, two spans "
            "with the same name may be distinguished using `CLIENT` (caller) and `SERVER` (callee) "
            "to identify queueing latency associated with the span."
        ),
    )
    links: None = None  # TODO: Add Link model
    name: Optional[str] = Field(
        None,
        description=(
            "A description of the span's operation.\n\n"
            "For example, the name can be a qualified method name or a file name and a line number "
            "where the operation is called. A best practice is to use the same display name at the "
            "same call point in an application. This makes it easier to correlate spans in "
            "different traces.\n\n"
            "This field is semantically required to be set to non-empty string. Empty value is "
            "equivalent to an unknown span name.\n\n"
            "This field is required."
        ),
    )
    parent_span_id: Optional[Annotated[str, Field(pattern=r"^[A-Za-z0-9+/]*={0,2}$")]] = Field(
        None,
        description=(
            "The `span_id` of this span's parent span. If this is a root span, then this field "
            "must be empty. The ID is an 8-byte array."
        ),
    )
    span_id: Optional[Annotated[str, Field(pattern=r"^[A-Za-z0-9+/]*={0,2}$")]] = Field(
        None,
        description=(
            "A unique identifier for a span within a trace, assigned when the span is created. The "
            "ID is an 8-byte array. An ID with all zeroes OR of length other than 8 bytes is "
            "considered invalid (empty string in OTLP/JSON is zero-length and thus is also "
            "invalid).\n\n"
            "This field is required."
        ),
    )
    start_time_unix_nano: Optional[
        Union[
            Annotated[int, Field(ge=0, lt=18446744073709551616)],
            Annotated[str, Field(pattern=r"^[0-9]+$")],
        ]
    ] = Field(
        None,
        description=(
            "start_time_unix_nano is the start time of the span. On the client side, this is the "
            "time kept by the local machine where the span execution starts. On the server side, "
            "this is the time when the server's application handler starts running.\n"
            "Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.\n\n"
            "This field is semantically required and it is expected that end_time >= start_time."
        ),
    )
    status: Optional[Status] = Field(
        None,
        description=(
            "An optional final status for this span. Semantically when Status isn't set, it means "
            "span's status code is unset, i.e. assume STATUS_CODE_UNSET (code = 0)."
        ),
    )
    trace_id: Optional[Annotated[str, Field(pattern=r"^[A-Za-z0-9+/]*={0,2}$")]] = Field(
        None,
        description=(
            "A unique identifier for a trace. All spans from the same trace share the same "
            "`trace_id`. The ID is a 16-byte array. An ID with all zeroes OR of length other than "
            "16 bytes is considered invalid (empty string in OTLP/JSON is zero-length and thus is "
            "also invalid).\n\n"
            "This field is required."
        ),
    )
    trace_state: Optional[str] = Field(
        None,
        description=(
            "trace_state conveys information about request position in multiple distributed "
            "tracing graphs. It is a trace_state in w3c-trace-context format: "
            "https://www.w3.org/TR/trace-context/#tracestate-header\n"
            "See also https://github.com/w3c/distributed-tracing for more details about this "
            "field."
        ),
    )


class SpanSearchResponseBody(PaginatedResponseBody[OtlpSpan]):
    """Paginated response where each span follows OTLP JSON structure."""

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


def _to_any_value(value: Any) -> AnyValue:
    if value is None:
        return AnyValue()
    elif isinstance(value, bool):
        return AnyValue(bool_value=value)
    elif isinstance(value, int):
        return AnyValue(int_value=value)
    elif isinstance(value, float):
        if value in (float("inf"), float("-inf"), float("nan")):
            return AnyValue(double_value=str(value))
        return AnyValue(double_value=value)
    elif isinstance(value, str):
        return AnyValue(string_value=value)
    elif isinstance(value, bytes):
        return AnyValue(bytes_value=value.hex())
    elif isinstance(value, (list, tuple)):
        # TODO: Implement array_value when ArrayValue model is added
        return AnyValue()
    elif isinstance(value, dict):
        # TODO: Implement kvlist_value when KeyValueList model is added
        return AnyValue()
    else:
        # For any other type, convert to string
        return AnyValue(string_value=str(value))


@router.get(
    "/projects/{project_identifier}/spans",
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
        default="desc",
        description="Sort direction for the sort field",
    ),
    start_time: Optional[datetime] = Query(default=None, description="Inclusive lower bound time"),
    end_time: Optional[datetime] = Query(default=None, description="Exclusive upper bound time"),
    annotation_names: Optional[list[str]] = Query(
        default=None,
        description=(
            "If provided, only include spans that have at least one annotation with one "
            "of these names."
        ),
        alias="annotationNames",
    ),
) -> SpanSearchResponseBody:
    """Search spans with minimal filters instead of the old SpanQuery DSL."""

    async with request.app.state.db() as session:
        project = await _get_project_by_identifier(session, project_identifier)

    project_id: int = project.id
    order_by = [models.Span.id.asc() if sort_direction == "asc" else models.Span.id.desc()]

    stmt = (
        select(
            models.Span,
            models.Trace.trace_id,
        )
        .join(models.Trace, onclause=models.Trace.id == models.Span.trace_rowid)
        .join(models.Project, onclause=models.Project.id == project_id)
        .order_by(*order_by)
    )

    if start_time:
        stmt = stmt.where(models.Span.start_time >= normalize_datetime(start_time, timezone.utc))
    if end_time:
        stmt = stmt.where(models.Span.start_time < normalize_datetime(end_time, timezone.utc))

    if annotation_names:
        stmt = (
            stmt.join(
                models.SpanAnnotation,
                onclause=models.SpanAnnotation.span_rowid == models.Span.id,
            )
            .where(models.SpanAnnotation.name.in_(annotation_names))
            .group_by(models.Span.id, models.Trace.trace_id)
        )

    if cursor:
        try:
            cursor_rowid = int(GlobalID.from_id(cursor).node_id)
            if sort_direction == "asc":
                stmt = stmt.where(models.Span.id >= cursor_rowid)
            else:
                stmt = stmt.where(models.Span.id <= cursor_rowid)
        except Exception:
            raise HTTPException(status_code=HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid cursor")

    stmt = stmt.limit(limit + 1)

    async with request.app.state.db() as session:
        rows: list[tuple[models.Span, str]] = [r async for r in await session.stream(stmt)]

    if not rows:
        return SpanSearchResponseBody(next_cursor=None, data=[])

    next_cursor: Optional[str] = None
    if len(rows) == limit + 1:
        *rows, extra = rows  # extra is first item of next page
        span_extra, _ = extra
        next_cursor = str(GlobalID("Span", str(span_extra.id)))

    # Convert ORM rows -> OTLP-style spans
    result_spans: list[OtlpSpan] = []
    for span_orm, trace_id in rows:
        try:
            status_code_enum = StatusCode[(span_orm.status_code or "UNSET").upper()]
        except KeyError:
            status_code_enum = StatusCode.UNSET

        # Convert attributes to KeyValue list
        attributes_kv: list[KeyValue] = []
        if span_orm.attributes:
            for k, v in flatten(span_orm.attributes or {}, recurse_on_sequence=True):
                attributes_kv.append(KeyValue(key=k, value=_to_any_value(v)))

        start_ns = (
            int(span_orm.start_time.timestamp() * 1_000_000_000) if span_orm.start_time else None
        )
        end_ns = int(span_orm.end_time.timestamp() * 1_000_000_000) if span_orm.end_time else None

        result_spans.append(
            OtlpSpan(
                trace_id=trace_id,
                span_id=span_orm.span_id,
                parent_span_id=span_orm.parent_id,
                name=span_orm.name,
                start_time_unix_nano=start_ns,
                end_time_unix_nano=end_ns,
                attributes=attributes_kv,
                # events=None,  # TODO: Add events
                status=Status(code=status_code_enum, message=span_orm.status_message or None),
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
