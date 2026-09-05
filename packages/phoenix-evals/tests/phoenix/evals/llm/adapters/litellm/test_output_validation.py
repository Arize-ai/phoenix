# type: ignore
"""Tests for ``LiteLLMAdapter.generate_object`` output validation (#12722).

Same shape as the OpenAI adapter's coverage -- LiteLLM proxies OpenAI-format
responses -- covering a correctly-shaped result, invalid JSON, a schema
violation, a refusal, and a truncated response, none of which should trigger
a wasted second request against the other method.
"""

import json
from typing import Optional
from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
from phoenix.evals.llm.adapters.litellm.client import LiteLLMClient
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


def _make_adapter(monkeypatch: pytest.MonkeyPatch, model: str = "gpt-4o") -> LiteLLMAdapter:
    client = LiteLLMClient(provider="openai", model=model)
    adapter = LiteLLMAdapter(client, model)
    completion_mock = MagicMock()
    monkeypatch.setattr(adapter._litellm, "completion", completion_mock)
    adapter._completion_mock = completion_mock  # stash for test access
    return adapter


class TestStructuredOutputPath:
    METHOD = ObjectGenerationMethod.STRUCTURED_OUTPUT

    def test_correctly_named_result(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _structured_response(json.dumps({"label": "yes"}))

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "yes"}

    def test_invalid_json_raises_malformed_output_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _structured_response("{not valid json")

        with pytest.raises(MalformedOutputError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_schema_violation_raises_schema_violation_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _structured_response(json.dumps({"label": "maybe"}))

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _structured_response(
            None, refusal="I can't help with that."
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _structured_response(
            '{"label": "y', finish_reason="length"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)


class TestToolCallingPath:
    METHOD = ObjectGenerationMethod.TOOL_CALLING

    def test_correctly_named_result(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _tool_call_response(json.dumps({"label": "no"}))

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

        assert result == {"label": "no"}

    def test_invalid_json_raises_malformed_output_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _tool_call_response("{not valid json")

        with pytest.raises(MalformedOutputError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_schema_violation_raises_schema_violation_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _tool_call_response(json.dumps({"label": "maybe"}))

        with pytest.raises(SchemaViolationError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_refusal_raises_refusal_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _tool_call_response(
            json.dumps({"label": "no"}), refusal="I can't help with that."
        )

        with pytest.raises(RefusalError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)

    def test_truncated_response_raises_truncated_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter = _make_adapter(monkeypatch)
        adapter._completion_mock.return_value = _tool_call_response(
            '{"label": "n', finish_reason="length"
        )

        with pytest.raises(TruncatedResponseError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA, method=self.METHOD)
