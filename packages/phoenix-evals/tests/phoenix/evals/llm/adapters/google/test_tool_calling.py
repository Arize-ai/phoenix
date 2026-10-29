# type: ignore
"""Tests for ``GoogleGenAIAdapter`` tool-calling object generation."""

from unittest.mock import MagicMock

import pytest

genai = pytest.importorskip("google.genai")

from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter  # noqa: E402

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {"label": {"type": "string", "enum": ["yes", "no"]}},
    "required": ["label"],
}


def _make_adapter(response: object) -> GoogleGenAIAdapter:
    client = MagicMock()
    client.__module__ = "google.genai"
    client.model = "gemini-1.5-pro"
    client.models.generate_content.return_value = response
    # aio attr absent -> _check_if_async_client() treats this as sync
    del client.aio
    return GoogleGenAIAdapter(client=client, model="gemini-1.5-pro")


def _response(*parts: object) -> object:
    return genai.types.GenerateContentResponse(
        candidates=[
            genai.types.Candidate(content=genai.types.Content(role="model", parts=list(parts)))
        ]
    )


def test_tool_calling_skips_parts_without_a_function_call() -> None:
    adapter = _make_adapter(
        _response(
            genai.types.Part(text="Let me think about this.", thought=True),
            genai.types.Part(
                function_call=genai.types.FunctionCall(
                    name="extract_structured_data", args={"label": "yes"}
                )
            ),
        )
    )

    result = adapter._generate_with_tool_calling("prompt", SIMPLE_SCHEMA)

    assert result == {"label": "yes"}


def test_tool_calling_without_a_function_call_raises_a_clear_error() -> None:
    adapter = _make_adapter(_response(genai.types.Part(text="I cannot do that.")))

    with pytest.raises(ValueError, match="No function call in response"):
        adapter._generate_with_tool_calling("prompt", SIMPLE_SCHEMA)
