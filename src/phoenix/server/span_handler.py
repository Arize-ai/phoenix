import gzip
from typing import Protocol

from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response

import phoenix.trace.v1 as pb
from phoenix.trace.schemas import Span
from phoenix.trace.span_json_decoder import json_to_span
from phoenix.trace.v1.utils import encode


class SupportsPutSpan(Protocol):
    def put(self, span: pb.Span) -> None:
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
                pb_span = pb.Span()
                pb_span.ParseFromString(body)
            else:
                span = json_to_span(await request.json())
                assert isinstance(span, Span)
                pb_span = encode(span)
        except Exception:
            return Response(status_code=422)
        self.queue.put(pb_span)
        return Response()
