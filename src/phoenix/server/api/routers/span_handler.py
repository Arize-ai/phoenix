import asyncio
from functools import partial
from typing import AsyncIterator

from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.core.project import DEFAULT_PROJECT_NAME
from phoenix.core.traces import Traces
from phoenix.server.api.routers.utils import df_to_bytes, from_iso_format
from phoenix.trace.dsl import SpanQuery
from phoenix.utilities import query_spans


class SpanHandler(HTTPEndpoint):
    traces: Traces

    async def get(self, request: Request) -> Response:
        payload = await request.json()
        queries = payload.pop("queries", [])
        project_name = payload.pop("project_name", None) or DEFAULT_PROJECT_NAME
        if not (project := self.traces.get_project(project_name)):
            return Response(status_code=HTTP_404_NOT_FOUND)
        loop = asyncio.get_running_loop()
        valid_eval_names = (
            await loop.run_in_executor(
                None,
                project.get_span_evaluation_names,
            )
            if project
            else ()
        )
        try:
            span_queries = [
                SpanQuery.from_dict(
                    query,
                    evals=project,
                    valid_eval_names=valid_eval_names,
                )
                for query in queries
            ]
        except Exception as e:
            return Response(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content=f"Invalid query: {e}",
            )
        results = await loop.run_in_executor(
            None,
            partial(
                query_spans,
                project,
                *span_queries,
                start_time=from_iso_format(payload.get("start_time")),
                stop_time=from_iso_format(payload.get("stop_time")),
                root_spans_only=payload.get("root_spans_only"),
            ),
        )
        if not results:
            return Response(status_code=HTTP_404_NOT_FOUND)

        async def content() -> AsyncIterator[bytes]:
            for result in results:
                yield df_to_bytes(result)

        return StreamingResponse(
            content=content(),
            media_type="application/x-pandas-arrow",
        )
