# type: ignore
"""Tests for ``GoogleGenAIAdapter.generate_object`` output validation (#12722).

Covers a correctly-shaped result, invalid JSON, a schema violation, a
refusal (``finish_reason in {"SAFETY", "PROHIBITED_CONTENT", ...}``), and a
truncated response (``finish_reason == "MAX_TOKENS"``) on the
structured-output path, plus a schema violation on the tool-calling path.
None of these are capability-mismatch signals, so none should trigger a
wasted second request against the other method.
"""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter
from phoenix.evals.llm.types import (
    MalformedOutputError,
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


def _make_adapter(model: str = "gemini-1.5-pro") -> GoogleGenAIAdapter:
    client = MagicMock()
    client.__module__ = "google.genai"
    client.model = model
    client.models = MagicMock()
    client.chats = MagicMock()
    return GoogleGenAIAdapter(client=client, model=model)


def _structured_response(text: str, finish_reason: str = "STOP") -> MagicMock:
    candidate = MagicMock()
    candidate.finish_reason = finish_reason
    response = MagicMock()
    response.text = text
    response.candidates = [candidate]
    return response


def _tool_call_response(args: dict, finish_reason: str = "STOP") -> MagicMock:
    part = MagicMock()
    part.function_call.args = args
    candidate = MagicMock()
    candidate.content.parts = [part]
    candidate.finish_reason = finish_reason
    response = MagicMock()
    response.candidates = [candidate]
    return response


class TestStructuredOutputPath:
    METHOD = ObjectGenerationMethod.STRUCTURED_OUTPUT

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _structured_response(
            '{"label": "yes"}'
        )

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "yes"}

    def test_invalid_json_raises_malformed_output_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _structured_response(
            "{not valid json"
        )

        with pytest.raises(MalformedOutputError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _structured_response(
            '{"label": "maybe"}'
        )

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _structured_response(
            "", finish_reason="SAFETY"
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _structured_response(
            '{"label": "y', finish_reason="MAX_TOKENS"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)


class TestToolCallingPath:
    METHOD = ObjectGenerationMethod.TOOL_CALLING

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _tool_call_response({"label": "no"})

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "no"}

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _tool_call_response(
            {"label": "maybe"}
        )

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _tool_call_response(
            {}, finish_reason="PROHIBITED_CONTENT"
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.models.generate_content.return_value = _tool_call_response(
            {}, finish_reason="MAX_TOKENS"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)
