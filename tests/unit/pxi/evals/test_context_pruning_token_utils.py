from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest

from evals.pxi.experiments.context_pruning.token_utils import (
    count_tokens_anthropic,
    count_tokens_openai,
)


class _FakeMessages:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def count_tokens(self, *, messages: list[dict[str, Any]], model: str) -> Any:
        self.calls.append({"messages": messages, "model": model})
        return SimpleNamespace(input_tokens=42)


class _FakeAnthropicClient:
    def __init__(self) -> None:
        self.messages = _FakeMessages()


@pytest.mark.asyncio
async def test_count_tokens_anthropic_uses_count_tokens_api() -> None:
    client = _FakeAnthropicClient()
    messages = [{"role": "user", "content": "hello"}]

    count = await count_tokens_anthropic(messages, "claude-opus-4-6", client=client)

    assert count == 42
    assert client.messages.calls == [{"messages": messages, "model": "claude-opus-4-6"}]


def test_count_tokens_openai_uses_tiktoken_model_encoding() -> None:
    assert count_tokens_openai("hello world", "gpt-4o") == 2


def test_count_tokens_openai_falls_back_for_unknown_model() -> None:
    assert count_tokens_openai("hello world", "gpt-5.4") == 2
