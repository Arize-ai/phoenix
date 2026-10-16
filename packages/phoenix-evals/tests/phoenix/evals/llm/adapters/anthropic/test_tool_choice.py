"""``AnthropicAdapter`` object generation with models that reject a forced ``tool_choice``.

Claude Opus 5.5, Sonnet 5.5, Fable 5.1 and Mythos 5.1 answer a forced ``tool_choice``
(``{"type": "tool"}`` or ``{"type": "any"}``) with a 400. The mocked API below does the same.
"""

import json
from typing import Any, Dict, List

import anthropic
import httpx2
import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter

_SCHEMA = {"type": "object", "properties": {"label": {"type": "string"}}, "required": ["label"]}
_REJECTS_FORCING = ("claude-fable-5-1", "claude-mythos-5-1", "claude-opus-5-5", "claude-sonnet-5-5")


def _response(body: Dict[str, Any]) -> httpx2.Response:
    if body.get("tool_choice", {}).get("type") in ("tool", "any") and body["model"].startswith(
        _REJECTS_FORCING
    ):
        return httpx2.Response(
            400,
            json={
                "type": "error",
                "error": {"type": "invalid_request_error", "message": "tool_choice forcing"},
            },
        )
    return httpx2.Response(
        200,
        json={
            "id": "msg_1",
            "type": "message",
            "role": "assistant",
            "model": body["model"],
            "content": [
                {
                    "type": "tool_use",
                    "id": "t1",
                    "name": "extract_structured_data",
                    "input": {"label": "a"},
                }
            ],
            "stop_reason": "tool_use",
            "usage": {"input_tokens": 1, "output_tokens": 1},
        },
    )


def _sync_adapter(model: str, requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _response(requests[-1])

    client = anthropic.Anthropic(
        api_key="test",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model=model)


def _async_adapter(model: str, requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _response(requests[-1])

    client = anthropic.AsyncAnthropic(
        api_key="test",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model=model)


@pytest.mark.parametrize(
    "model",
    ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1", "claude-mythos-5-1"],
)
def test_models_that_reject_forcing_get_auto_tool_choice(model: str) -> None:
    requests: List[Dict[str, Any]] = []
    result = _sync_adapter(model, requests).generate_object("q", _SCHEMA)

    assert result == {"label": "a"}
    assert requests[0]["tool_choice"] == {"type": "auto"}


@pytest.mark.parametrize("model", ["claude-opus-5", "claude-sonnet-5", "claude-haiku-5-5"])
def test_other_models_still_force_the_tool(model: str) -> None:
    requests: List[Dict[str, Any]] = []
    result = _sync_adapter(model, requests).generate_object("q", _SCHEMA)

    assert result == {"label": "a"}
    assert requests[0]["tool_choice"] == {"type": "tool", "name": "extract_structured_data"}


async def test_async_generate_object_uses_auto_tool_choice_for_opus_5_5() -> None:
    requests: List[Dict[str, Any]] = []
    result = await _async_adapter("claude-opus-5-5", requests).async_generate_object("q", _SCHEMA)

    assert result == {"label": "a"}
    assert requests[0]["tool_choice"] == {"type": "auto"}
