# type: ignore
"""Tests for ``OpenAIAdapter.generate_object`` output validation (#12722).

Covers the shared classification the fallback helper now enforces: a
correctly-shaped result, invalid JSON, a schema violation, a refusal
(``message.refusal``), and a truncated response (``finish_reason ==
"length"``) -- none of which are capability-mismatch signals, so none of
them should trigger a wasted second request against the other method.
"""

import json
from typing import Optional
from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter
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


def _make_adapter(model: str = "gpt-4o") -> OpenAIAdapter:
    client = MagicMock()
    client.__module__ = "openai"
    client.__class__.__name__ = "OpenAI"
    client.model = model
    client.chat.completions.create = MagicMock()
    return OpenAIAdapter(client, model)


def _structured_response(
    content: Optional[str], finish_reason: str = "stop", refusal: Optional[str] = None
) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = content
    response.choices[0].message.refusal = refusal
    response.choices[0].finish_reason = finish_reason
    return response


def _tool_call_response(
    arguments: str, finish_reason: str = "tool_calls", refusal: Optional[str] = None
) -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = None
    response.choices[0].message.refusal = refusal
    response.choices[0].finish_reason = finish_reason
    tool_call = MagicMock()
    tool_call.function.arguments = arguments
    response.choices[0].message.tool_calls = [tool_call]
    return response


class TestStructuredOutputPath:
    METHOD = ObjectGenerationMethod.STRUCTURED_OUTPUT

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _structured_response(
            json.dumps({"label": "yes"})
        )

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "yes"}

    def test_invalid_json_raises_malformed_output_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _structured_response(
            "{not valid json"
        )

        with pytest.raises(MalformedOutputError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _structured_response(
            json.dumps({"label": "maybe"})
        )

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _structured_response(
            None, refusal="I can't help with that."
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _structured_response(
            '{"label": "y', finish_reason="length"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)


class TestToolCallingPath:
    METHOD = ObjectGenerationMethod.TOOL_CALLING

    def test_correctly_named_result(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _tool_call_response(
            json.dumps({"label": "no"})
        )

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "no"}

    def test_invalid_json_raises_malformed_output_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _tool_call_response("{not valid json")

        with pytest.raises(MalformedOutputError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_schema_violation_raises_schema_violation_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _tool_call_response(
            json.dumps({"label": "maybe"})
        )

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _tool_call_response(
            json.dumps({"label": "no"}), refusal="I can't help with that."
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(self) -> None:
        adapter = _make_adapter()
        adapter.client.chat.completions.create.return_value = _tool_call_response(
            '{"label": "n', finish_reason="length"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)
