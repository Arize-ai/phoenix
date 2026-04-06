from argparse import Namespace
from datetime import datetime, timezone

import pandas as pd
import pytest

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.cli.commands import serve
from phoenix.server.cli.commands.serve import (
    _load_trace_fixture_initial_batches,
    _resolve_grpc_port,
)
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.trace_dataset import TraceDataset


def test_resolve_grpc_port_uses_cli_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_GRPC_PORT", "4318")

    assert _resolve_grpc_port(Namespace(grpc_port=9000)) == 9000


def test_resolve_grpc_port_uses_env_when_cli_flag_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_GRPC_PORT", "4318")

    assert _resolve_grpc_port(Namespace(grpc_port=None)) == 4318


def test_load_trace_fixture_initial_batches_remaps_evaluations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trace_id = "0123456789abcdef0123456789abcdef"
    span_id = "0123456789abcdef"
    span = Span(
        name="fixture-span",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.RETRIEVER,
        parent_id=None,
        start_time=pd.Timestamp("2024-01-01T00:00:00Z").to_pydatetime(),
        end_time=pd.Timestamp("2024-01-01T00:00:01Z").to_pydatetime(),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={"retrieval": {"documents": [{"document": {"content": "doc-0"}}]}},
        events=[],
        conversation=None,
    )
    now = datetime.now(timezone.utc)
    precursors = [
        (
            "span-eval",
            [
                Precursors.SpanAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    obj=models.SpanAnnotation(
                        name="span-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=1.0,
                        label=None,
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
        (
            "document-eval",
            [
                Precursors.DocumentAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    document_position=0,
                    obj=models.DocumentAnnotation(
                        document_position=0,
                        name="document-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label="relevant",
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
        (
            "trace-eval",
            [
                Precursors.TraceAnnotation(
                    updated_at=now,
                    trace_id=trace_id,
                    obj=models.TraceAnnotation(
                        name="trace-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label="good",
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
    ]
    dataset_fixture = object()

    monkeypatch.setattr(serve, "load_example_traces", lambda _: TraceDataset.from_spans([span]))
    monkeypatch.setattr(serve, "get_annotation_precursors_from_fixture", lambda _: iter(precursors))
    monkeypatch.setattr(serve, "get_dataset_fixtures", lambda _: [dataset_fixture])

    fixture_spans, fixture_annotation_precursors, dataset_fixtures = (
        _load_trace_fixture_initial_batches("fixture-name")
    )

    new_trace_id = fixture_spans[0].context.trace_id
    new_span_id = fixture_spans[0].context.span_id

    assert new_trace_id != trace_id
    assert new_span_id != span_id
    assert len(fixture_annotation_precursors) == 3
    span_precursor = fixture_annotation_precursors[0]
    doc_precursor = fixture_annotation_precursors[1]
    trace_precursor = fixture_annotation_precursors[2]
    assert isinstance(span_precursor, Precursors.SpanAnnotation)
    assert span_precursor.span_id == new_span_id
    assert isinstance(doc_precursor, Precursors.DocumentAnnotation)
    assert doc_precursor.span_id == new_span_id
    assert isinstance(trace_precursor, Precursors.TraceAnnotation)
    assert trace_precursor.trace_id == new_trace_id
    assert dataset_fixtures == [dataset_fixture]
