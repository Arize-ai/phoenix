import asyncio
from functools import partial
from typing import AsyncIterator, Optional, cast

import pandas as pd
import pyarrow as pa
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
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

        async def content() -> AsyncIterator[bytes]:
            async for batch in _df_to_bytes(df):
                yield batch

        return StreamingResponse(
            content=content(),
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

        async def content() -> AsyncIterator[bytes]:
            for result in results:
                async for batch in _df_to_bytes(result):
                    yield batch

        return StreamingResponse(
            content=content(),
            media_type="application/x-pandas-arrow",
        )


class GetEvaluationsHandler(HTTPEndpoint):
    evals: Evals

    async def post(self, _: Request) -> Response:
        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            self.evals.export_evaluations,
        )
        if not results:
            return Response(status_code=HTTP_404_NOT_FOUND)

        async def content() -> AsyncIterator[bytes]:
            for result in results:
                table = await loop.run_in_executor(
                    None,
                    result.to_pyarrow_table,
                )
                async for batch in _table_to_bytes(table):
                    yield batch

        return StreamingResponse(
            content=content(),
            media_type="application/x-pandas-arrow",
        )


async def _df_to_bytes(df: pd.DataFrame) -> AsyncIterator[bytes]:
    loop = asyncio.get_running_loop()
    pa_table = await loop.run_in_executor(None, pa.Table.from_pandas, df)
    async for batch in _table_to_bytes(pa_table):
        yield batch


async def _table_to_bytes(table: pa.Table) -> AsyncIterator[bytes]:
    loop = asyncio.get_running_loop()
    for batch in table.to_batches():
        sink = pa.BufferOutputStream()
        with pa.ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
            await loop.run_in_executor(None, writer.write_batch, batch)
        yield cast(bytes, await loop.run_in_executor(None, lambda: sink.getvalue().to_pybytes()))
