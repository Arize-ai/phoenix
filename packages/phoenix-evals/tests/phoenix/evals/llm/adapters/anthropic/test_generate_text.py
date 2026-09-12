# type: ignore
"""Tests for ``AnthropicAdapter.generate_text()`` / ``async_generate_text()`` response parsing."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter


def _make_sync_client() -> MagicMock:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "Anthropic"
    client.messages.create = MagicMock()
    # `_check_if_async_client` unwraps a `.client` attribute to support
    # `AnthropicClientWrapper`; a plain MagicMock auto-vivifies one, which
    # would shadow the `__module__`/`__class__` set above.
    del client.client
    return client


def _make_async_client() -> MagicMock:
    client = MagicMock()
    client.__module__ = "anthropic"
    client.__class__.__name__ = "AsyncAnthropic"
    client.messages.create = AsyncMock()
    del client.client
    return client


def _text_block(text: str) -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = text
    return block


def _thinking_block() -> MagicMock:
    block = MagicMock()
    block.type = "thinking"
    del block.text  # real ThinkingBlock objects have no `.text` attribute
    return block


def test_generate_text_returns_the_text_block() -> None:
    client = _make_sync_client()
    client.messages.create.return_value = MagicMock(content=[_text_block("42")])
    adapter = AnthropicAdapter(client=client, model="claude-3-sonnet")

    assert adapter.generate_text("what is the answer?") == "42"


def test_generate_text_finds_the_text_block_after_a_thinking_block() -> None:
    """A `thinking` kwarg makes Anthropic prepend thinking block(s) before `text`."""
    client = _make_sync_client()
    client.messages.create.return_value = MagicMock(
        content=[_thinking_block(), _text_block("The answer is 42.")]
    )
    adapter = AnthropicAdapter(client=client, model="claude-3-sonnet")

    result = adapter.generate_text(
        "what is the answer?", thinking={"type": "enabled", "budget_tokens": 1024}
    )

    assert result == "The answer is 42."


def test_generate_text_raises_when_no_block_has_text() -> None:
    client = _make_sync_client()
    client.messages.create.return_value = MagicMock(content=[_thinking_block()])
    adapter = AnthropicAdapter(client=client, model="claude-3-sonnet")

    with pytest.raises(ValueError, match="unexpected content format"):
        adapter.generate_text("what is the answer?")


async def test_async_generate_text_finds_the_text_block_after_a_thinking_block() -> None:
    client = _make_async_client()
    client.messages.create.return_value = MagicMock(
        content=[_thinking_block(), _text_block("The answer is 42.")]
    )
    adapter = AnthropicAdapter(client=client, model="claude-3-sonnet")

    result = await adapter.async_generate_text(
        "what is the answer?", thinking={"type": "enabled", "budget_tokens": 1024}
    )

    assert result == "The answer is 42."


async def test_async_generate_text_raises_when_no_block_has_text() -> None:
    client = _make_async_client()
    client.messages.create.return_value = MagicMock(content=[_thinking_block()])
    adapter = AnthropicAdapter(client=client, model="claude-3-sonnet")

    with pytest.raises(ValueError, match="unexpected content format"):
        await adapter.async_generate_text("what is the answer?")
