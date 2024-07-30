import gzip
import zlib
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query
from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from pydantic import Field
from sqlalchemy import select
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request
from starlette.status import (
    HTTP_204_NO_CONTENT,
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import as_kv, insert_on_conflict
from phoenix.db.insertion.types import Precursors
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name

from .pydantic_compat import V1RoutesBaseModel
from .utils import RequestBody, ResponseBody, add_errors_to_responses

router = APIRouter(tags=["traces"], include_in_schema=False)


@router.post(
    "/traces",
    operation_id="addTraces",
    summary="Send traces",
    status_code=HTTP_204_NO_CONTENT,
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
)
async def post_traces(
    request: Request,
    background_tasks: BackgroundTasks,
    content_type: Optional[str] = Header(default=None),
    content_encoding: Optional[str] = Header(default=None),
) -> None:
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
    return None


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
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Metadata for the annotation"
    )

    def as_precursor(self) -> Precursors.TraceAnnotation:
        return Precursors.TraceAnnotation(
            self.trace_id,
            models.TraceAnnotation(
                name=self.name,
                annotator_kind=self.annotator_kind,
                score=self.result.score if self.result else None,
                label=self.result.label if self.result else None,
                explanation=self.result.explanation if self.result else None,
                metadata_=self.metadata or {},
            ),
        )


class AnnotateTracesRequestBody(RequestBody[List[TraceAnnotation]]):
    data: List[TraceAnnotation] = Field(description="The trace annotations to be upserted")


class InsertedTraceAnnotation(V1RoutesBaseModel):
    id: str = Field(description="The ID of the inserted trace annotation")


class AnnotateTracesResponseBody(ResponseBody[List[InsertedTraceAnnotation]]):
    pass


@router.post(
    "/trace_annotations",
    operation_id="annotateTraces",
    summary="Create or update trace annotations",
    responses=add_errors_to_responses(
        [{"status_code": HTTP_404_NOT_FOUND, "description": "Trace not found"}]
    ),
)
async def annotate_traces(
    request: Request,
    request_body: AnnotateTracesRequestBody,
    sync: bool = Query(default=True, description="If true, fulfill request synchronously."),
) -> AnnotateTracesResponseBody:
    precursors = [d.as_precursor() for d in request_body.data]
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

        inserted_annotations = []

        dialect = SupportedSQLDialect(session.bind.dialect.name)
        for p in precursors:
            values = dict(as_kv(p.as_insertable(existing_traces[p.trace_id]).row))
            trace_annotation_id = await session.scalar(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    unique_by=("name", "trace_rowid"),
                ).returning(models.TraceAnnotation.id)
            )
            inserted_annotations.append(
                InsertedTraceAnnotation(
                    id=str(GlobalID("TraceAnnotation", str(trace_annotation_id)))
                )
            )

    return AnnotateTracesResponseBody(data=inserted_annotations)


async def _add_spans(req: ExportTraceServiceRequest, state: State) -> None:
    for resource_spans in req.resource_spans:
        project_name = get_project_name(resource_spans.resource.attributes)
        for scope_span in resource_spans.scope_spans:
            for otlp_span in scope_span.spans:
                span = await run_in_threadpool(decode_otlp_span, otlp_span)
                await state.queue_span_for_bulk_insert(span, project_name)
