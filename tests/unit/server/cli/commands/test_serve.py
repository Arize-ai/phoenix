from argparse import Namespace

import pandas as pd
import pytest

from phoenix.server.cli.commands import serve
from phoenix.server.cli.commands.serve import (
    _load_trace_fixture_initial_batches,
    _resolve_grpc_port,
)
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    SpanEvaluations,
    TraceEvaluations,
)
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
    evaluations = [
        SpanEvaluations(
            eval_name="span-eval",
            dataframe=pd.DataFrame({"context.span_id": [span_id], "score": [1.0]}),
        ),
        DocumentEvaluations(
            eval_name="document-eval",
            dataframe=pd.DataFrame(
                {
                    "context.span_id": [span_id],
                    "document_position": [0],
                    "label": ["relevant"],
                }
            ),
        ),
        TraceEvaluations(
            eval_name="trace-eval",
            dataframe=pd.DataFrame({"context.trace_id": [trace_id], "label": ["good"]}),
        ),
    ]
    dataset_fixture = object()

    monkeypatch.setattr(serve, "load_example_traces", lambda _: TraceDataset.from_spans([span]))
    monkeypatch.setattr(serve, "get_evaluations_from_fixture", lambda _: iter(evaluations))
    monkeypatch.setattr(serve, "get_dataset_fixtures", lambda _: [dataset_fixture])

    fixture_spans, fixture_evaluations, dataset_fixtures = _load_trace_fixture_initial_batches(
        "fixture-name"
    )

    new_trace_id = fixture_spans[0].context.trace_id
    new_span_id = fixture_spans[0].context.span_id

    assert new_trace_id != trace_id
    assert new_span_id != span_id
    assert list(fixture_evaluations[0].dataframe.index) == [new_span_id]
    assert list(fixture_evaluations[1].dataframe.index.get_level_values("context.span_id")) == [
        new_span_id
    ]
    assert list(fixture_evaluations[2].dataframe.index) == [new_trace_id]
    assert dataset_fixtures == [dataset_fixture]
