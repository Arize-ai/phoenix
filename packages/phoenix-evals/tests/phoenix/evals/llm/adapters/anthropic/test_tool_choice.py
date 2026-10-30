"""``AnthropicAdapter`` object generation never forces a ``tool_choice``.

The mocked API below rejects a forced ``tool_choice`` the way some models do, so these tests fail
if object generation sends one.
"""

import json
from typing import Any, Dict, List

import anthropic
import httpx2

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter

_SCHEMA = {"type": "object", "properties": {"label": {"type": "string"}}, "required": ["label"]}
_INSTRUCTION = "Respond by calling the `extract_structured_data` tool."


def _respond(body: Dict[str, Any]) -> httpx2.Response:
    if body["tool_choice"]["type"] in ("tool", "any"):
        return httpx2.Response(
            400,
            json={
                "type": "error",
                "error": {
                    "type": "invalid_request_error",
                    "message": 'tool_choice: type "tool" and "any" are not supported for this model.',
                },
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


def test_asks_for_the_tool_call_in_the_system_prompt() -> None:
    requests: List[Dict[str, Any]] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _respond(requests[-1])

    client = anthropic.Anthropic(
        api_key="test",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    adapter = AnthropicAdapter(client=client, model="claude-test")

    assert adapter.generate_object("q", _SCHEMA) == {"label": "a"}
    assert requests[0]["tool_choice"] == {"type": "auto"}
    assert requests[0]["system"] == _INSTRUCTION


async def test_async_appends_the_tool_instruction_to_the_prompt_system_message() -> None:
    requests: List[Dict[str, Any]] = []

    async def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _respond(requests[-1])

    client = anthropic.AsyncAnthropic(
        api_key="test",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    adapter = AnthropicAdapter(client=client, model="claude-test")
    prompt = [{"role": "system", "content": "Be strict."}, {"role": "user", "content": "q"}]

    assert await adapter.async_generate_object(prompt, _SCHEMA) == {"label": "a"}
    assert requests[0]["tool_choice"] == {"type": "auto"}
    assert requests[0]["system"] == f"Be strict.\n\n{_INSTRUCTION}"


def test_appends_the_tool_instruction_to_a_system_kwarg() -> None:
    requests: List[Dict[str, Any]] = []

    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return _respond(requests[-1])

    client = anthropic.Anthropic(
        api_key="test",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    adapter = AnthropicAdapter(client=client, model="claude-test")

    assert adapter.generate_object("q", _SCHEMA, system="Be strict.") == {"label": "a"}
    assert requests[0]["system"] == f"Be strict.\n\n{_INSTRUCTION}"
