from itertools import chain
from typing import Iterator, Optional

import pandas as pd
import pyarrow as pa
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pandas import DataFrame
from sqlalchemy import select
from sqlalchemy.engine import Connectable
from starlette.background import BackgroundTask
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from typing_extensions import TypeAlias

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.exceptions import PhoenixEvaluationNameIsMissing
from phoenix.server.api.routers.utils import table_to_bytes
from phoenix.server.authorization import is_not_locked
from phoenix.server.evaluations import enqueue_annotations_from_evaluations
from phoenix.server.types import DbSessionFactory
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    Evaluations,
    SpanEvaluations,
    TraceEvaluations,
)

from .utils import add_errors_to_responses

EvaluationName: TypeAlias = str

router = APIRouter(tags=["traces"], include_in_schema=True)


@router.post(
    "/evaluations",
    dependencies=[Depends(is_not_locked)],
    operation_id="addEvaluations",
    summary="Add span, trace, or document evaluations",
    status_code=204,
    responses=add_errors_to_responses(
        [
            {
                "status_code": 415,
                "description": "Unsupported content type, only pandas-arrow is supported",
            },
            422,
        ]
    ),
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-pandas-arrow": {"schema": {"type": "string", "format": "binary"}},
            },
        },
    },
)
async def post_evaluations(
    request: Request,
    content_type: Optional[str] = Header(default=None),
) -> Response:
    if content_type != "application/x-pandas-arrow":
        raise HTTPException(detail="Unsupported content type", status_code=415)
    return await _process_pyarrow(request)


@router.get(
    "/evaluations",
    operation_id="getEvaluations",
    summary="Get span, trace, or document evaluations from a project",
    responses=add_errors_to_responses([404]),
)
async def get_evaluations(
    request: Request,
    project_name: Optional[str] = Query(
        default=None,
        description=(
            "The name of the project to get evaluations from (if omitted, "
            f"evaluations will be drawn from the `{DEFAULT_PROJECT_NAME}` project)"
        ),
    ),
) -> Response:
    project_name = (
        project_name
        or request.query_params.get("project-name")  # for backward compatibility
        or request.headers.get("project-name")  # read from headers for backwards compatibility
        or DEFAULT_PROJECT_NAME
    )

    db: DbSessionFactory = request.app.state.db
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
        return Response(status_code=404)

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
        raise HTTPException(
            detail="Request body is not valid pyarrow",
            status_code=422,
        )
    try:
        evaluations = Evaluations.from_pyarrow_reader(reader)
    except Exception as e:
        if isinstance(e, PhoenixEvaluationNameIsMissing):
            raise HTTPException(
                detail="Evaluation name must not be blank/empty",
                status_code=422,
            )
        raise HTTPException(
            detail="Invalid data in request body",
            status_code=422,
        )
    return Response(
        background=BackgroundTask(
            enqueue_annotations_from_evaluations,
            request.state.enqueue_annotations,
            evaluations,
        )
    )


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
) -> Iterator[tuple[EvaluationName, DataFrame]]:
    for eval_name, evals_dataframe_for_name in evals_dataframe.groupby("name", as_index=False):
        yield str(eval_name), evals_dataframe_for_name
