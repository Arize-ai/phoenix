import pytest
from pydantic import TypeAdapter, ValidationError

from phoenix.server.api.routers.chat_context import (
    ChatContext,
    ProjectContext,
    ResolvedContexts,
    SpanContext,
    SpanFilterContext,
    TraceContext,
    build_current_phoenix_context_system_prompt,
    resolve_contexts,
)

_adapter: TypeAdapter[ChatContext] = TypeAdapter(ChatContext)


class TestChatContextRoundTrip:
    def test_project_context(self) -> None:
        parsed = _adapter.validate_python({"type": "project", "projectId": "P1"})
        assert isinstance(parsed, ProjectContext)
        assert parsed.project_id == "P1"

    def test_trace_context(self) -> None:
        parsed = _adapter.validate_python({"type": "trace", "projectId": "P1", "traceId": "T1"})
        assert isinstance(parsed, TraceContext)
        assert parsed.trace_id == "T1"

    def test_span_context(self) -> None:
        parsed = _adapter.validate_python({"type": "span", "projectId": "P1", "spanId": "S1"})
        assert isinstance(parsed, SpanContext)
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
        assert parsed.condition == "span_kind == 'LLM'"

    def test_unknown_discriminator_raises(self) -> None:
        with pytest.raises(ValidationError):
            _adapter.validate_python({"type": "dataset", "datasetId": "D1"})


class TestResolveContexts:
    def test_last_wins_on_duplicate_type(self) -> None:
        resolved = resolve_contexts(
            [
                _adapter.validate_python({"type": "project", "projectId": "P1"}),
                _adapter.validate_python({"type": "project", "projectId": "P2"}),
            ]
        )
        assert isinstance(resolved, ResolvedContexts)
        assert resolved.project is not None
        assert resolved.project.project_id == "P2"

    def test_builds_server_authored_context_prompt(self) -> None:
        prompt = build_current_phoenix_context_system_prompt(
            ResolvedContexts(
                project=ProjectContext(type="project", project_id="P1"),
                span_filter=SpanFilterContext(
                    type="span_filter",
                    project_id="P1",
                    condition="status_code == 'ERROR'",
                ),
            )
        )

        assert prompt is not None
        assert "Current Phoenix context" in prompt
        assert "Project ID: P1" in prompt
        assert "status_code == 'ERROR'" in prompt
