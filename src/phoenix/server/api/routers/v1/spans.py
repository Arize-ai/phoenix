from typing import AsyncIterator

from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.server.api.routers.utils import df_to_bytes, from_iso_format
from phoenix.trace.dsl import SpanQuery


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
    payload = await request.json()
    queries = payload.pop("queries", [])
    project_name = (
        request.query_params.get("project-name")
        # read from headers for backwards compatibility
        or request.headers.get("project-name")
        or DEFAULT_PROJECT_NAME
    )
    try:
        span_queries = [SpanQuery.from_dict(query) for query in queries]
    except Exception as e:
        return Response(
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            content=f"Invalid query: {e}",
        )
    async with request.app.state.db() as session:
        results = []
        for query in span_queries:
            results.append(
                await session.run_sync(
                    query,
                    project_name=project_name,
                    start_time=from_iso_format(payload.get("start_time")),
                    stop_time=from_iso_format(payload.get("stop_time")),
                    root_spans_only=payload.get("root_spans_only"),
                )
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
    return await query_spans_handler(request)
