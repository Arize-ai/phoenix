"""``AnthropicAdapter`` object generation with native structured output (``output_config.format``).

A mocked Messages API records each request and replies with a canned response.
"""

import json
from typing import Any, Callable, Dict, List

import anthropic
import httpx2
import pytest

from phoenix.evals.llm.adapters.anthropic.adapter import AnthropicAdapter
from phoenix.evals.llm.types import ObjectGenerationMethod

_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["good", "bad"]},
        "explanation": {"type": "string"},
    },
    "required": ["label"],
}
_EXPECTED_FORMAT = {
    "type": "json_schema",
    "schema": {**_SCHEMA, "additionalProperties": False},
}

Responder = Callable[[Dict[str, Any]], httpx2.Response]


def _message(
    content: List[Dict[str, Any]], stop_reason: str = "end_turn", **extra: Any
) -> httpx2.Response:
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
            **extra,
        },
    )


def _text(text: str, stop_reason: str = "end_turn", **extra: Any) -> httpx2.Response:
    return _message([{"type": "text", "text": text}], stop_reason, **extra)


def _tool_use(tool_input: Dict[str, Any]) -> httpx2.Response:
    return _message(
        [{"type": "tool_use", "id": "t1", "name": "extract_structured_data", "input": tool_input}],
        "tool_use",
    )


def _bad_request(message: str) -> httpx2.Response:
    return httpx2.Response(
        400,
        json={"type": "error", "error": {"type": "invalid_request_error", "message": message}},
    )


def _reject_native_requests(body: Dict[str, Any]) -> httpx2.Response:
    if "output_config" in body:
        return _bad_request("output_config.format: structured outputs are not supported.")
    return _tool_use({"label": "bad"})


def _sync_adapter(respond: Responder, requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return respond(requests[-1])

    client = anthropic.Anthropic(
        api_key="test",
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model="claude-test")


def _async_adapter(respond: Responder, requests: List[Dict[str, Any]]) -> AnthropicAdapter:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        requests.append(json.loads(request.content))
        return respond(requests[-1])

    client = anthropic.AsyncAnthropic(
        api_key="test",
        http_client=httpx2.AsyncClient(transport=httpx2.MockTransport(handler)),
        max_retries=0,
    )
    return AnthropicAdapter(client=client, model="claude-test")


@pytest.mark.parametrize(
    "method", [ObjectGenerationMethod.STRUCTURED_OUTPUT, ObjectGenerationMethod.AUTO]
)
def test_sends_the_schema_as_native_output_format(method: ObjectGenerationMethod) -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"label": "good"}'), requests)

    assert adapter.generate_object("q", _SCHEMA, method=method) == {"label": "good"}
    assert requests[0]["output_config"] == {"format": _EXPECTED_FORMAT}
    assert "tools" not in requests[0]
    assert "system" not in requests[0]


async def test_async_sends_the_same_schema_as_sync() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _async_adapter(lambda _: _text('{"label": "good"}'), requests)
    prompt = [{"role": "system", "content": "Be strict."}, {"role": "user", "content": "q"}]

    assert await adapter.async_generate_object(prompt, _SCHEMA) == {"label": "good"}
    assert requests[0]["output_config"] == {"format": _EXPECTED_FORMAT}
    assert requests[0]["system"] == "Be strict."


def test_keeps_other_output_config_settings() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"label": "good"}'), requests)

    adapter.generate_object("q", _SCHEMA, output_config={"effort": "low"})

    assert requests[0]["output_config"] == {"effort": "low", "format": _EXPECTED_FORMAT}


def test_auto_falls_back_to_tool_calling_and_remembers_it() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(_reject_native_requests, requests)

    assert adapter.generate_object("q", _SCHEMA) == {"label": "bad"}
    assert adapter.generate_object("q", _SCHEMA) == {"label": "bad"}
    assert ["output_config" in r for r in requests] == [True, False, False]
    assert requests[1]["tool_choice"] == {"type": "auto", "disable_parallel_tool_use": True}
    assert [tool["name"] for tool in requests[1]["tools"]] == ["extract_structured_data"]


async def test_async_auto_falls_back_to_tool_calling_and_remembers_it() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _async_adapter(_reject_native_requests, requests)

    assert await adapter.async_generate_object("q", _SCHEMA) == {"label": "bad"}
    assert await adapter.async_generate_object("q", _SCHEMA) == {"label": "bad"}
    assert ["output_config" in r for r in requests] == [True, False, False]


def test_auto_remembers_a_rejected_schema_but_not_for_other_schemas() -> None:
    def respond(body: Dict[str, Any]) -> httpx2.Response:
        if "output_config" in body:
            return _bad_request("output_config.format.schema: Schema type 'oneOf' is not supported")
        return _tool_use({"label": "bad"})

    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(respond, requests)

    other_schema = {**_SCHEMA, "required": []}

    assert adapter.generate_object("q", _SCHEMA) == {"label": "bad"}
    assert adapter.generate_object("q", _SCHEMA) == {"label": "bad"}
    assert adapter.generate_object("q", other_schema) == {"label": "bad"}
    assert ["output_config" in r for r in requests] == [True, False, False, True, False]


@pytest.mark.parametrize(
    "message",
    [
        "output_config.effort: 'xhigh' is not supported for this model",
        "This model does not support the effort parameter.",
    ],
)
def test_auto_raises_an_error_about_another_output_config_field(message: str) -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _bad_request(message), requests)

    for _ in range(2):
        with pytest.raises(anthropic.BadRequestError):
            adapter.generate_object("q", _SCHEMA, output_config={"effort": "xhigh"})
    assert ["output_config" in r and "format" in r["output_config"] for r in requests] == [
        True,
        True,
    ]


def test_keeps_native_output_for_property_names_that_are_keywords() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"minimum": 1, "oneOf": "a"}'), requests)
    schema = {
        "type": "object",
        "properties": {"minimum": {"type": "integer"}, "oneOf": {"type": "string"}},
        "required": ["minimum", "oneOf"],
    }

    assert adapter.generate_object("q", schema) == {"minimum": 1, "oneOf": "a"}
    sent = requests[0]["output_config"]["format"]["schema"]
    assert sent["properties"] == schema["properties"]


def test_does_not_send_tool_settings_with_native_output() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"label": "good"}'), requests)

    adapter.generate_object("q", _SCHEMA, tool_choice={"type": "auto"}, tools=[])

    assert "tool_choice" not in requests[0]
    assert "tools" not in requests[0]


class _OldSdkMessages:
    """A `messages` resource from an `anthropic` SDK without `output_config`."""

    def __init__(self, response: Dict[str, Any]) -> None:
        self.calls: List[Dict[str, Any]] = []
        self._response = response

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        system: Any = None,
        tools: Any = None,
        tool_choice: Any = None,
    ) -> Any:
        self.calls.append({"tools": tools, "tool_choice": tool_choice})
        return anthropic.types.Message.model_validate(self._response)


class _OldSdkClient:
    def __init__(self, response: Dict[str, Any]) -> None:
        self.messages = _OldSdkMessages(response)


_TOOL_USE_MESSAGE = {
    "id": "msg_1",
    "type": "message",
    "role": "assistant",
    "model": "claude-test",
    "content": [
        {
            "type": "tool_use",
            "id": "t1",
            "name": "extract_structured_data",
            "input": {"label": "bad"},
        }
    ],
    "stop_reason": "tool_use",
    "usage": {"input_tokens": 1, "output_tokens": 1},
}


def test_auto_uses_tool_calling_on_an_sdk_without_output_config() -> None:
    client = _OldSdkClient(_TOOL_USE_MESSAGE)
    adapter = AnthropicAdapter(client=client, model="claude-test")

    assert adapter.generate_object("q", _SCHEMA) == {"label": "bad"}
    assert len(client.messages.calls) == 1


def test_native_output_explains_an_sdk_without_output_config() -> None:
    adapter = AnthropicAdapter(client=_OldSdkClient(_TOOL_USE_MESSAGE), model="claude-test")

    with pytest.raises(ValueError, match="Upgrade `anthropic`"):
        adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.STRUCTURED_OUTPUT)


@pytest.mark.parametrize(
    "score",
    [
        pytest.param({"type": "integer", "minimum": 1}, id="number-constraint"),
        pytest.param({"oneOf": [{"type": "integer"}, {"type": "string"}]}, id="non-const-one-of"),
        pytest.param({"type": "object", "additionalProperties": True}, id="open-object"),
    ],
)
def test_auto_uses_tool_calling_for_a_schema_native_output_rejects(score: Dict[str, Any]) -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _tool_use({"score": 3}), requests)
    schema = {"type": "object", "properties": {"score": score}}

    assert adapter.generate_object("q", schema) == {"score": 3}
    assert len(requests) == 1
    assert "output_config" not in requests[0]


def test_sends_label_descriptions_as_any_of() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"label": "good"}'), requests)
    labels = [{"const": "good", "description": "Helpful"}, {"const": "bad"}]
    schema = {"type": "object", "properties": {"label": {"oneOf": labels}}, "required": ["label"]}

    assert adapter.generate_object("q", schema) == {"label": "good"}
    sent = requests[0]["output_config"]["format"]["schema"]
    assert sent["properties"]["label"] == {"anyOf": labels}


def test_reads_the_text_after_a_thinking_block() -> None:
    requests: List[Dict[str, Any]] = []
    thinking = {"type": "thinking", "thinking": "", "signature": "sig"}
    adapter = _sync_adapter(
        lambda _: _message([thinking, {"type": "text", "text": '{"label": "good"}'}]), requests
    )

    assert adapter.generate_object("q", _SCHEMA) == {"label": "good"}


def test_sends_a_system_kwarg_with_native_output() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text('{"label": "good"}'), requests)

    adapter.generate_object("q", _SCHEMA, system="Be strict.")

    assert requests[0]["system"] == "Be strict."


def test_auto_raises_an_unrelated_bad_request_without_falling_back() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _bad_request("max_tokens: must be at least 1"), requests)

    with pytest.raises(anthropic.BadRequestError):
        adapter.generate_object("q", _SCHEMA)
    assert len(requests) == 1


def test_native_output_does_not_fall_back_when_asked_for_explicitly() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(_reject_native_requests, requests)

    with pytest.raises(anthropic.BadRequestError):
        adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.STRUCTURED_OUTPUT)
    assert len(requests) == 1


@pytest.mark.parametrize(
    "response, error",
    [
        pytest.param(_text("not json"), "isn't valid JSON", id="malformed"),
        pytest.param(
            _text(
                "",
                "refusal",
                stop_details={"type": "refusal", "category": "cyber", "explanation": None},
            ),
            "refused",
            id="refusal",
        ),
        pytest.param(_text('{"label": "go', "max_tokens"), "max_tokens", id="truncated"),
        pytest.param(_text('{"explanation": "x"}'), "missing required fields", id="missing"),
        pytest.param(_text('{"label": "meh"}'), "isn't one of", id="outside-enum"),
        pytest.param(_text('["good"]'), "Expected a JSON object", id="not-an-object"),
    ],
)
def test_raises_on_output_that_does_not_match_the_schema(
    response: httpx2.Response, error: str
) -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: response, requests)

    with pytest.raises(ValueError, match=error):
        adapter.generate_object("q", _SCHEMA)
    assert len(requests) == 1


def test_validates_tool_calling_output_against_the_schema() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _tool_use({"label": "meh"}), requests)

    with pytest.raises(ValueError, match="isn't one of"):
        adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING)


def test_tool_calling_keeps_parallel_calls_off_with_a_caller_tool_choice() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _tool_use({"label": "good"}), requests)

    adapter.generate_object(
        "q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING, tool_choice={"type": "auto"}
    )

    assert requests[0]["tool_choice"] == {"type": "auto", "disable_parallel_tool_use": True}


def test_tool_calling_reports_a_refusal() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _text("", "refusal"), requests)

    with pytest.raises(ValueError, match="refused"):
        adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING)


def test_validates_a_label_against_const_choices() -> None:
    requests: List[Dict[str, Any]] = []
    adapter = _sync_adapter(lambda _: _tool_use({"label": "meh"}), requests)
    labels = [{"const": "good"}, {"const": "bad"}]
    schema = {"type": "object", "properties": {"label": {"oneOf": labels}}, "required": ["label"]}

    with pytest.raises(ValueError, match="isn't one of"):
        adapter.generate_object("q", schema, method=ObjectGenerationMethod.TOOL_CALLING)


def test_tool_calling_ignores_a_call_to_another_tool() -> None:
    requests: List[Dict[str, Any]] = []
    other_tool = {"type": "tool_use", "id": "t1", "name": "other", "input": {"label": "good"}}
    adapter = _sync_adapter(lambda _: _message([other_tool], "tool_use"), requests)

    with pytest.raises(ValueError, match="No tool use in response"):
        adapter.generate_object("q", _SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING)
