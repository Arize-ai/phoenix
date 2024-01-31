import asyncio
from functools import partial
from typing import Optional, cast

import pandas as pd
import pyarrow as pa
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.core.evals import Evals
from phoenix.core.traces import Traces
from phoenix.trace.dsl import SpanFilter, SpanQuery
from phoenix.utilities import get_spans_dataframe, query_spans


class GetSpansDataFrameHandler(HTTPEndpoint):
    traces: Traces
    evals: Optional[Evals] = None

    async def post(self, request: Request) -> Response:
        payload = await request.json()
        filter_condition = cast(str, payload.pop("filter_condition", None) or "")
        loop = asyncio.get_running_loop()
        valid_eval_names = (
            await loop.run_in_executor(
                None,
                self.evals.get_span_evaluation_names,
            )
            if self.evals
            else ()
        )
        try:
            span_filter = SpanFilter(
                filter_condition,
                evals=self.evals,
                valid_eval_names=valid_eval_names,
            )
        except Exception as e:
            return Response(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content=f"Invalid filter condition: {e}",
            )
        df = await loop.run_in_executor(
            None,
            partial(
                get_spans_dataframe,
                self.traces,
                span_filter,
                start_time=payload.get("start_time"),
                stop_time=payload.get("stop_time"),
                root_spans_only=payload.get("root_spans_only"),
            ),
        )
        if df is None:
            return Response(status_code=HTTP_404_NOT_FOUND)
        return Response(
            content=_df_to_bytes(df),
            media_type="application/x-pandas-arrow",
        )


class QuerySpansHandler(HTTPEndpoint):
    traces: Traces
    evals: Optional[Evals] = None

    async def post(self, request: Request) -> Response:
        payload = await request.json()
        queries = payload.pop("queries", [])
        loop = asyncio.get_running_loop()
        valid_eval_names = (
            await loop.run_in_executor(
                None,
                self.evals.get_span_evaluation_names,
            )
            if self.evals
            else ()
        )
        try:
            span_queries = [
                SpanQuery.from_dict(
                    query,
                    evals=self.evals,
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
                self.traces,
                *span_queries,
                start_time=payload.get("start_time"),
                stop_time=payload.get("stop_time"),
                root_spans_only=payload.get("root_spans_only"),
            ),
        )
        if not results:
            return Response(status_code=HTTP_404_NOT_FOUND)
        return Response(
            content=b"".join(_df_to_bytes(df) for df in results),
            media_type="application/x-pandas-arrow",
        )


def _df_to_bytes(df: pd.DataFrame) -> bytes:
    pa_table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, pa_table.schema) as writer:
        writer.write_table(pa_table, max_chunksize=65536)
    return cast(bytes, sink.getvalue().to_pybytes())
