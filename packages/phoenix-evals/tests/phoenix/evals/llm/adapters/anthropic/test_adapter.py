"""Tests for Anthropic native structured output and AUTO fallback behavior."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import anthropic
import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter
from phoenix.evals.llm.types import ObjectGenerationMethod

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {"label": {"type": "string", "enum": ["yes", "no"]}},
    "required": ["label"],
    "additionalProperties": False,
}


class FakeBadRequestError(Exception):
    def __init__(self, message: str, body: object = None) -> None:
        super().__init__(message)
        self.body = body


def _make_sync_adapter() -> tuple[MagicMock, AnthropicAdapter]:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "Anthropic"
    client.messages.create = MagicMock()
    return client, AnthropicAdapter(client, "claude-test")


def _make_async_adapter() -> tuple[MagicMock, AnthropicAdapter]:
    client, adapter = _make_sync_adapter()
    adapter._is_async = True
    client.messages.create = AsyncMock()
    return client, adapter


def _text_response(
    value: object = None,
    *,
    raw_text: str | None = None,
    stop_reason: str = "end_turn",
) -> SimpleNamespace:
    text = raw_text if raw_text is not None else json.dumps(value or {"label": "yes"})
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="text", text=text)],
    )


def _tool_response(value: object = None) -> SimpleNamespace:
    return SimpleNamespace(
        stop_reason="tool_use",
        content=[
            SimpleNamespace(
                type="tool_use",
                name="extract_structured_data",
                input=value or {"label": "no"},
            )
        ],
    )


def test_structured_output_uses_output_config_format_and_parses_json() -> None:
    client, adapter = _make_sync_adapter()
    client.messages.create.return_value = _text_response({"label": "yes"})

    result = adapter.generate_object(
        "classify",
        SIMPLE_SCHEMA,
        method=ObjectGenerationMethod.STRUCTURED_OUTPUT,
    )

    assert result == {"label": "yes"}
    assert client.messages.create.call_args.kwargs["output_config"] == {
        "format": {
            "type": "json_schema",
            "schema": SIMPLE_SCHEMA,
        }
    }


@pytest.mark.asyncio
async def test_async_structured_output_uses_output_config_format_and_parses_json() -> None:
    client, adapter = _make_async_adapter()
    client.messages.create.return_value = _text_response({"label": "yes"})

    result = await adapter.async_generate_object(
        "classify",
        SIMPLE_SCHEMA,
        method=ObjectGenerationMethod.STRUCTURED_OUTPUT,
    )

    assert result == {"label": "yes"}
    assert client.messages.create.call_args.kwargs["output_config"] == {
        "format": {
            "type": "json_schema",
            "schema": SIMPLE_SCHEMA,
        }
    }


def test_auto_falls_back_only_for_unsupported_output_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(anthropic, "BadRequestError", FakeBadRequestError)
    client, adapter = _make_sync_adapter()
    client.messages.create.side_effect = [
        FakeBadRequestError(
            "output_config.format is not supported for this model",
            body={
                "type": "error",
                "error": {
                    "type": "invalid_request_error",
                    "message": "output_config.format is not supported for this model",
                },
            },
        ),
        _tool_response({"label": "no"}),
    ]

    result = adapter.generate_object("classify", SIMPLE_SCHEMA)

    assert result == {"label": "no"}
    assert client.messages.create.call_count == 2
    fallback_kwargs = client.messages.create.call_args.kwargs
    assert fallback_kwargs["tools"] == [
        {
            "name": "extract_structured_data",
            "description": "Respond in a format matching the provided schema",
            "input_schema": SIMPLE_SCHEMA,
        }
    ]
    assert fallback_kwargs["tool_choice"] == {
        "type": "tool",
        "name": "extract_structured_data",
        "disable_parallel_tool_use": True,
    }


def test_auto_propagates_unrelated_bad_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(anthropic, "BadRequestError", FakeBadRequestError)
    client, adapter = _make_sync_adapter()
    error = FakeBadRequestError(
        "Invalid schema: required property is missing",
        body={"error": {"type": "invalid_request_error", "message": "Invalid schema"}},
    )
    client.messages.create.side_effect = error

    with pytest.raises(FakeBadRequestError) as exc_info:
        adapter.generate_object("classify", SIMPLE_SCHEMA)

    assert exc_info.value is error
    assert client.messages.create.call_count == 1


def test_auto_falls_back_for_does_not_support_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(anthropic, "BadRequestError", FakeBadRequestError)
    client, adapter = _make_sync_adapter()
    client.messages.create.side_effect = [
        FakeBadRequestError("This model does not support json_schema output"),
        _tool_response({"label": "no"}),
    ]

    assert adapter.generate_object("classify", SIMPLE_SCHEMA) == {"label": "no"}


@pytest.mark.asyncio
async def test_async_auto_falls_back_for_unsupported_output_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(anthropic, "BadRequestError", FakeBadRequestError)
    client, adapter = _make_async_adapter()
    client.messages.create.side_effect = [
        FakeBadRequestError("unknown parameter: output_config.format"),
        _tool_response({"label": "no"}),
    ]

    result = await adapter.async_generate_object("classify", SIMPLE_SCHEMA)

    assert result == {"label": "no"}
    assert client.messages.create.call_count == 2
    assert (
        client.messages.create.call_args.kwargs["tool_choice"]["disable_parallel_tool_use"] is True
    )


@pytest.mark.parametrize(
    ("response", "message"),
    [
        (_text_response(stop_reason="refusal"), "refused"),
        (_text_response(stop_reason="max_tokens"), "max_tokens"),
        (SimpleNamespace(stop_reason="end_turn", content=[]), "no text content"),
        (
            SimpleNamespace(
                stop_reason="end_turn",
                content=[SimpleNamespace(type="thinking", thinking="...")],
            ),
            "no text content",
        ),
        (_text_response(raw_text="{not-json"), "malformed JSON"),
        (_text_response({"label": "maybe"}), "does not match the requested schema"),
    ],
)
def test_structured_output_rejects_invalid_responses(
    response: SimpleNamespace,
    message: str,
) -> None:
    client, adapter = _make_sync_adapter()
    client.messages.create.return_value = response

    with pytest.raises(ValueError, match=message):
        adapter.generate_object(
            "classify",
            SIMPLE_SCHEMA,
            method=ObjectGenerationMethod.STRUCTURED_OUTPUT,
        )


def test_tool_output_is_validated_against_schema() -> None:
    client, adapter = _make_sync_adapter()
    client.messages.create.return_value = _tool_response({"label": "maybe"})

    with pytest.raises(ValueError, match="does not match the requested schema"):
        adapter.generate_object(
            "classify",
            SIMPLE_SCHEMA,
            method=ObjectGenerationMethod.TOOL_CALLING,
        )
