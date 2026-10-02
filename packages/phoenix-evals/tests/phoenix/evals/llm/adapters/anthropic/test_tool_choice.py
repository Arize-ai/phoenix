# type: ignore
"""Tests for tool_choice selection in AnthropicAdapter (issue #16395)."""

from unittest.mock import MagicMock

import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter


def _make_sync_adapter(model: str) -> tuple[AnthropicAdapter, MagicMock]:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "Anthropic"
    response = MagicMock()
    content_block = MagicMock()
    content_block.type = "tool_use"
    content_block.input = {"label": "yes"}
    response.content = [content_block]
    client.messages.create = MagicMock(return_value=response)
    adapter = AnthropicAdapter(client=client, model=model)
    return adapter, client.messages.create


class _AsyncAnthropicMock:
    __module__ = "anthropic"


def _make_async_adapter(model: str) -> tuple[AnthropicAdapter, MagicMock]:
    client = MagicMock(spec=_AsyncAnthropicMock)
    client.__class__.__name__ = "AsyncAnthropic"
    client.__module__ = "anthropic"
    response = MagicMock()
    content_block = MagicMock()
    content_block.type = "tool_use"
    content_block.input = {"label": "yes"}
    response.content = [content_block]

    mock_create = MagicMock()

    async def async_create(*args, **kwargs):
        mock_create(*args, **kwargs)
        return response

    client.messages = MagicMock()
    client.messages.create = async_create
    adapter = AnthropicAdapter(client=client, model=model)
    return adapter, mock_create


@pytest.mark.parametrize(
    "model,expected_tool_choice",
    [
        ("claude-3-sonnet", {"type": "tool", "name": "extract_structured_data"}),
        ("claude-3-5-sonnet-20241022", {"type": "tool", "name": "extract_structured_data"}),
        ("us.anthropic.claude-opus-5", {"type": "tool", "name": "extract_structured_data"}),
        ("claude-opus-5-5", {"type": "auto"}),
        ("us.anthropic.claude-opus-5-5", {"type": "auto"}),
        ("global.anthropic.claude-opus-5-5", {"type": "auto"}),
        ("claude-fable-5-1", {"type": "auto"}),
        ("us.anthropic.claude-fable-5-1", {"type": "auto"}),
    ],
)
def test_sync_generate_object_tool_choice(model: str, expected_tool_choice: dict) -> None:
    adapter, create_mock = _make_sync_adapter(model)
    schema = {"type": "object", "properties": {"label": {"type": "string"}}}
    result = adapter.generate_object("Test prompt", schema)
    assert result == {"label": "yes"}
    call_kwargs = create_mock.call_args[1]
    assert call_kwargs["tool_choice"] == expected_tool_choice


@pytest.mark.parametrize(
    "model,expected_tool_choice",
    [
        ("claude-3-sonnet", {"type": "tool", "name": "extract_structured_data"}),
        ("us.anthropic.claude-opus-5-5", {"type": "auto"}),
        ("claude-fable-5-1", {"type": "auto"}),
    ],
)
@pytest.mark.asyncio
async def test_async_generate_object_tool_choice(model: str, expected_tool_choice: dict) -> None:
    adapter, create_mock = _make_async_adapter(model)
    schema = {"type": "object", "properties": {"label": {"type": "string"}}}
    result = await adapter.async_generate_object("Test prompt", schema)
    assert result == {"label": "yes"}
    call_kwargs = create_mock.call_args[1]
    assert call_kwargs["tool_choice"] == expected_tool_choice
