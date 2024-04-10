import asyncio
import gzip
from typing import AsyncIterator

import pyarrow as pa
from google.protobuf.message import DecodeError
from starlette.background import BackgroundTask
from starlette.datastructures import State
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import (
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)

import phoenix.trace.v1 as pb
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.core.traces import Traces
from phoenix.server.api.routers.utils import table_to_bytes
from phoenix.session.evaluation import encode_evaluations
from phoenix.trace.span_evaluations import Evaluations


class EvaluationHandler(HTTPEndpoint):
    traces: Traces

    async def post(self, request: Request) -> Response:
        content_type = request.headers.get("content-type")
        project_name = request.headers.get("project-name", DEFAULT_PROJECT_NAME)
        if content_type == "application/x-pandas-arrow":
            return await self._process_pyarrow(request, project_name)
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
        self.traces.put(evaluation, project_name=project_name)
        return Response()

    async def get(self, request: Request) -> Response:
        payload = await request.json()
        project_name = payload.pop("project_name", None) or DEFAULT_PROJECT_NAME
        project = self.traces.get_project(project_name)
        if not project:
            return Response(status_code=HTTP_404_NOT_FOUND)
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            project.export_evaluations,
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

    async def _process_pyarrow(self, request: Request, project_name: str) -> Response:
        body = await request.body()
        try:
            reader = pa.ipc.open_stream(body)
        except pa.ArrowInvalid:
            return Response(
                content="Request body is not valid pyarrow",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        try:
            evaluations = Evaluations.from_pyarrow_reader(reader)
        except Exception:
            return Response(
                content="Invalid data in request body",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(
            background=BackgroundTask(
                self._add_evaluations,
                request.state,
                evaluations,
                project_name,
            )
        )

    async def _add_evaluations(
        self, state: State, evaluations: Evaluations, project_name: str
    ) -> None:
        for evaluation in encode_evaluations(evaluations):
            state.queue_evaluation_for_bulk_insert(evaluation)
            self.traces.put(evaluation, project_name=project_name)
