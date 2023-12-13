import gzip
from typing import Protocol

import opentelemetry.proto.trace.v1.trace_pb2 as pb
from google.protobuf.json_format import MessageToDict
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SupportsPutSpan(Protocol):
    def put(self, span: pb.Span) -> None:
        ...


class TraceHandler(HTTPEndpoint):
    queue: SupportsPutSpan

    async def post(self, request: Request) -> Response:
        try:
            content_type = request.headers.get("content-type")
            if content_type == "application/x-protobuf":
                body = await request.body()
                content_encoding = request.headers.get("content-encoding")
                if content_encoding == "gzip":
                    body = gzip.decompress(body)
                pb_req = ExportTraceServiceRequest()
                pb_req.ParseFromString(body)
        except Exception:
            return Response(status_code=422)
        _span = MessageToDict(pb_req)
        # self.queue.put(pb_span)
        return Response()

    async def _process_protobuf(self, request: Request) -> Response:
        return Response()
