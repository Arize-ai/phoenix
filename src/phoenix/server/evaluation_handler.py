import gzip
from typing import Protocol

from google.protobuf.message import DecodeError
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_422_UNPROCESSABLE_ENTITY

import phoenix.trace.v1 as pb


class SupportsPutEvaluation(Protocol):
    def put(self, evaluation: pb.Evaluation) -> None:
        ...


class EvaluationHandler(HTTPEndpoint):
    queue: SupportsPutEvaluation

    async def post(self, request: Request) -> Response:
        content_type = request.headers.get("content-type")
        if content_type != "application/x-protobuf":
            return Response(
                content="Unsupported content type",
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        body = await request.body()
        content_encoding = request.headers.get("content-encoding")
        if content_encoding == "gzip":
            body = gzip.decompress(body)
        elif content_encoding:
            return Response(
                content="Unsupported content encoding",
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        evaluation = pb.Evaluation()
        try:
            evaluation.ParseFromString(body)
        except DecodeError:
            return Response(
                content="Request body is invalid",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        self.queue.put(evaluation)
        return Response()
