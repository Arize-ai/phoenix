import gzip
from typing import Protocol

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response

from phoenix.trace.otel import encode
from phoenix.trace.schemas import Span
from phoenix.trace.span_json_decoder import json_to_span


class SupportsPutSpan(Protocol):
    def put(self, span: otlp.Span) -> None:
        ...


class SpanHandler(HTTPEndpoint):
    queue: SupportsPutSpan

    async def post(self, request: Request) -> Response:
        try:
            content_type = request.headers.get("content-type")
            if content_type == "application/x-protobuf":
                body = await request.body()
                content_encoding = request.headers.get("content-encoding")
                if content_encoding == "gzip":
                    body = gzip.decompress(body)
                otlp_span = otlp.Span()
                otlp_span.ParseFromString(body)
            else:
                span = json_to_span(await request.json())
                assert isinstance(span, Span)
                otlp_span = encode(span)
        except Exception:
            return Response(status_code=422)
        self.queue.put(otlp_span)
        return Response()
