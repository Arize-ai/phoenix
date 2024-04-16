import asyncio
import gzip
from typing import AsyncContextManager, AsyncIterator, Callable

import pandas as pd
import pyarrow as pa
from google.protobuf.message import DecodeError
from pandas import DataFrame
from sqlalchemy import and_, select
from sqlalchemy.engine import Connectable
from sqlalchemy.ext.asyncio import (
    AsyncSession,
)
from starlette.background import BackgroundTask
from starlette.datastructures import State
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import (
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_415_UNSUPPORTED_MEDIA_TYPE,
    HTTP_422_UNPROCESSABLE_ENTITY,
)
from typing_extensions import TypeAlias

import phoenix.trace.v1 as pb
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.core.traces import Traces
from phoenix.db import models
from phoenix.server.api.routers.utils import table_to_bytes
from phoenix.session.evaluation import encode_evaluations
from phoenix.trace.span_evaluations import Evaluations, SpanEvaluations

EvaluationName: TypeAlias = str


async def post_evaluations(request: Request) -> Response:
    """
    summary: Add evaluations to a span, trace, or document
    operationId: addEvaluations
    tags:
      - evaluations
    parameters:
      - name: project-name
        in: query
        schema:
          type: string
        description: The project name to add the evaluation to
        default: default
    requestBody:
      required: true
      content:
        application/x-protobuf:
          schema:
            type: string
            format: binary
        application/x-pandas-arrow:
          schema:
            type: string
            format: binary
    responses:
      200:
        description: Success
      403:
        description: Forbidden
      415:
        description: Unsupported content type, only gzipped protobuf and pandas-arrow are supported
      422:
        description: Request body is invalid
    """
    if request.app.state.read_only:
        return Response(status_code=HTTP_403_FORBIDDEN)
    traces: Traces = request.app.state.traces
    content_type = request.headers.get("content-type")
    project_name = (
        request.query_params.get("project-name")
        # read from headers for backwards compatibility
        or request.headers.get("project-name")
        or DEFAULT_PROJECT_NAME
    )
    if content_type == "application/x-pandas-arrow":
        return await _process_pyarrow(request, project_name, traces)
    if content_type != "application/x-protobuf":
        return Response("Unsupported content type", status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    body = await request.body()
    content_encoding = request.headers.get("content-encoding")
    if content_encoding == "gzip":
        body = gzip.decompress(body)
    elif content_encoding:
        return Response("Unsupported content encoding", status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE)
    evaluation = pb.Evaluation()
    try:
        evaluation.ParseFromString(body)
    except DecodeError:
        return Response("Request body is invalid", status_code=HTTP_422_UNPROCESSABLE_ENTITY)
    traces.put(evaluation, project_name=project_name)
    return Response()


async def get_evaluations(request: Request) -> Response:
    """
    summary: Get evaluations from Phoenix
    operationId: getEvaluation
    tags:
      - evaluations
    parameters:
      - name: project-name
        in: query
        schema:
          type: string
        description: The project name to get evaluations from
        default: default
    responses:
      200:
        description: Success
      404:
        description: Not found
    """
    project_name = (
        request.query_params.get("project_name")
        # read from headers for backwards compatibility
        or request.headers.get("project-name")
        or DEFAULT_PROJECT_NAME
    )

    db: Callable[[], AsyncContextManager[AsyncSession]] = request.app.state.db
    async with db() as session:
        connection = await session.connection()
        span_evals_dataframe = await connection.run_sync(
            _read_sql_span_evaluations_into_dataframe,
            project_name,
        )
    if span_evals_dataframe.empty:
        return Response(status_code=HTTP_404_NOT_FOUND)

    loop = asyncio.get_running_loop()

    async def content() -> AsyncIterator[bytes]:
        for eval_name, span_evals_dataframe_for_name in span_evals_dataframe.groupby(
            "name", as_index=False
        ):
            span_evals = SpanEvaluations(str(eval_name), span_evals_dataframe_for_name)
            yield await loop.run_in_executor(
                None, lambda: table_to_bytes(span_evals.to_pyarrow_table())
            )

    return StreamingResponse(content=content(), media_type="application/x-pandas-arrow")


async def _process_pyarrow(request: Request, project_name: str, traces: Traces) -> Response:
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
            _add_evaluations, request.state, evaluations, project_name, traces
        )
    )


async def _add_evaluations(
    state: State, evaluations: Evaluations, project_name: str, traces: Traces
) -> None:
    for evaluation in encode_evaluations(evaluations):
        state.queue_evaluation_for_bulk_insert(evaluation)
        traces.put(evaluation, project_name=project_name)


def _read_sql_span_evaluations_into_dataframe(
    connectable: Connectable,
    project_name: str,
) -> DataFrame:
    """
    This function inputs a synchronous connection to pandas.read_sql since
    it does not support async connections.

    For more information, see:

    https://stackoverflow.com/questions/70848256/how-can-i-use-pandas-read-sql-on-an-async-connection
    """
    return pd.read_sql(
        select(models.SpanAnnotation, models.Span.span_id)
        .join(models.Span)
        .join(models.Trace)
        .join(models.Project)
        .where(
            and_(
                models.Project.name == project_name,
                models.SpanAnnotation.annotator_kind == "LLM",
            )
        ),
        connectable,
        index_col="span_id",
    )
