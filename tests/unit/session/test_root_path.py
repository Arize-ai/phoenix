from types import SimpleNamespace
from unittest.mock import Mock, patch

import pandas as pd
import pytest

import phoenix.session.session as session_module
from phoenix.db.insertion.types import Precursors
from phoenix.session.session import launch_app
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.span_evaluations import (
    DocumentEvaluations,
    SpanEvaluations,
    TraceEvaluations,
)
from phoenix.trace.trace_dataset import TraceDataset


@pytest.mark.parametrize(
    "root_path,env_var,expected",
    [
        ("/test/proxy", None, "/test/proxy"),
        ("test/proxy", None, "/test/proxy"),
        ("test/proxy/", None, "/test/proxy"),
        ("/", None, "/"),
        (None, "/env/path", "/env/path"),
        ("", "/env/path", ""),  # Test empty string is preserved
        (None, None, ""),
        (None, "", ""),
    ],
)
def test_launch_app_root_path_parameter_flow(
    monkeypatch: pytest.MonkeyPatch,
    root_path: str,
    env_var: str,
    expected: str,
) -> None:
    if env_var is None:
        monkeypatch.delenv("PHOENIX_HOST_ROOT_PATH", raising=False)
    else:
        monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", env_var)

    with (
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.ThreadServer") as mock_server,
    ):
        launch_app(root_path=root_path, run_in_thread=True)
        mock_server.assert_called_once()
        call_kwargs = mock_server.call_args[1]
        assert call_kwargs["root_path"] == expected


def test_launch_app_passes_trace_dataset_evaluations_to_create_app() -> None:
    trace_dataset = TraceDataset.from_spans(
        [
            Span(
                name="span",
                context=SpanContext(trace_id="trace-id", span_id="span-id"),
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
        ]
    )
    trace_dataset.append_evaluations(
        SpanEvaluations(
            eval_name="span-eval",
            dataframe=pd.DataFrame({"context.span_id": ["span-id"], "score": [1.0]}),
        )
    )
    trace_dataset.append_evaluations(
        DocumentEvaluations(
            eval_name="document-eval",
            dataframe=pd.DataFrame(
                {
                    "context.span_id": ["span-id"],
                    "document_position": [0],
                    "label": ["relevant"],
                }
            ),
        )
    )
    trace_dataset.append_evaluations(
        TraceEvaluations(
            eval_name="trace-eval",
            dataframe=pd.DataFrame({"context.trace_id": ["trace-id"], "label": ["good"]}),
        )
    )
    engine = SimpleNamespace(
        dialect=SimpleNamespace(name="sqlite"),
        dispose=Mock(),
    )
    thread = Mock()
    thread.is_alive.return_value = True

    with (
        patch.object(session_module, "_session", None),
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.create_engine", return_value=engine),
        patch("phoenix.session.session.instrument_engine_if_enabled", return_value=[]),
        patch("phoenix.session.session.create_app") as mock_create_app,
        patch("phoenix.session.session.ThreadServer") as mock_server,
    ):
        mock_create_app.return_value = Mock()
        mock_server.return_value.run_in_thread.return_value = iter([thread])

        launch_app(trace=trace_dataset, run_in_thread=True)

    assert mock_create_app.call_args is not None
    initial_annotation_precursors = mock_create_app.call_args.kwargs[
        "initial_annotation_precursors"
    ]
    assert isinstance(initial_annotation_precursors, list)
    assert len(initial_annotation_precursors) == 3
    assert any(isinstance(p, Precursors.SpanAnnotation) for p in initial_annotation_precursors)
    assert any(isinstance(p, Precursors.DocumentAnnotation) for p in initial_annotation_precursors)
    assert any(isinstance(p, Precursors.TraceAnnotation) for p in initial_annotation_precursors)
