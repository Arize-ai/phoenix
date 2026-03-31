from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone

import pandas as pd
from asgi_lifespan import LifespanManager
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    SpanEvaluations,
    TraceEvaluations,
)
from tests.unit.conftest import (
    TestBulkInserter as BulkInserterForStartupTests,
)
from tests.unit.conftest import (
    patch_batched_caller,
    patch_grpc_server,
)


def _make_span(*, trace_id: str, span_id: str) -> Span:
    start_time = datetime.now(timezone.utc)
    return Span(
        name="startup-span",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.RETRIEVER,
        parent_id=None,
        start_time=start_time,
        end_time=start_time + timedelta(seconds=1),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={
            "retrieval": {
                "documents": [
                    {"document": {"content": "doc-0"}},
                    {"document": {"content": "doc-1"}},
                ]
            }
        },
        events=[],
        conversation=None,
    )


async def test_create_app_ingests_initial_evaluations(
    db: DbSessionFactory,
) -> None:
    trace_id = "trace-startup"
    span_id = "span-startup"
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=BulkInserterForStartupTests,
            initial_spans=[_make_span(trace_id=trace_id, span_id=span_id)],
            initial_evaluations=[
                SpanEvaluations(
                    eval_name="startup-span-eval",
                    dataframe=pd.DataFrame(
                        {
                            "context.span_id": [span_id],
                            "score": [0.9],
                        }
                    ),
                ),
                DocumentEvaluations(
                    eval_name="startup-document-eval",
                    dataframe=pd.DataFrame(
                        {
                            "context.span_id": [span_id],
                            "document_position": [1],
                            "label": ["relevant"],
                        }
                    ),
                ),
                TraceEvaluations(
                    eval_name="startup-trace-eval",
                    dataframe=pd.DataFrame(
                        {
                            "context.trace_id": [trace_id],
                            "explanation": ["looks good"],
                        }
                    ),
                ),
            ],
        )
        await stack.enter_async_context(LifespanManager(app))

        async with db() as session:
            trace = await session.scalar(
                select(models.Trace).where(models.Trace.trace_id == trace_id)
            )
            span = await session.scalar(select(models.Span).where(models.Span.span_id == span_id))
            span_annotation = await session.scalar(
                select(models.SpanAnnotation).where(
                    models.SpanAnnotation.name == "startup-span-eval"
                )
            )
            document_annotation = await session.scalar(
                select(models.DocumentAnnotation).where(
                    models.DocumentAnnotation.name == "startup-document-eval"
                )
            )
            trace_annotation = await session.scalar(
                select(models.TraceAnnotation).where(
                    models.TraceAnnotation.name == "startup-trace-eval"
                )
            )

    assert trace is not None
    assert span is not None
    assert span_annotation is not None
    assert document_annotation is not None
    assert trace_annotation is not None
    assert span_annotation.span_rowid == span.id
    assert document_annotation.span_rowid == span.id
    assert document_annotation.document_position == 1
    assert trace_annotation.trace_rowid == trace.id
    assert span_annotation.source == "API"
    assert document_annotation.source == "API"
    assert trace_annotation.source == "API"
