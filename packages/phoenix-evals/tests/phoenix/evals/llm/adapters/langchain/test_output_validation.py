# type: ignore
"""Tests for ``LangChainModelAdapter.generate_object`` output validation (#12722).

LangChain's ``with_structured_output``/``bind_tools`` already hand back a
parsed dict (or an ``AIMessage`` whose ``tool_calls[i]["args"]`` is parsed) --
there's no raw JSON text for this adapter to parse itself, so "invalid JSON"
isn't reachable here the way it is for OpenAI/LiteLLM/Google. What *is*
covered: a correctly-shaped result, a schema violation on both paths, and
best-effort refusal/truncation detection on the tool-calling path via
``response_metadata`` (populated for OpenAI/Anthropic-backed models).
"""

from unittest.mock import MagicMock

import pytest

pytest.importorskip("langchain_core")

from phoenix.evals.llm.adapters.langchain.adapter import LangChainModelAdapter  # noqa: E402
from phoenix.evals.llm.types import (  # noqa: E402
    ObjectGenerationMethod,
    RefusalError,
    SchemaViolationError,
    TruncatedResponseError,
)

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["yes", "no"]},
    },
    "required": ["label"],
}


def _make_adapter() -> LangChainModelAdapter:
    client = MagicMock()
    client.__module__ = "langchain_openai"
    return LangChainModelAdapter(client=client, model="model")


def _tool_call_ai_message(args: dict, finish_reason: str = "stop") -> MagicMock:
    response = MagicMock()
    response.response_metadata = {"finish_reason": finish_reason}
    response.tool_calls = [{"name": "extract_structured_data", "args": args}]
    return response


class TestStructuredOutputPath:
    METHOD = ObjectGenerationMethod.STRUCTURED_OUTPUT

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.with_structured_output.return_value.invoke.return_value = {"label": "yes"}

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "yes"}

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.with_structured_output.return_value.invoke.return_value = {"label": "maybe"}

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)


class TestToolCallingPath:
    METHOD = ObjectGenerationMethod.TOOL_CALLING

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.bind_tools.return_value.invoke.return_value = _tool_call_ai_message(
            {"label": "no"}
        )

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "no"}

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.bind_tools.return_value.invoke.return_value = _tool_call_ai_message(
            {"label": "maybe"}
        )

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.bind_tools.return_value.invoke.return_value = _tool_call_ai_message(
            {"label": "no"}, finish_reason="content_filter"
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.bind_tools.return_value.invoke.return_value = _tool_call_ai_message(
            {"label": "no"}, finish_reason="length"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)
