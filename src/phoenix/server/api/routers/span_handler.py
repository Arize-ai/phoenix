import asyncio
import gzip
from datetime import datetime
from functools import partial
from typing import AsyncIterator, Optional, cast

import opentelemetry.proto.trace.v1.trace_pb2 as otlp
import pandas as pd
import pyarrow as pa
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response, StreamingResponse
from starlette.status import HTTP_404_NOT_FOUND, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.core.evals import Evals
from phoenix.core.traces import Traces
from phoenix.trace.dsl import SpanQuery
from phoenix.trace.otel import encode
from phoenix.trace.schemas import Span
from phoenix.trace.span_json_decoder import json_to_span
from phoenix.utilities import query_spans


class SpanHandler(HTTPEndpoint):
    traces: Traces
    evals: Optional[Evals] = None

    async def post(self, request: Request) -> Response:
        try:
            content_type = request.headers.get("content-type")
            if content_type == "application/x-protobuf":
                body = await request.body()
                content_encoding = request.headers.get("content-encoding")
                if content_encoding == "gzip":
                    body = gzip.decompress(body)
                otlp_span = otlp.Span()
                otlp_span.ParseFromString(body)
            else:
                span = json_to_span(await request.json())
                assert isinstance(span, Span)
                otlp_span = encode(span)
        except Exception:
            return Response(status_code=422)
        self.traces.put(otlp_span)
        return Response()

    async def get(self, request: Request) -> Response:
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
                start_time=_from_iso_format(payload.get("start_time")),
                stop_time=_from_iso_format(payload.get("stop_time")),
                root_spans_only=payload.get("root_spans_only"),
            ),
        )
        if not results:
            return Response(status_code=HTTP_404_NOT_FOUND)

        async def content() -> AsyncIterator[bytes]:
            for result in results:
                yield _df_to_bytes(result)

        return StreamingResponse(
            content=content(),
            media_type="application/x-pandas-arrow",
        )


def _from_iso_format(value: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(value) if value else None


def _df_to_bytes(df: pd.DataFrame) -> bytes:
    pa_table = pa.Table.from_pandas(df)
    return _table_to_bytes(pa_table)


def _table_to_bytes(table: pa.Table) -> bytes:
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    return cast(bytes, sink.getvalue().to_pybytes())
