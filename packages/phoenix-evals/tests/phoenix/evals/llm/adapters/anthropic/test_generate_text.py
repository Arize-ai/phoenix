"""``AnthropicAdapter`` text generation against a mocked Messages API."""

from typing import Any, Dict, List

import anthropic
import httpx2
import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter

_THINKING = {"type": "thinking", "thinking": "", "signature": "sig"}


def _message(content: List[Dict[str, Any]], stop_reason: str = "end_turn") -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": "claude-test",
            "content": content,
            "stop_reason": stop_reason,
            "usage": {"input_tokens": 1, "output_tokens": 1},
        },
    )


def _sync_adapter(response: httpx2.Response) -> AnthropicAdapter:
    client = anthropic.Anthropic(
        api_key="test",
        http_client=httpx2.Client(transport=httpx2.MockTransport(lambda _: response)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model="claude-test")


def _async_adapter(response: httpx2.Response) -> AnthropicAdapter:
    async def handler(_: httpx2.Request) -> httpx2.Response:
        return response

    client = anthropic.AsyncAnthropic(
        api_key="test",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model="claude-test")


@pytest.mark.parametrize(
    "content, stop_reason, expected",
    [
        pytest.param(
            [_THINKING, {"type": "text", "text": "Paris"}], "end_turn", "Paris", id="after-thinking"
        ),
        pytest.param(
            [{"type": "text", "text": "Par"}, {"type": "text", "text": "is"}],
            "end_turn",
            "Paris",
            id="several-text-blocks",
        ),
        pytest.param([{"type": "text", "text": "Par"}], "max_tokens", "Par", id="truncated"),
    ],
)
def test_returns_the_text_blocks(
    content: List[Dict[str, Any]], stop_reason: str, expected: str
) -> None:
    adapter = _sync_adapter(_message(content, stop_reason))

    assert adapter.generate_text("q") == expected


async def test_async_returns_the_text_after_a_thinking_block() -> None:
    adapter = _async_adapter(_message([_THINKING, {"type": "text", "text": "Paris"}]))

    assert await adapter.async_generate_text("q") == "Paris"


@pytest.mark.parametrize(
    "content, stop_reason, error",
    [
        pytest.param([], "refusal", "refused", id="refusal"),
        pytest.param([_THINKING], "max_tokens", "Raise max_tokens", id="thinking-used-max-tokens"),
        pytest.param([_THINKING], "end_turn", "no text", id="no-text"),
    ],
)
def test_raises_when_there_is_no_text_to_return(
    content: List[Dict[str, Any]], stop_reason: str, error: str
) -> None:
    adapter = _sync_adapter(_message(content, stop_reason))

    with pytest.raises(ValueError, match=error):
        adapter.generate_text("q")


async def test_async_raises_on_a_refusal() -> None:
    adapter = _async_adapter(_message([], "refusal"))

    with pytest.raises(ValueError, match="refused"):
        await adapter.async_generate_text("q")
