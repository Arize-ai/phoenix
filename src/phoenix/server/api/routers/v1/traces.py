import gzip
import zlib
from typing import Any, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Path, Query
from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from pydantic import Field
from sqlalchemy import delete, insert, select
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.insertion.helpers import as_kv
from phoenix.db.insertion.types import Precursors
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.authorization import is_not_locked
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import SpanDeleteEvent, TraceAnnotationInsertEvent
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name

from .models import V1RoutesBaseModel
from .utils import RequestBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["traces"])


@router.post(
    "/traces",
    dependencies=[Depends(is_not_locked)],
    operation_id="addTraces",
    summary="Send traces",
    responses=add_errors_to_responses(
        [
            {
                "status_code": HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                "description": (
                    "Unsupported content type (only `application/x-protobuf` is supported)"
                ),
            },
            {"status_code": HTTP_422_UNPROCESSABLE_ENTITY, "description": "Invalid request body"},
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
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )
    if content_encoding and content_encoding not in ("gzip", "deflate"):
        raise HTTPException(
            detail=f"Unsupported content encoding: {content_encoding}",
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
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
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
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


class TraceAnnotationResult(V1RoutesBaseModel):
    label: Optional[str] = Field(default=None, description="The label assigned by the annotation")
    score: Optional[float] = Field(default=None, description="The score assigned by the annotation")
    explanation: Optional[str] = Field(
        default=None, description="Explanation of the annotation result"
    )


class TraceAnnotation(V1RoutesBaseModel):
    trace_id: str = Field(description="OpenTelemetry Trace ID (hex format w/o 0x prefix)")
    name: str = Field(description="The name of the annotation")
    annotator_kind: Literal["LLM", "HUMAN"] = Field(
        description="The kind of annotator used for the annotation"
    )
    result: Optional[TraceAnnotationResult] = Field(
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

    def as_precursor(self, *, user_id: Optional[int] = None) -> Precursors.TraceAnnotation:
        return Precursors.TraceAnnotation(
            self.trace_id,
            models.TraceAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
                identifier=self.identifier,
                source="APP",
                user_id=user_id,
            ),
        )


class AnnotateTracesRequestBody(RequestBody[list[TraceAnnotation]]):
    data: list[TraceAnnotation] = Field(description="The trace annotations to be upserted")


class InsertedTraceAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted trace annotation")


class AnnotateTracesResponseBody(ResponseBody[list[InsertedTraceAnnotation]]):
    pass


@router.post(
    "/trace_annotations",
    dependencies=[Depends(is_not_locked)],
    operation_id="annotateTraces",
    summary="Create trace annotations",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Trace not found"}]
    ),
    include_in_schema=False,
)
async def annotate_traces(
    request: Request,
    request_body: AnnotateTracesRequestBody,
    sync: bool = Query(default=True, description="If true, fulfill request synchronously."),
) -> AnnotateTracesResponseBody:
    if not request_body.data:
        return AnnotateTracesResponseBody(data=[])

    user_id: Optional[int] = None
    if request.app.state.authentication_enabled and isinstance(request.user, PhoenixUser):
        user_id = int(request.user.identity)

    precursors = [d.as_precursor(user_id=user_id) for d in request_body.data]
    if not sync:
        await request.state.enqueue(*precursors)
        return AnnotateTracesResponseBody(data=[])

    trace_ids = {p.trace_id for p in precursors}
    async with request.app.state.db() as session:
        existing_traces = {
            trace.trace_id: trace.id
            async for trace in await session.stream_scalars(
                select(models.Trace).filter(models.Trace.trace_id.in_(trace_ids))
            )
        }

        missing_trace_ids = trace_ids - set(existing_traces.keys())
        if missing_trace_ids:
            raise HTTPException(
                detail=f"Traces with IDs {', '.join(missing_trace_ids)} do not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )
        inserted_ids = []
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_traces[p.trace_id]).row))
            trace_annotation_id = await session.scalar(
                insert(models.TraceAnnotation).values(**values).returning(models.TraceAnnotation.id)
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
                await state.queue_span_for_bulk_insert(span, project_name)


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
    responses=add_errors_to_responses([HTTP_404_NOT_FOUND]),
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
                status_code=HTTP_404_NOT_FOUND,
                detail=error_detail,
            )

    # Trigger cache invalidation event
    request.state.event_queue.put(SpanDeleteEvent((project_id,)))

    # Return 204 No Content (successful deletion with no response body)
    return None
