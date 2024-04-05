import asyncio
import gzip
import zlib
from typing import AsyncContextManager, Callable, Optional, cast

from google.protobuf.message import DecodeError
from openinference.semconv.trace import SpanAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from sqlalchemy import func, insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.endpoints import HTTPEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_415_UNSUPPORTED_MEDIA_TYPE, HTTP_422_UNPROCESSABLE_ENTITY

from phoenix.core.traces import Traces
from phoenix.db import models
from phoenix.storage.span_store import SpanStore
from phoenix.trace.otel import decode
from phoenix.trace.schemas import Span, SpanStatusCode
from phoenix.utilities.project import get_project_name


class TraceHandler(HTTPEndpoint):
    db: Callable[[], AsyncContextManager[AsyncSession]]
    traces: Traces
    store: Optional[SpanStore]

    async def post(self, request: Request) -> Response:
        content_type = request.headers.get("content-type")
        if content_type != "application/x-protobuf":
            return Response(
                content=f"Unsupported content type: {content_type}",
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        content_encoding = request.headers.get("content-encoding")
        if content_encoding and content_encoding not in ("gzip", "deflate"):
            return Response(
                content=f"Unsupported content encoding: {content_encoding}",
                status_code=HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )
        body = await request.body()
        if content_encoding == "gzip":
            body = gzip.decompress(body)
        elif content_encoding == "deflate":
            body = zlib.decompress(body)
        req = ExportTraceServiceRequest()
        try:
            req.ParseFromString(body)
        except DecodeError:
            return Response(
                content="Request body is invalid ExportTraceServiceRequest",
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if self.store:
            self.store.save(TracesData(resource_spans=req.resource_spans))
        for resource_spans in req.resource_spans:
            project_name = get_project_name(resource_spans.resource.attributes)
            for scope_span in resource_spans.scope_spans:
                for otlp_span in scope_span.spans:
                    span = decode(otlp_span)
                    async with self.db() as session:
                        await _insert_span(session, span, project_name)
                    self.traces.put(span, project_name=project_name)
                    await asyncio.sleep(0)
        return Response()


async def _insert_span(session: AsyncSession, span: Span, project_name: str) -> None:
    if not (
        project_rowid := await session.scalar(
            select(models.Project.id).filter(models.Project.name == project_name)
        )
    ):
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_name).returning(models.Project.id)
        )
    if (
        trace_rowid := await session.scalar(
            text(
                """
                INSERT INTO traces(trace_id, project_rowid, session_id, start_time, end_time)
                VALUES(:trace_id, :project_rowid, :session_id, :start_time, :end_time)
                ON CONFLICT DO UPDATE SET
                start_time = CASE WHEN excluded.start_time < start_time THEN excluded.start_time ELSE start_time END,
                end_time = CASE WHEN end_time < excluded.end_time THEN excluded.end_time ELSE end_time END
                WHERE excluded.start_time < start_time OR end_time < excluded.end_time
                RETURNING rowid;
                """  # noqa E501
            ),
            {
                "trace_id": span.context.trace_id,
                "project_rowid": project_rowid,
                "session_id": None,
                "start_time": span.start_time,
                "end_time": span.end_time,
            },
        )
    ) is None:
        trace_rowid = await session.scalar(
            select(models.Trace.id).filter(models.Trace.trace_id == span.context.trace_id)
        )
    cumulative_error_count = int(span.status_code is SpanStatusCode.ERROR)
    cumulative_llm_token_count_prompt = cast(
        int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_PROMPT, 0)
    )
    cumulative_llm_token_count_completion = cast(
        int, span.attributes.get(SpanAttributes.LLM_TOKEN_COUNT_COMPLETION, 0)
    )
    if accumulation := (
        await session.execute(
            select(
                func.sum(models.Span.cumulative_error_count),
                func.sum(models.Span.cumulative_llm_token_count_prompt),
                func.sum(models.Span.cumulative_llm_token_count_completion),
            ).where(models.Span.parent_span_id == span.context.span_id)
        )
    ).first():
        cumulative_error_count += cast(int, accumulation[0] or 0)
        cumulative_llm_token_count_prompt += cast(int, accumulation[1] or 0)
        cumulative_llm_token_count_completion += cast(int, accumulation[2] or 0)
    latency_ms = (span.end_time - span.start_time).total_seconds() * 1000
    session.add(
        models.Span(
            span_id=span.context.span_id,
            trace_rowid=trace_rowid,
            parent_span_id=span.parent_id,
            kind=span.span_kind.value,
            name=span.name,
            start_time=span.start_time,
            end_time=span.end_time,
            attributes=span.attributes,
            events=span.events,
            status=span.status_code.value,
            status_message=span.status_message,
            latency_ms=latency_ms,
            cumulative_error_count=cumulative_error_count,
            cumulative_llm_token_count_prompt=cumulative_llm_token_count_prompt,
            cumulative_llm_token_count_completion=cumulative_llm_token_count_completion,
        )
    )
    # Propagate cumulative values to ancestors. This is usually a no-op, since
    # the parent usually arrives after the child. But in the event that a
    # child arrives after its parent, we need to make sure the all the
    # ancestors' cumulative values are updated.
    ancestors = (
        select(models.Span.id, models.Span.parent_span_id)
        .where(models.Span.span_id == span.parent_id)
        .cte(recursive=True)
    )
    child = ancestors.alias()
    ancestors = ancestors.union_all(
        select(models.Span.id, models.Span.parent_span_id).join(
            child, models.Span.span_id == child.c.parent_span_id
        )
    )
    await session.execute(
        update(models.Span)
        .where(models.Span.id.in_(select(ancestors.c.id)))
        .values(
            cumulative_error_count=models.Span.cumulative_error_count + cumulative_error_count,
            cumulative_llm_token_count_prompt=models.Span.cumulative_llm_token_count_prompt
            + cumulative_llm_token_count_prompt,
            cumulative_llm_token_count_completion=models.Span.cumulative_llm_token_count_completion
            + cumulative_llm_token_count_completion,
        )
    )
