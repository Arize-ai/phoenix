import pytest
from pydantic import TypeAdapter, ValidationError

from phoenix.server.api.routers.chat_context import (
    ChatContext,
    ProjectContext,
    ResolvedContexts,
    SpanContext,
    SpanFilterContext,
    TraceContext,
    resolve_contexts,
)

_adapter: TypeAdapter[ChatContext] = TypeAdapter(ChatContext)


class TestChatContextRoundTrip:
    def test_project_context(self) -> None:
        parsed = _adapter.validate_python({"type": "project", "projectId": "P1"})
        assert isinstance(parsed, ProjectContext)
        assert parsed.project_id == "P1"
        dumped = parsed.model_dump(by_alias=True)
        assert dumped == {"type": "project", "projectId": "P1"}

    def test_trace_context(self) -> None:
        parsed = _adapter.validate_python({"type": "trace", "projectId": "P1", "traceId": "T1"})
        assert isinstance(parsed, TraceContext)
        assert parsed.project_id == "P1"
        assert parsed.trace_id == "T1"

    def test_span_context_with_project(self) -> None:
        parsed = _adapter.validate_python({"type": "span", "projectId": "P1", "spanId": "S1"})
        assert isinstance(parsed, SpanContext)
        assert parsed.project_id == "P1"
        assert parsed.span_id == "S1"

    def test_span_context_without_project(self) -> None:
        parsed = _adapter.validate_python({"type": "span", "spanId": "S1"})
        assert isinstance(parsed, SpanContext)
        assert parsed.project_id is None
        assert parsed.span_id == "S1"

    def test_span_filter_context(self) -> None:
        parsed = _adapter.validate_python(
            {
                "type": "span_filter",
                "projectId": "P1",
                "condition": "span_kind == 'LLM'",
            }
        )
        assert isinstance(parsed, SpanFilterContext)
        assert parsed.project_id == "P1"
        assert parsed.condition == "span_kind == 'LLM'"

    def test_unknown_discriminator_raises(self) -> None:
        with pytest.raises(ValidationError):
            _adapter.validate_python({"type": "dataset", "datasetId": "D1"})


class TestResolveContexts:
    def test_empty_returns_default_resolved(self) -> None:
        resolved = resolve_contexts(None)
        assert isinstance(resolved, ResolvedContexts)
        assert resolved.project is None
        assert resolved.trace is None
        assert resolved.span is None
        assert resolved.span_filter is None

    def test_folds_each_type_into_slot(self) -> None:
        items: list[ChatContext] = [
            _adapter.validate_python({"type": "project", "projectId": "P1"}),
            _adapter.validate_python({"type": "trace", "projectId": "P1", "traceId": "T1"}),
            _adapter.validate_python(
                {
                    "type": "span_filter",
                    "projectId": "P1",
                    "condition": "status_code == 'ERROR'",
                }
            ),
        ]
        resolved = resolve_contexts(items)
        assert resolved.project is not None
        assert resolved.project.project_id == "P1"
        assert resolved.trace is not None
        assert resolved.trace.trace_id == "T1"
        assert resolved.span_filter is not None
        assert resolved.span_filter.condition == "status_code == 'ERROR'"
        assert resolved.span is None

    def test_last_wins_on_duplicate_type(self) -> None:
        items: list[ChatContext] = [
            _adapter.validate_python({"type": "project", "projectId": "P1"}),
            _adapter.validate_python({"type": "project", "projectId": "P2"}),
        ]
        resolved = resolve_contexts(items)
        assert resolved.project is not None
        assert resolved.project.project_id == "P2"
