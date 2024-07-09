import gzip
import zlib
from datetime import datetime
from typing import Any, Dict, List

from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from sqlalchemy import select
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import State
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.trace.otel import decode_otlp_span
from phoenix.utilities.project import get_project_name


async def post_traces(request: Request) -> Response:
    """
    summary: Send traces to Phoenix
    operationId: addTraces
    tags:
      - private
    requestBody:
      required: true
      content:
        application/x-protobuf:
          schema:
            type: string
            format: binary
    responses:
      200:
        description: Success
      403:
        description: Forbidden
      415:
        description: Unsupported content type, only gzipped protobuf
      422:
        description: Request body is invalid
    """
    content_type = request.headers.get("content-type")
    if content_type != "application/x-protobuf":
        return Response(
            content=f"Unsupported content type: {content_type}",
            status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )
    content_encoding = request.headers.get("content-encoding")
    if content_encoding and content_encoding not in ("gzip", "deflate"):
        return Response(
            content=f"Unsupported content encoding: {content_encoding}",
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
        return Response(
            content="Request body is invalid ExportTraceServiceRequest",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return Response(background=BackgroundTask(_add_spans, req, request.state))


async def annotate_traces(request: Request) -> Response:
    """
    summary: Upsert annotations for traces
    operationId: annotateTraces
    tags:
      - private
    requestBody:
      description: List of trace annotations to be inserted
      required: true
      content:
        application/json:
          schema:
            type: array
            items:
              type: object
              properties:
                trace_id:
                  type: string
                  description: The ID of the trace being annotated
                name:
                  type: string
                  description: The name of the annotation
                annotator_kind:
                  type: string
                  description: The kind of annotator used for the annotation ("LLM" or "HUMAN")
                result:
                  type: object
                  description: The result of the annotation
                  properties:
                    label:
                      type: string
                      description: The label assigned by the annotation
                    score:
                      type: number
                      format: float
                      description: The score assigned by the annotation
                    explanation:
                      type: string
                      description: Explanation of the annotation result
                error:
                  type: string
                  description: Optional error message if the annotation encountered an error
                metadata:
                  type: object
                  description: Metadata for the annotation
                  additionalProperties:
                    type: string
              required:
                - trace_id
                - name
                - annotator_kind
    responses:
      200:
        description: Trace annotations inserted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                        description: The ID of the inserted trace annotation
      404:
        description: Trace not found
    """
    payload: List[Dict[str, Any]] = await request.json()
    trace_gids = [GlobalID.from_id(annotation["trace_id"]) for annotation in payload]

    resolved_trace_ids = []
    for trace_gid in trace_gids:
        try:
            resolved_trace_ids.append(from_global_id_with_expected_type(trace_gid, "Trace"))
        except ValueError:
            return Response(
                content="Trace with ID {trace_gid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        traces = await session.execute(
            select(models.Trace).filter(models.Trace.id.in_(resolved_trace_ids))
        )
        existing_trace_ids = {trace.id for trace in traces.scalars()}

        missing_trace_ids = set(resolved_trace_ids) - existing_trace_ids
        if missing_trace_ids:
            missing_trace_gids = [
                str(GlobalID("Trace", str(trace_gid))) for trace_gid in missing_trace_ids
            ]
            return Response(
                content=f"Traces with IDs {', '.join(missing_trace_gids)} do not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )

        inserted_annotations = []

        for annotation in payload:
            trace_gid = GlobalID.from_id(annotation["trace_id"])
            trace_id = from_global_id_with_expected_type(trace_gid, "Trace")

            name = annotation["name"]
            annotator_kind = annotation["annotator_kind"]
            result = annotation.get("result")
            label = result.get("label") if result else None
            score = result.get("score") if result else None
            explanation = result.get("explanation") if result else None
            error = annotation.get("error")
            metadata = annotation.get("metadata") or {}

            values = dict(
                trace_rowid=trace_id,
                name=name,
                label=label,
                score=score,
                explanation=explanation,
                error=error,
                annotator_kind=annotator_kind,
                metadata_=metadata,
            )
            set_ = {
                **{k: v for k, v in values.items() if k != "metadata_"},
                "metadata": values["metadata_"],
            }

            dialect = SupportedSQLDialect(session.bind.dialect.name)
            trace_annotation = await session.scalar(
                insert_on_conflict(
                    dialect=dialect,
                    table=models.TraceAnnotation,
                    values=values,
                    constraint="uq_trace_annotations_trace_rowid_name",
                    column_names=("trace_rowid", "name"),
                    on_conflict=OnConflict.DO_UPDATE,
                    set_=set_,
                ).returning(models.TraceAnnotation)
            )
            inserted_annotations.append(
                {"id": str(GlobalID("TraceAnnotation", str(trace_annotation.id)))}
            )

    return JSONResponse(content={"data": inserted_annotations})


async def _add_spans(req: ExportTraceServiceRequest, state: State) -> None:
    for resource_spans in req.resource_spans:
        project_name = get_project_name(resource_spans.resource.attributes)
        for scope_span in resource_spans.scope_spans:
            for otlp_span in scope_span.spans:
                span = await run_in_threadpool(decode_otlp_span, otlp_span)
                await state.queue_span_for_bulk_insert(span, project_name)
