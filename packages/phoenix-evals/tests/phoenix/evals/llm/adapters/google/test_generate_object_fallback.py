# type: ignore
"""Tests for ``GoogleGenAIAdapter.generate_object`` AUTO-mode fallback.

Covers the drift fixed by consolidating into ``BaseLLMAdapter._try_with_fallback``
(#12722): the combined error previously dropped the structured-output error
entirely, only surfacing the tool-calling error.
"""

from unittest.mock import MagicMock

import pytest
from google.genai.errors import ClientError

from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter

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
    # `_check_if_async_client()` returns False (sync) when `aio` is present;
    # MagicMock auto-creates the attribute, so no extra setup is needed here.
    return GoogleGenAIAdapter(client=client, model=model)


def _structured_output_response(label: str = "yes") -> MagicMock:
    response = MagicMock()
    response.text = f'{{"label": "{label}"}}'
    return response


def _tool_calling_response(label: str = "yes") -> MagicMock:
    part = MagicMock()
    part.function_call.args = {"label": label}
    candidate = MagicMock()
    candidate.content.parts = [part]
    response = MagicMock()
    response.candidates = [candidate]
    return response


def _client_error(message: str, code: int = 400) -> ClientError:
    """Construct a real ``ClientError`` -- the only exception the adapter now
    treats as a capability-mismatch signal eligible for fallback."""
    return ClientError(code, {"message": message}, None)


def test_auto_falls_back_to_tool_calling_on_structured_output_failure() -> None:
    adapter = _make_adapter()
    adapter.client.models.generate_content.side_effect = [
        _client_error("response_schema not supported"),
        _tool_calling_response("no"),
    ]

    result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    assert result == {"label": "no"}
    assert adapter.client.models.generate_content.call_count == 2


def test_auto_combined_error_preserves_both_messages() -> None:
    """Regression test: the pre-refactor code dropped the structured-output
    error from the combined message, only including the tool-calling error."""
    adapter = _make_adapter()
    adapter.client.models.generate_content.side_effect = [
        _client_error("STRUCTURED_OUTPUT_MARKER"),
        _client_error("TOOL_CALLING_MARKER"),
    ]

    with pytest.raises(ValueError, match="failed with both") as exc_info:
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    message = str(exc_info.value)
    assert "STRUCTURED_OUTPUT_MARKER" in message
    assert "TOOL_CALLING_MARKER" in message


def test_auth_error_does_not_trigger_fallback() -> None:
    """A 401 must propagate directly -- never treated as a capability mismatch."""
    adapter = _make_adapter()
    adapter.client.models.generate_content.side_effect = _client_error("invalid API key", code=401)

    with pytest.raises(ClientError):
        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    assert adapter.client.models.generate_content.call_count == 1
