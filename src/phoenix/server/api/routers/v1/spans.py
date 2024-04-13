import asyncio
from functools import partial
from typing import AsyncIterator

from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.core.traces import Traces
from phoenix.server.api.routers.utils import df_to_bytes, from_iso_format
from phoenix.trace.dsl import SpanQuery
from phoenix.utilities import query_spans


# TODO: Add property details to SpanQuery schema
async def query_spans_handler(request: Request) -> Response:
    """
    summary: Query spans using query DSL
    operationId: querySpans
    tags:
      - spans
    parameters:
      - name: project-name
        in: query
        schema:
          type: string
        description: The project name to get evaluations from
        default: default
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              queries:
                type: array
                items:
                  type: object
                  properties:
                    select:
                      type: object
                    filter:
                      type: object
                    explode:
                      type: object
                    concat:
                      type: object
                    rename:
                      type: object
                    index:
                      type: object
              start_time:
                type: string
                format: date-time
              stop_time:
                type: string
                format: date-time
              root_spans_only:
                type: boolean
    responses:
      200:
        description: Success
      404:
        description: Not found
      422:
        description: Request body is invalid
    """
    traces: Traces = request.app.state.traces
    payload = await request.json()
    queries = payload.pop("queries", [])
    project_name = (
        request.query_params.get("project-name")
        # read from headers for backwards compatibility
        or request.headers.get("project-name")
        or DEFAULT_PROJECT_NAME
    )
    if not (project := traces.get_project(project_name)):
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


async def get_spans_handler(request: Request) -> Response:
    """
    summary: Deprecated route for querying for spans, use the POST method instead
    operationId: legacyQuerySpans
    deprecated: true
    """
    traces: Traces = request.app.state.traces
    payload = await request.json()
    queries = payload.pop("queries", [])
    project_name = request.query_params.get("project_name", DEFAULT_PROJECT_NAME)
    if not (project := traces.get_project(project_name)):
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
