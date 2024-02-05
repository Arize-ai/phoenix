import asyncio
import gzip
from typing import AsyncIterator

from google.protobuf.message import DecodeError
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)

import phoenix.trace.v1 as pb
from phoenix.core.evals import Evals
from phoenix.server.api.routers.utils import table_to_bytes


class EvaluationHandler(HTTPEndpoint):
    evals: Evals

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
        self.evals.put(evaluation)
        return Response()

    async def get(self, _: Request) -> Response:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            self.evals.export_evaluations,
        )
        if not results:
            return Response(status_code=HTTP_404_NOT_FOUND)

        async def content() -> AsyncIterator[bytes]:
            for result in results:
                yield await loop.run_in_executor(
                    None,
                    lambda: table_to_bytes(result.to_pyarrow_table()),
                )

        return StreamingResponse(
            content=content(),
            media_type="application/x-pandas-arrow",
        )
