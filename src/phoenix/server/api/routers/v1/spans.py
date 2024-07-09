from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List

from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse, Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.datetime_utils import normalize_datetime
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.routers.utils import df_to_bytes, from_iso_format
from phoenix.server.api.types.node import from_global_id_with_expected_type
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


async def annotate_spans(request: Request) -> Response:
    """
    summary: Upsert annotations for spans
    operationId: annotateSpans
    tags:
      - private
    requestBody:
      description: List of span annotations to be inserted
      required: true
      content:
        application/json:
          schema:
            type: array
            items:
              type: object
              properties:
                span_id:
                  type: string
                  description: The ID of the span being annotated
                name:
                  type: string
                  description: The name of the annotation
                annotator_kind:
                  type: string
                  description: The kind of annotator used for the annotation ("LLM" or "HUMAN")
                result:
                  type: object
                  description: The result of the annotation
                  properties:
                    label:
                      type: string
                      description: The label assigned by the annotation
                    score:
                      type: number
                      format: float
                      description: The score assigned by the annotation
                    explanation:
                      type: string
                      description: Explanation of the annotation result
                error:
                  type: string
                  description: Optional error message if the annotation encountered an error
                metadata:
                  type: object
                  description: Metadata for the annotation
                  additionalProperties:
                    type: string
              required:
                - span_id
                - name
                - annotator_kind
    responses:
      200:
        description: Span annotations inserted successfully
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                        description: The ID of the inserted span annotation
      404:
        description: Span not found
    """
    payload: List[Dict[str, Any]] = await request.json()
    span_gids = [GlobalID.from_id(annotation["span_id"]) for annotation in payload]

    resolved_span_ids = []
    for span_gid in span_gids:
        try:
            resolved_span_ids.append(from_global_id_with_expected_type(span_gid, "Span"))
        except ValueError:
            return Response(
                content="Span with ID {span_gid} does not exist",
                status_code=HTTP_404_NOT_FOUND,
            )

    async with request.app.state.db() as session:
        spans = await session.execute(
            select(models.Span).filter(models.Span.id.in_(resolved_span_ids))
        )
        existing_span_ids = {span.id for span in spans.scalars()}

        missing_span_ids = set(resolved_span_ids) - existing_span_ids
        if missing_span_ids:
            missing_span_gids = [
                str(GlobalID("Span", str(span_gid))) for span_gid in missing_span_ids
            ]
            return Response(
                content=f"Spans with IDs {', '.join(missing_span_gids)} do not exist.",
                status_code=HTTP_404_NOT_FOUND,
            )

        inserted_annotations = []
        for annotation in payload:
            span_gid = GlobalID.from_id(annotation["span_id"])
            span_id = from_global_id_with_expected_type(span_gid, "Span")
            name = annotation["name"]
            annotator_kind = annotation["annotator_kind"]
            result = annotation.get("result")
            label = result.get("label") if result else None
            score = result.get("score") if result else None
            explanation = result.get("explanation") if result else None
            error = annotation.get("error")
            metadata = annotation.get("metadata") or {}

            values = dict(
                span_rowid=span_id,
                name=name,
                label=label,
                score=score,
                explanation=explanation,
                error=error,
                annotator_kind=annotator_kind,
                metadata_=metadata,
            )
            set_ = {
                **{k: v for k, v in values.items() if k != "metadata_"},
                "metadata": values["metadata_"],
            }

            dialect = SupportedSQLDialect(session.bind.dialect.name)
            span_annotation = await session.scalar(
                insert_on_conflict(
                    dialect=dialect,
                    table=models.SpanAnnotation,
                    values=values,
                    constraint="uq_span_annotations_span_rowid_name",
                    column_names=("span_rowid", "name"),
                    on_conflict=OnConflict.DO_UPDATE,
                    set_=set_,
                ).returning(models.SpanAnnotation)
            )
            inserted_annotations.append(
                {"id": str(GlobalID("SpanAnnotation", str(span_annotation.id)))}
            )

    return JSONResponse(content={"data": inserted_annotations})
