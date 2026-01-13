import gzip
import json
import zlib
from collections.abc import AsyncIterator
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Path, Query
from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from pydantic import Field
from sqlalchemy import delete, select
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.server.api.routers.v1.annotations import TraceAnnotationData
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import SpanDeleteEvent, TraceAnnotationInsertEvent
from phoenix.server.prometheus import SPAN_QUEUE_REJECTIONS
from phoenix.trace.attributes import flatten
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name

from .models import V1RoutesBaseModel
from .spans import (
    OtlpEvent,
    OtlpKeyValue,
    OtlpSpan,
    OtlpStatus,
    StatusCode,
    _to_any_value,
)
from .utils import (
    RequestBody,
    ResponseBody,
    add_errors_to_responses,
)

router = APIRouter(tags=["traces"])


def is_not_at_capacity(request: Request) -> None:
    if request.app.state.span_queue_is_full():
        SPAN_QUEUE_REJECTIONS.inc()
        raise HTTPException(
            detail="Server is at capacity and cannot process more requests",
            status_code=503,
        )


@router.post(
    "/traces",
    dependencies=[Depends(is_not_locked), Depends(is_not_at_capacity)],
    operation_id="addTraces",
    summary="Send traces",
    responses=add_errors_to_responses(
        [
            {
                "status_code": 415,
                "description": (
                    "Unsupported content type (only `application/x-protobuf` is supported)"
                ),
            },
            {"status_code": 422, "description": "Invalid request body"},
            {
                "status_code": 503,
                "description": "Server is at capacity and cannot process more requests",
            },
        ]
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-protobuf": {"schema": {"type": "string", "format": "binary"}}
            },
        }
    },
    include_in_schema=False,
)
async def post_traces(
    request: Request,
    background_tasks: BackgroundTasks,
    content_type: Optional[str] = Header(default=None),
    content_encoding: Optional[str] = Header(default=None),
) -> Response:
    if content_type != "application/x-protobuf":
        raise HTTPException(
            detail=f"Unsupported content type: {content_type}",
            status_code=415,
        )
    if content_encoding and content_encoding not in ("gzip", "deflate"):
        raise HTTPException(
            detail=f"Unsupported content encoding: {content_encoding}",
            status_code=415,
        )
    body = await request.body()
    if content_encoding == "gzip":
        body = await run_in_threadpool(gzip.decompress, body)
    elif content_encoding == "deflate":
        body = await run_in_threadpool(zlib.decompress, body)
    req = ExportTraceServiceRequest()
    try:
        await run_in_threadpool(req.ParseFromString, body)
    except DecodeError:
        raise HTTPException(
            detail="Request body is invalid ExportTraceServiceRequest",
            status_code=422,
        )
    background_tasks.add_task(_add_spans, req, request.state)

    # "The server MUST use the same Content-Type in the response as it received in the request"
    response_message = ExportTraceServiceResponse()
    response_bytes = response_message.SerializeToString()
    return Response(
        content=response_bytes,
        media_type="application/x-protobuf",
        status_code=200,
    )


class AnnotateTracesRequestBody(RequestBody[list[TraceAnnotationData]]):
    data: list[TraceAnnotationData] = Field(description="The trace annotations to be upserted")


class InsertedTraceAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted trace annotation")


class AnnotateTracesResponseBody(ResponseBody[list[InsertedTraceAnnotation]]):
    pass


@router.post(
    "/trace_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateTraces",
    summary="Create trace annotations",
    responses=add_errors_to_responses([{"status_code": 404, "description": "Trace not found"}]),
)
async def annotate_traces(
    request: Request,
    request_body: AnnotateTracesRequestBody,
    sync: bool = Query(default=False, description="If true, fulfill request synchronously."),
) -> AnnotateTracesResponseBody:
    if not request_body.data:
        return AnnotateTracesResponseBody(data=[])

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    precursors = [d.as_precursor(user_id=user_id) for d in request_body.data]
    if not sync:
        await request.state.enqueue_annotations(*precursors)
        return AnnotateTracesResponseBody(data=[])

    trace_ids = {p.trace_id for p in precursors}
    async with request.app.state.db() as session:
        existing_traces = {
            trace_id: id_
            async for trace_id, id_ in await session.stream(
                select(models.Trace.trace_id, models.Trace.id).filter(
                    models.Trace.trace_id.in_(trace_ids)
                )
            )
        }

        missing_trace_ids = trace_ids - set(existing_traces.keys())
        if missing_trace_ids:
            raise HTTPException(
                detail=f"Traces with IDs {', '.join(missing_trace_ids)} do not exist.",
                status_code=404,
            )
        inserted_ids = []
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_traces[p.trace_id]).row))
            trace_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    unique_by=("name", "trace_rowid", "identifier"),
                ).returning(models.TraceAnnotation.id)
            )
            inserted_ids.append(trace_annotation_id)
    request.state.event_queue.put(TraceAnnotationInsertEvent(tuple(inserted_ids)))
    return AnnotateTracesResponseBody(
        data=[
            InsertedTraceAnnotation(id=str(GlobalID("TraceAnnotation", str(id_))))
            for id_ in inserted_ids
        ]
    )


async def _add_spans(req: ExportTraceServiceRequest, state: State) -> None:
    for resource_spans in req.resource_spans:
        project_name = get_project_name(resource_spans.resource.attributes)
        for scope_span in resource_spans.scope_spans:
            for otlp_span in scope_span.spans:
                span = await run_in_threadpool(decode_otlp_span, otlp_span)
                await state.enqueue_span(span, project_name)


@router.delete(
    "/traces/{trace_identifier}",
    operation_id="deleteTrace",
    summary="Delete a trace by identifier",
    description=(
        "Delete an entire trace by its identifier. The identifier can be either:\n"
        "1. A Relay node ID (base64-encoded)\n"
        "2. An OpenTelemetry trace_id (hex string)\n\n"
        "This will permanently remove all spans in the trace and their associated data."
    ),
    responses=add_errors_to_responses([404]),
    status_code=204,  # No Content for successful deletion
)
async def delete_trace(
    request: Request,
    trace_identifier: str = Path(
        description="The trace identifier: either a relay GlobalID or OpenTelemetry trace_id"
    ),
) -> None:
    """
    Delete a trace by identifier (relay GlobalID or OpenTelemetry trace_id).

    This endpoint will:
    1. Delete the trace by identifier (relay GlobalID or OpenTelemetry trace_id)
    2. Get project_id from the deletion for cache invalidation
    3. Trigger cache invalidation events
    4. Return 204 No Content on success

    Note: This deletes the entire trace, including all spans, which maintains data consistency
    and avoids orphaned spans or inconsistent cached cumulative fields.
    """
    async with request.app.state.db() as session:
        # Try to parse as GlobalID first, then fall back to trace_id
        try:
            trace_rowid = from_global_id_with_expected_type(
                GlobalID.from_id(trace_identifier),
                "Trace",
            )
            # Delete by database rowid
            delete_stmt = (
                delete(models.Trace)
                .where(models.Trace.id == trace_rowid)
                .returning(models.Trace.project_rowid)
            )
            error_detail = f"Trace with relay ID '{trace_identifier}' not found"
        except Exception:
            # Delete by OpenTelemetry trace_id
            delete_stmt = (
                delete(models.Trace)
                .where(models.Trace.trace_id == trace_identifier)
                .returning(models.Trace.project_rowid)
            )
            error_detail = f"Trace with trace_id '{trace_identifier}' not found"

        project_id = await session.scalar(delete_stmt)

        if project_id is None:
            raise HTTPException(
                status_code=404,
                detail=error_detail,
            )

    # Trigger cache invalidation event
    request.state.event_queue.put(SpanDeleteEvent((project_id,)))

    # Return 204 No Content (successful deletion with no response body)
    return None


@router.get(
    "/traces/{trace_identifier}/jsonl",
    operation_id="exportTraceJsonl",
    summary="Export trace as JSONL",
    description=(
        "Export all spans in a trace as JSONL (JSON Lines) format. "
        "Each line contains one span in OpenTelemetry JSON format. "
        "The identifier can be either:\n"
        "1. A Relay node ID (base64-encoded)\n"
        "2. An OpenTelemetry trace_id (hex string)\n\n"
        "Spans are ordered chronologically by start_time."
    ),
    responses=add_errors_to_responses([404, 422]),
    response_class=StreamingResponse,
)
async def export_trace_jsonl(
    request: Request,
    trace_identifier: str = Path(
        description="The trace identifier: either a relay GlobalID or OpenTelemetry trace_id"
    ),
) -> StreamingResponse:
    """
    Export a trace and all its spans in JSONL format.

    This endpoint will:
    1. Find the trace by identifier (relay GlobalID or OpenTelemetry trace_id)
    2. Query all spans belonging to the trace
    3. Convert each span to OTLP JSON format
    4. Stream as JSONL (one JSON object per line)
    5. Return as downloadable file
    """

    async def _generate_jsonl() -> AsyncIterator[str]:
        """Generator that yields JSONL lines for all spans in a trace."""
        async with request.app.state.db() as session:
            # Try to parse as GlobalID first, then fall back to trace_id
            try:
                trace_rowid = from_global_id_with_expected_type(
                    GlobalID.from_id(trace_identifier),
                    "Trace",
                )
                # Query by database rowid
                stmt = (
                    select(models.Span, models.Trace.trace_id)
                    .join(models.Trace, onclause=models.Trace.id == models.Span.trace_rowid)
                    .where(models.Trace.id == trace_rowid)
                    .order_by(models.Span.start_time.asc())
                )
                error_detail = f"Trace with relay ID '{trace_identifier}' not found"
            except Exception:
                # Query by OpenTelemetry trace_id
                stmt = (
                    select(models.Span, models.Trace.trace_id)
                    .join(models.Trace, onclause=models.Trace.id == models.Span.trace_rowid)
                    .where(models.Trace.trace_id == trace_identifier)
                    .order_by(models.Span.start_time.asc())
                )
                error_detail = f"Trace with trace_id '{trace_identifier}' not found"

            rows: list[tuple[models.Span, str]] = [r async for r in await session.stream(stmt)]

            if not rows:
                raise HTTPException(
                    status_code=404,
                    detail=error_detail,
                )

            # Convert each span to OTLP format and yield as JSONL
            for span_orm, trace_id in rows:
                otlp_span = _convert_span_to_otlp(span_orm, trace_id)
                # Convert to dict and serialize to JSON
                span_dict = otlp_span.model_dump(exclude_none=True)
                yield json.dumps(span_dict, separators=(",", ":")) + "\n"

    # Determine the filename
    filename = f"trace_{trace_identifier}.jsonl"

    return StreamingResponse(
        _generate_jsonl(),
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


def _convert_span_to_otlp(span_orm: models.Span, trace_id: str) -> OtlpSpan:
    """
    Convert a database Span ORM object to OTLP JSON format.

    This function reuses the conversion logic from the span search endpoint.
    """
    try:
        status_code_enum = StatusCode(span_orm.status_code or "UNSET")
    except ValueError:
        status_code_enum = StatusCode.UNSET

    # Convert attributes to KeyValue list
    attributes_kv: list[OtlpKeyValue] = []
    if span_orm.attributes:
        for k, v in flatten(span_orm.attributes or {}, recurse_on_sequence=True):
            attributes_kv.append(OtlpKeyValue(key=k, value=_to_any_value(v)))

    # Convert events to OTLP Event list
    events: Optional[list[OtlpEvent]] = None
    if span_orm.events:
        events = []
        for event in span_orm.events:
            event_attributes: list[OtlpKeyValue] = []
            if event.get("attributes"):
                for k, v in flatten(event["attributes"], recurse_on_sequence=True):
                    event_attributes.append(OtlpKeyValue(key=k, value=_to_any_value(v)))

            # Convert event timestamp to nanoseconds
            event_time = event.get("timestamp")
            time_unix_nano = None
            if event_time:
                if isinstance(event_time, type(span_orm.start_time)):
                    time_unix_nano = int(event_time.timestamp() * 1_000_000_000)
                elif isinstance(event_time, str):
                    try:
                        from datetime import datetime

                        dt = datetime.fromisoformat(event_time)
                        time_unix_nano = int(dt.timestamp() * 1_000_000_000)
                    except ValueError:
                        pass
                elif isinstance(event_time, (int, float)):
                    time_unix_nano = int(event_time)

            events.append(
                OtlpEvent(
                    name=event.get("name"),
                    attributes=event_attributes,
                    time_unix_nano=time_unix_nano,
                    dropped_attributes_count=event.get("dropped_attributes_count"),
                )
            )

    start_ns = int(span_orm.start_time.timestamp() * 1_000_000_000) if span_orm.start_time else None
    end_ns = int(span_orm.end_time.timestamp() * 1_000_000_000) if span_orm.end_time else None

    return OtlpSpan(
        trace_id=trace_id,
        span_id=span_orm.span_id,
        parent_span_id=span_orm.parent_id,
        name=span_orm.name,
        start_time_unix_nano=start_ns,
        end_time_unix_nano=end_ns,
        attributes=attributes_kv,
        events=events,
        status=OtlpStatus(code=status_code_enum.to_int(), message=span_orm.status_message or None),
    )
