from __future__ import annotations

from collections.abc import Iterable
from typing import Any


async def count_tokens_anthropic(
    messages: Iterable[dict[str, Any]],
    model: str,
    *,
    client: Any | None = None,
) -> int:
    """Count prompt tokens for Anthropic chat messages."""
    if client is None:
        from anthropic import AsyncAnthropic

        resolved_client: Any = AsyncAnthropic()
    else:
        resolved_client = client
    result = await resolved_client.messages.count_tokens(messages=messages, model=model)
    return int(result.input_tokens)


def count_tokens_openai(text: str, model: str) -> int:
    """Count text tokens using the tokenizer for an OpenAI model."""
    import tiktoken

    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        encoding = tiktoken.get_encoding("o200k_base")
    return len(encoding.encode(text))
