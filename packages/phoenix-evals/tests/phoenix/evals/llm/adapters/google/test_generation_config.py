# type: ignore
"""Tests that a caller-supplied ``config`` reaches ``GoogleGenAIAdapter`` object generation."""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest

genai = pytest.importorskip("google.genai")

from phoenix.evals.llm.adapters.google.adapter import GoogleGenAIAdapter  # noqa: E402

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {"label": {"type": "string", "enum": ["yes", "no"]}},
    "required": ["label"],
}


def _structured_response() -> object:
    return MagicMock(text=json.dumps({"label": "yes"}))


def _tool_response() -> object:
    return genai.types.GenerateContentResponse(
        candidates=[
            genai.types.Candidate(
                content=genai.types.Content(
                    role="model",
                    parts=[
                        genai.types.Part(
                            function_call=genai.types.FunctionCall(
                                name="extract_structured_data", args={"label": "yes"}
                            )
                        )
                    ],
                )
            )
        ]
    )


def _make_adapter(response: object, *, is_async: bool = False) -> GoogleGenAIAdapter:
    client = MagicMock()
    client.__module__ = "google.genai"
    client.model = "gemini-1.5-pro"
    if is_async:
        client.models.generate_content = AsyncMock(return_value=response)
    else:
        client.models.generate_content.return_value = response
        # aio attr absent -> _check_if_async_client() treats this as sync
        del client.aio
    adapter = GoogleGenAIAdapter(client=client, model="gemini-1.5-pro")
    if is_async:
        adapter._is_async = True
    return adapter


def _sent_config(adapter: GoogleGenAIAdapter) -> object:
    return adapter.client.models.generate_content.call_args.kwargs["config"]


@pytest.mark.parametrize("config_type", ["dict", "object"])
def test_structured_output_merges_a_caller_config(config_type: str) -> None:
    adapter = _make_adapter(_structured_response())
    config = {"temperature": 0.2}
    if config_type == "object":
        config = genai.types.GenerateContentConfig(**config)

    result = adapter._generate_with_structured_output("prompt", SIMPLE_SCHEMA, config=config)

    assert result == {"label": "yes"}
    sent = _sent_config(adapter)
    assert sent.temperature == 0.2
    assert sent.response_mime_type == "application/json"
    assert sent.response_schema == SIMPLE_SCHEMA


@pytest.mark.parametrize("config_type", ["dict", "object"])
def test_tool_calling_merges_a_caller_config(config_type: str) -> None:
    adapter = _make_adapter(_tool_response())
    config = {"temperature": 0.2}
    if config_type == "object":
        config = genai.types.GenerateContentConfig(**config)

    result = adapter._generate_with_tool_calling("prompt", SIMPLE_SCHEMA, config=config)

    assert result == {"label": "yes"}
    sent = _sent_config(adapter)
    assert sent.temperature == 0.2
    assert sent.tools is not None


def test_caller_system_instruction_is_kept_when_the_prompt_has_none() -> None:
    adapter = _make_adapter(_structured_response())

    adapter._generate_with_structured_output(
        "prompt", SIMPLE_SCHEMA, config={"system_instruction": "Be terse."}
    )

    assert _sent_config(adapter).system_instruction == "Be terse."


def test_structured_output_without_a_caller_config_is_unchanged() -> None:
    adapter = _make_adapter(_structured_response())

    adapter._generate_with_structured_output("prompt", SIMPLE_SCHEMA)

    sent = _sent_config(adapter)
    assert sent.response_mime_type == "application/json"
    assert sent.temperature is None


async def test_async_structured_output_merges_a_caller_config() -> None:
    adapter = _make_adapter(_structured_response(), is_async=True)

    result = await adapter._async_generate_with_structured_output(
        "prompt", SIMPLE_SCHEMA, config={"temperature": 0.2}
    )

    assert result == {"label": "yes"}
    assert _sent_config(adapter).temperature == 0.2


async def test_async_tool_calling_merges_a_caller_config() -> None:
    adapter = _make_adapter(_tool_response(), is_async=True)

    result = await adapter._async_generate_with_tool_calling(
        "prompt", SIMPLE_SCHEMA, config={"temperature": 0.2}
    )

    assert result == {"label": "yes"}
    assert _sent_config(adapter).temperature == 0.2
