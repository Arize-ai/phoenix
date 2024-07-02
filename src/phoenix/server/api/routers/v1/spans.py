from datetime import timezone
from typing import AsyncIterator

from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.datetime_utils import normalize_datetime
from phoenix.server.api.routers.utils import df_to_bytes, from_iso_format
from phoenix.trace.dsl import SpanQuery

DEFAULT_SPAN_LIMIT = 1000


# TODO: Add property details to SpanQuery schema
async def query_spans_handler(request: Request) -> Response:
    """
    summary: Query spans using query DSL
    operationId: querySpans
    tags:
      - private
    parameters:
      - name: project_name
        in: query
        schema:
          type: string
          default: default
        description: The project name to get evaluations from
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
              end_time:
                type: string
                format: date-time
                nullable: true
              limit:
                type: integer
                nullable: true
                default: 1000
              root_spans_only:
                type: boolean
                nullable: true
    responses:
      200:
        description: Success
      403:
        description: Forbidden
      404:
        description: Not found
      422:
        description: Request body is invalid
    """
    payload = await request.json()
    queries = payload.pop("queries", [])
    project_name = (
        request.query_params.get("project_name")
        or request.query_params.get("project-name")  # for backward compatibility
        or request.headers.get(
            "project-name"
        )  # read from headers/payload for backward-compatibility
        or payload.get("project_name")
        or DEFAULT_PROJECT_NAME
    )
    end_time = payload.get("end_time") or payload.get("stop_time")
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
                    start_time=normalize_datetime(
                        from_iso_format(payload.get("start_time")),
                        timezone.utc,
                    ),
                    end_time=normalize_datetime(
                        from_iso_format(end_time),
                        timezone.utc,
                    ),
                    limit=payload.get("limit", DEFAULT_SPAN_LIMIT),
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
    return await query_spans_handler(request)
