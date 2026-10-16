"""``AnthropicAdapter`` sends sampling parameters in the request body.

``anthropic>=1`` dropped ``temperature``, ``top_p`` and ``top_k`` from ``messages.create()``, so
forwarding them as keyword arguments raised a ``TypeError`` before any request was made. These
tests use real SDK clients over a mocked transport, so they exercise that signature.
"""

import json
from typing import Any, Dict, List

import anthropic
import httpx2

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter

_SCHEMA = {"type": "object", "properties": {"label": {"type": "string"}}, "required": ["label"]}


def _response(body: Dict[str, Any]) -> httpx2.Response:
    if body.get("tools"):
        content = [
            {
                "type": "tool_use",
                "id": "t1",
                "name": "extract_structured_data",
                "input": {"label": "a"},
            }
        ]
    else:
        content = [{"type": "text", "text": "answer"}]
    return httpx2.Response(
        200,
        json={
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": body["model"],
            "content": content,
            "stop_reason": "end_turn",
            "usage": {"input_tokens": 1, "output_tokens": 1},
        },
    )


def _sync_adapter(requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _response(requests[-1])

    client = anthropic.Anthropic(
        api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    return AnthropicAdapter(client=client, model="claude-opus-5")


def _async_adapter(requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _response(requests[-1])

    client = anthropic.AsyncAnthropic(
        api_key="test", http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler))
    )
    return AnthropicAdapter(client=client, model="claude-opus-5")


def test_generate_text_sends_sampling_params_in_the_body() -> None:
    requests: List[Dict[str, Any]] = []
    text = _sync_adapter(requests).generate_text("q", temperature=0.0, top_p=0.9, top_k=5)

    assert text == "answer"
    assert requests[0]["temperature"] == 0.0
    assert requests[0]["top_p"] == 0.9
    assert requests[0]["top_k"] == 5


def test_generate_object_sends_sampling_params_in_the_body() -> None:
    requests: List[Dict[str, Any]] = []
    result = _sync_adapter(requests).generate_object("q", _SCHEMA, temperature=0.0)

    assert result == {"label": "a"}
    assert requests[0]["temperature"] == 0.0


async def test_async_generate_text_sends_sampling_params_in_the_body() -> None:
    requests: List[Dict[str, Any]] = []
    text = await _async_adapter(requests).async_generate_text("q", temperature=0.0)

    assert text == "answer"
    assert requests[0]["temperature"] == 0.0


async def test_async_generate_object_sends_sampling_params_in_the_body() -> None:
    requests: List[Dict[str, Any]] = []
    result = await _async_adapter(requests).async_generate_object("q", _SCHEMA, temperature=0.0)

    assert result == {"label": "a"}
    assert requests[0]["temperature"] == 0.0


def test_explicit_extra_body_takes_precedence_and_is_kept() -> None:
    requests: List[Dict[str, Any]] = []
    _sync_adapter(requests).generate_text(
        "q", temperature=0.0, extra_body={"temperature": 0.5, "service_tier": "auto"}
    )

    assert requests[0]["temperature"] == 0.5
    assert requests[0]["service_tier"] == "auto"


def test_requests_without_sampling_params_are_unchanged() -> None:
    requests: List[Dict[str, Any]] = []
    _sync_adapter(requests).generate_text("q")

    assert not {"temperature", "top_p", "top_k"} & set(requests[0])
    assert requests[0]["max_tokens"] == 4096
