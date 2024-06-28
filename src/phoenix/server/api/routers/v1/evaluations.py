import gzip
from itertools import chain
from typing import AsyncContextManager, Callable, Iterator, Tuple

import pandas as pd
import pyarrow as pa
from google.protobuf.message import DecodeError
from pandas import DataFrame
from sqlalchemy import select
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
from phoenix.db import models
from phoenix.exceptions import PhoenixEvaluationNameIsMissing
from phoenix.server.api.routers.utils import table_to_bytes
from phoenix.session.evaluation import encode_evaluations
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    Evaluations,
    SpanEvaluations,
    TraceEvaluations,
)

EvaluationName: TypeAlias = str


async def post_evaluations(request: Request) -> Response:
    """
    summary: Add evaluations to a span, trace, or document
    operationId: addEvaluations
    tags:
      - private
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
    content_type = request.headers.get("content-type")
    if content_type == "application/x-pandas-arrow":
        return await _process_pyarrow(request)
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
    if not evaluation.name.strip():
        return Response(
            "Evaluation name must not be blank/empty",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    await request.state.queue_evaluation_for_bulk_insert(evaluation)
    return Response()


async def get_evaluations(request: Request) -> Response:
    """
    summary: Get evaluations from Phoenix
    operationId: getEvaluation
    tags:
      - private
    parameters:
      - name: project_name
        in: query
        schema:
          type: string
          default: default
        description: The project name to get evaluations from
    responses:
      200:
        description: Success
      403:
        description: Forbidden
      404:
        description: Not found
    """
    project_name = (
        request.query_params.get("project_name")
        or request.query_params.get("project-name")  # for backward compatibility
        or request.headers.get("project-name")  # read from headers for backwards compatibility
        or DEFAULT_PROJECT_NAME
    )

    db: Callable[[], AsyncContextManager[AsyncSession]] = request.app.state.db
    async with db() as session:
        connection = await session.connection()
        trace_evals_dataframe = await connection.run_sync(
            _read_sql_trace_evaluations_into_dataframe,
            project_name,
        )
        span_evals_dataframe = await connection.run_sync(
            _read_sql_span_evaluations_into_dataframe,
            project_name,
        )
        document_evals_dataframe = await connection.run_sync(
            _read_sql_document_evaluations_into_dataframe,
            project_name,
        )
    if (
        trace_evals_dataframe.empty
        and span_evals_dataframe.empty
        and document_evals_dataframe.empty
    ):
        return Response(status_code=HTTP_404_NOT_FOUND)

    evals = chain(
        map(
            lambda args: TraceEvaluations(*args),
            _groupby_eval_name(trace_evals_dataframe),
        ),
        map(
            lambda args: SpanEvaluations(*args),
            _groupby_eval_name(span_evals_dataframe),
        ),
        map(
            lambda args: DocumentEvaluations(*args),
            _groupby_eval_name(document_evals_dataframe),
        ),
    )
    bytestream = map(lambda evals: table_to_bytes(evals.to_pyarrow_table()), evals)
    return StreamingResponse(
        content=bytestream,
        media_type="application/x-pandas-arrow",
    )


async def _process_pyarrow(request: Request) -> Response:
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
    except Exception as e:
        if isinstance(e, PhoenixEvaluationNameIsMissing):
            return Response(
                "Evaluation name must not be blank/empty",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        return Response(
            content="Invalid data in request body",
            status_code=HTTP_422_UNPROCESSABLE_ENTITY,
        )
    return Response(background=BackgroundTask(_add_evaluations, request.state, evaluations))


async def _add_evaluations(state: State, evaluations: Evaluations) -> None:
    for evaluation in encode_evaluations(evaluations):
        await state.queue_evaluation_for_bulk_insert(evaluation)


def _read_sql_trace_evaluations_into_dataframe(
    connectable: Connectable,
    project_name: str,
) -> DataFrame:
    """
    Reads a project's trace evaluations into a pandas dataframe.

    Inputs a synchronous connectable to pandas.read_sql since it does not
    support async connectables. For more information, see:

    https://stackoverflow.com/questions/70848256/how-can-i-use-pandas-read-sql-on-an-async-connection
    """
    return pd.read_sql(
        select(models.TraceAnnotation, models.Trace.trace_id)
        .join_from(models.TraceAnnotation, models.Trace)
        .join_from(models.Trace, models.Project)
        .where(models.Project.name == project_name)
        .where(models.TraceAnnotation.annotator_kind == "LLM"),
        connectable,
        index_col="trace_id",
    )


def _read_sql_span_evaluations_into_dataframe(
    connectable: Connectable,
    project_name: str,
) -> DataFrame:
    """
    Reads a project's span evaluations into a pandas dataframe.

    Inputs a synchronous connectable to pandas.read_sql since it does not
    support async connectables. For more information, see:

    https://stackoverflow.com/questions/70848256/how-can-i-use-pandas-read-sql-on-an-async-connection
    """
    return pd.read_sql_query(
        select(models.SpanAnnotation, models.Span.span_id)
        .join_from(models.SpanAnnotation, models.Span)
        .join_from(models.Span, models.Trace)
        .join_from(models.Trace, models.Project)
        .where(models.Project.name == project_name)
        .where(models.SpanAnnotation.annotator_kind == "LLM"),
        connectable,
        index_col="span_id",
    )


def _read_sql_document_evaluations_into_dataframe(
    connectable: Connectable,
    project_name: str,
) -> DataFrame:
    """
    Reads a project's document evaluations into a pandas dataframe.

    Inputs a synchronous connectable to pandas.read_sql since it does not
    support async connectables. For more information, see:

    https://stackoverflow.com/questions/70848256/how-can-i-use-pandas-read-sql-on-an-async-connection
    """
    return pd.read_sql(
        select(models.DocumentAnnotation, models.Span.span_id)
        .join_from(models.DocumentAnnotation, models.Span)
        .join_from(models.Span, models.Trace)
        .join_from(models.Trace, models.Project)
        .where(models.Project.name == project_name)
        .where(models.DocumentAnnotation.annotator_kind == "LLM"),
        connectable,
    ).set_index(["span_id", "document_position"])


def _groupby_eval_name(
    evals_dataframe: DataFrame,
) -> Iterator[Tuple[EvaluationName, DataFrame]]:
    for eval_name, evals_dataframe_for_name in evals_dataframe.groupby("name", as_index=False):
        yield str(eval_name), evals_dataframe_for_name
