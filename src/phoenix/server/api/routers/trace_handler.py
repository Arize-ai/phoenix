import asyncio
import gzip
import zlib
from typing import Optional

from google.protobuf.message import DecodeError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.core.traces import Traces
from phoenix.storage.span_store import SpanStore
from phoenix.trace.otel import decode
from phoenix.utilities.project import get_project_name


class TraceHandler(HTTPEndpoint):
    traces: Traces
    store: Optional[SpanStore]

    async def post(self, request: Request) -> Response:
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
            body = gzip.decompress(body)
        elif content_encoding == "deflate":
            body = zlib.decompress(body)
        req = ExportTraceServiceRequest()
        try:
            req.ParseFromString(body)
        except DecodeError:
            return Response(
                content="Request body is invalid ExportTraceServiceRequest",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if self.store:
            self.store.save(TracesData(resource_spans=req.resource_spans))
        for resource_spans in req.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            for scope_span in resource_spans.scope_spans:
                for span in scope_span.spans:
                    self.traces.put(decode(span), project_name=project_name)
                    await asyncio.sleep(0)
        return Response()
