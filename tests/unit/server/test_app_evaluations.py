from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.app import create_app
from phoenix.server.types import DbSessionFactory
from phoenix.trace.fixtures import (
    evaluations_to_precursors,
)
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
    now = datetime.now(timezone.utc)
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=BulkInserterForStartupTests,
            initial_spans=[_make_span(trace_id=trace_id, span_id=span_id)],
            initial_annotation_precursors=[
                Precursors.SpanAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    obj=models.SpanAnnotation(
                        name="startup-span-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=0.9,
                        label=None,
                        explanation=None,
                        metadata_={},
                    ),
                ),
                Precursors.DocumentAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    document_position=1,
                    obj=models.DocumentAnnotation(
                        document_position=1,
                        name="startup-document-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label="relevant",
                        explanation=None,
                        metadata_={},
                    ),
                ),
                Precursors.TraceAnnotation(
                    updated_at=now,
                    trace_id=trace_id,
                    obj=models.TraceAnnotation(
                        name="startup-trace-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label=None,
                        explanation="looks good",
                        metadata_={},
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


def test_evaluations_to_precursors_span() -> None:
    span_id = "abc123"
    evals = SpanEvaluations(
        eval_name="my-eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": [span_id],
                "score": [0.8],
                "label": ["good"],
                "explanation": ["looks fine"],
            }
        ),
    )
    result = evaluations_to_precursors(evals)
    assert len(result) == 1
    p = result[0]
    assert isinstance(p, Precursors.SpanAnnotation)
    assert p.span_id == span_id
    assert p.obj.name == "my-eval"
    assert p.obj.score == 0.8
    assert p.obj.label == "good"
    assert p.obj.explanation == "looks fine"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"
    assert p.obj.identifier == ""
    assert p.obj.metadata_ == {}


def test_evaluations_to_precursors_document() -> None:
    span_id = "abc123"
    evals = DocumentEvaluations(
        eval_name="doc-eval",
        dataframe=pd.DataFrame(
            {
                "context.span_id": [span_id],
                "document_position": [2],
                "score": [0.5],
                "label": ["relevant"],
                "explanation": [None],
            }
        ),
    )
    result = evaluations_to_precursors(evals)
    assert len(result) == 1
    p = result[0]
    assert isinstance(p, Precursors.DocumentAnnotation)
    assert p.span_id == span_id
    assert p.document_position == 2
    assert p.obj.name == "doc-eval"
    assert p.obj.score == 0.5
    assert p.obj.label == "relevant"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"
    assert p.obj.identifier == ""
    assert p.obj.metadata_ == {}


def test_evaluations_to_precursors_trace() -> None:
    trace_id = "trace-abc"
    evals = TraceEvaluations(
        eval_name="trace-eval",
        dataframe=pd.DataFrame(
            {
                "context.trace_id": [trace_id],
                "score": [None],
                "label": [None],
                "explanation": ["all good"],
            }
        ),
    )
    result = evaluations_to_precursors(evals)
    assert len(result) == 1
    p = result[0]
    assert isinstance(p, Precursors.TraceAnnotation)
    assert p.trace_id == trace_id
    assert p.obj.name == "trace-eval"
    assert p.obj.explanation == "all good"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"
    assert p.obj.identifier == ""
    assert p.obj.metadata_ == {}


def test_evaluations_to_precursors_raises_for_unknown_type() -> None:
    from unittest.mock import MagicMock

    from phoenix.trace.span_evaluations import Evaluations

    fake = MagicMock(spec=Evaluations)
    fake.eval_name = "x"
    fake.dataframe = pd.DataFrame()
    with pytest.raises(TypeError):
        evaluations_to_precursors(fake)


# ---------------------------------------------------------------------------
# Tests for get_annotation_precursors_from_fixture()
# ---------------------------------------------------------------------------


def _span_df(span_id: str) -> pd.DataFrame:
    return pd.DataFrame(
        {"score": [0.9], "label": ["good"], "explanation": ["ok"]},
        index=pd.Index([span_id], name="context.span_id"),
    )


def _trace_df(trace_id: str) -> pd.DataFrame:
    return pd.DataFrame(
        {"score": [None], "label": ["pass"], "explanation": [None]},
        index=pd.Index([trace_id], name="context.trace_id"),
    )


def _document_df(span_id: str, document_position: int) -> pd.DataFrame:
    return pd.DataFrame(
        {"score": [1.0], "label": ["relevant"], "explanation": [None]},
        index=pd.MultiIndex.from_tuples(
            [(span_id, document_position)],
            names=["context.span_id", "document_position"],
        ),
    )


def _bad_df() -> pd.DataFrame:
    """DataFrame whose index matches neither SpanEvaluations nor TraceEvaluations."""
    return pd.DataFrame(
        {"score": [0.5]},
        index=pd.Index(["some-val"], name="unknown_index"),
    )


def test_annotation_precursors_span(monkeypatch: pytest.MonkeyPatch) -> None:
    from phoenix.trace.fixtures import (
        EvaluationFixture,
        TracesFixture,
        get_annotation_precursors_from_fixture,
    )

    span_id = "abc123"
    fixture = TracesFixture(
        name="test-span-fixture",
        description="",
        file_name="unused.parquet",
        evaluation_fixtures=(
            EvaluationFixture(evaluation_name="my-span-eval", file_name="span.parquet"),
        ),
    )
    monkeypatch.setattr("phoenix.trace.fixtures.get_trace_fixture_by_name", lambda _: fixture)
    monkeypatch.setattr(
        "phoenix.trace.fixtures._read_eval_fixture_dataframe", lambda _: _span_df(span_id)
    )

    results = list(get_annotation_precursors_from_fixture("test-span-fixture"))

    assert len(results) == 1
    eval_name, precursors = results[0]
    assert eval_name == "my-span-eval"
    assert len(precursors) == 1
    p = precursors[0]
    assert isinstance(p, Precursors.SpanAnnotation)
    assert p.span_id == span_id
    assert p.obj.name == "my-span-eval"
    assert p.obj.score == 0.9
    assert p.obj.label == "good"
    assert p.obj.explanation == "ok"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"


def test_annotation_precursors_trace(monkeypatch: pytest.MonkeyPatch) -> None:
    from phoenix.trace.fixtures import (
        EvaluationFixture,
        TracesFixture,
        get_annotation_precursors_from_fixture,
    )

    trace_id = "trace-deadbeef"
    fixture = TracesFixture(
        name="test-trace-fixture",
        description="",
        file_name="unused.parquet",
        evaluation_fixtures=(
            EvaluationFixture(evaluation_name="my-trace-eval", file_name="trace.parquet"),
        ),
    )
    monkeypatch.setattr("phoenix.trace.fixtures.get_trace_fixture_by_name", lambda _: fixture)
    monkeypatch.setattr(
        "phoenix.trace.fixtures._read_eval_fixture_dataframe", lambda _: _trace_df(trace_id)
    )

    results = list(get_annotation_precursors_from_fixture("test-trace-fixture"))

    assert len(results) == 1
    eval_name, precursors = results[0]
    assert eval_name == "my-trace-eval"
    assert len(precursors) == 1
    p = precursors[0]
    assert isinstance(p, Precursors.TraceAnnotation)
    assert p.trace_id == trace_id
    assert p.obj.name == "my-trace-eval"
    assert p.obj.label == "pass"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"


def test_annotation_precursors_document(monkeypatch: pytest.MonkeyPatch) -> None:
    from phoenix.trace.fixtures import (
        DocumentEvaluationFixture,
        TracesFixture,
        get_annotation_precursors_from_fixture,
    )

    span_id = "span-doc-test"
    document_position = 3
    fixture = TracesFixture(
        name="test-doc-fixture",
        description="",
        file_name="unused.parquet",
        evaluation_fixtures=(
            DocumentEvaluationFixture(evaluation_name="my-doc-eval", file_name="doc.parquet"),
        ),
    )
    monkeypatch.setattr("phoenix.trace.fixtures.get_trace_fixture_by_name", lambda _: fixture)
    monkeypatch.setattr(
        "phoenix.trace.fixtures._read_eval_fixture_dataframe",
        lambda _: _document_df(span_id, document_position),
    )

    results = list(get_annotation_precursors_from_fixture("test-doc-fixture"))

    assert len(results) == 1
    eval_name, precursors = results[0]
    assert eval_name == "my-doc-eval"
    assert len(precursors) == 1
    p = precursors[0]
    assert isinstance(p, Precursors.DocumentAnnotation)
    assert p.span_id == span_id
    assert p.document_position == document_position
    assert p.obj.name == "my-doc-eval"
    assert p.obj.score == 1.0
    assert p.obj.label == "relevant"
    assert p.obj.source == "API"
    assert p.obj.annotator_kind == "LLM"


def test_annotation_precursors_raises_for_unrecognized_index(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from phoenix.trace.fixtures import (
        EvaluationFixture,
        TracesFixture,
        get_annotation_precursors_from_fixture,
    )

    fixture = TracesFixture(
        name="test-bad-fixture",
        description="",
        file_name="unused.parquet",
        evaluation_fixtures=(
            EvaluationFixture(evaluation_name="bad-eval", file_name="bad.parquet"),
        ),
    )
    monkeypatch.setattr("phoenix.trace.fixtures.get_trace_fixture_by_name", lambda _: fixture)
    monkeypatch.setattr("phoenix.trace.fixtures._read_eval_fixture_dataframe", lambda _: _bad_df())

    with pytest.raises(ValueError, match="Could not infer evaluation type"):
        list(get_annotation_precursors_from_fixture("test-bad-fixture"))
