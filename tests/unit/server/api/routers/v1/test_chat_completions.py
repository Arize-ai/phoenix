from __future__ import annotations

import json
from typing import Any, AsyncIterator, Union

import httpx
import httpx2
import pytest
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionChunk as OpenAIChatCompletionChunk
from pydantic_ai.exceptions import ModelAPIError
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
)
from pydantic_ai.models.function import AgentInfo, DeltaToolCalls, FunctionModel
from starlette.types import ASGIApp
from strawberry.relay import GlobalID

import phoenix.server.api.routers.v1.chat_completions as chat_completions_module
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.agents.model_selection import (
    AgentModelSelection,
    BuiltInProviderModelSelection,
    CustomProviderModelSelection,
)

_ANSWER = "span_kind == 'LLM'"
_STREAM_DELTAS = ("span_kind ", "== ", "'LLM'")


class _BuildModelSpy:
    """Stands in for ``build_model``: records the parsed selection and the
    messages the endpoint hands to the provider, and serves canned output."""

    def __init__(self) -> None:
        self.selections: list[AgentModelSelection] = []
        self.messages: list[ModelMessage] = []

    async def __call__(self, selection: AgentModelSelection, **_: Any) -> FunctionModel:
        self.selections.append(selection)

        def respond(messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
            self.messages = messages
            return ModelResponse(parts=[TextPart(content=_ANSWER)])

        async def respond_stream(
            messages: list[ModelMessage], _info: AgentInfo
        ) -> AsyncIterator[Union[str, DeltaToolCalls]]:
            self.messages = messages
            for delta in _STREAM_DELTAS:
                yield delta

        return FunctionModel(function=respond, stream_function=respond_stream)


@pytest.fixture
def build_model_spy(monkeypatch: pytest.MonkeyPatch) -> _BuildModelSpy:
    spy = _BuildModelSpy()
    monkeypatch.setattr(chat_completions_module, "build_model", spy)
    return spy


@pytest.fixture
def openai_client(asgi_app: ASGIApp) -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url="http://test/v1",
        api_key="sk-unused",  # the app under test runs with authentication disabled
        # the openai SDK is httpx2-based; the shared httpx fixture cannot back its transport
        http_client=httpx2.AsyncClient(transport=httpx2.ASGITransport(app=asgi_app)),
        max_retries=0,  # surface the first response instead of retrying 5xx
    )


def _request_body(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": "anthropic:claude-sonnet-4-5",
        "messages": [
            {"role": "system", "content": "Translate the request into a filter expression."},
            {"role": "user", "content": "llm spans"},
        ],
    }
    body.update(overrides)
    return body


def _data_events(sse_text: str) -> list[str]:
    return [line[len("data: ") :] for line in sse_text.splitlines() if line.startswith("data: ")]


def _validated_chunks(sse_text: str) -> list[dict[str, Any]]:
    events = _data_events(sse_text)
    assert events[-1] == "[DONE]", events[-1]
    payloads = [json.loads(event) for event in events[:-1]]
    for payload in payloads:
        OpenAIChatCompletionChunk.model_validate(payload)
    return payloads


class TestCreateChatCompletion:
    async def test_returns_openai_response_shape(
        self,
        openai_client: AsyncOpenAI,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        completion = await openai_client.chat.completions.create(
            model="anthropic:claude-sonnet-4-5",
            messages=[
                {"role": "system", "content": "Translate the request into a filter expression."},
                {"role": "user", "content": "llm spans"},
            ],
        )
        assert completion.id.startswith("chatcmpl-")
        assert completion.object == "chat.completion"
        assert completion.model == "anthropic:claude-sonnet-4-5"
        (choice,) = completion.choices
        assert choice.index == 0
        assert choice.message.role == "assistant"
        assert choice.message.content == _ANSWER
        assert choice.finish_reason == "stop"
        assert (usage := completion.usage) is not None
        assert usage.total_tokens == usage.prompt_tokens + usage.completion_tokens

    async def test_resolves_builtin_model_selection_and_messages(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        body = _request_body(
            messages=[
                {"role": "system", "content": "be terse"},
                {"role": "user", "content": [{"type": "text", "text": "llm spans"}]},
                {"role": "assistant", "content": "span_kind"},
                {"role": "user", "content": "fix it"},
            ]
        )
        response = await httpx_client.post("v1/chat/completions", json=body)
        assert response.status_code == 200, response.text

        (selection,) = build_model_spy.selections
        assert isinstance(selection, BuiltInProviderModelSelection)
        assert selection.provider is ModelProvider.ANTHROPIC
        assert selection.model_name == "claude-sonnet-4-5"

        system, user, assistant, followup = build_model_spy.messages
        assert isinstance(system, ModelRequest)
        assert isinstance(system.parts[0], SystemPromptPart)
        assert system.parts[0].content == "be terse"
        assert isinstance(user, ModelRequest)
        assert isinstance(user.parts[0], UserPromptPart)
        assert user.parts[0].content == "llm spans"
        assert isinstance(assistant, ModelResponse)
        assert isinstance(assistant.parts[0], TextPart)
        assert assistant.parts[0].content == "span_kind"
        assert isinstance(followup, ModelRequest)
        assert isinstance(followup.parts[0], UserPromptPart)

    async def test_model_name_keeps_colons(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        response = await httpx_client.post(
            "v1/chat/completions", json=_request_body(model="ollama:llama3:8b")
        )
        assert response.status_code == 200, response.text
        (selection,) = build_model_spy.selections
        assert isinstance(selection, BuiltInProviderModelSelection)
        assert selection.provider is ModelProvider.OLLAMA
        assert selection.model_name == "llama3:8b"

    @pytest.mark.parametrize("prefix", ["custom", "Custom"])
    async def test_custom_provider_model_selection(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
        prefix: str,
    ) -> None:
        provider_id = str(GlobalID("GenerativeModelCustomProvider", "7"))
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(model=f"{prefix}:{provider_id}:my-model"),
        )
        assert response.status_code == 200, response.text
        (selection,) = build_model_spy.selections
        assert isinstance(selection, CustomProviderModelSelection)
        assert selection.provider_id == provider_id
        assert selection.model_name == "my-model"

    async def test_streaming_emits_openai_chunks(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        response = await httpx_client.post("v1/chat/completions", json=_request_body(stream=True))
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")

        chunks = _validated_chunks(response.text)
        assert all(chunk["object"] == "chat.completion.chunk" for chunk in chunks)
        assert all(chunk["model"] == "anthropic:claude-sonnet-4-5" for chunk in chunks)
        assert len({chunk["id"] for chunk in chunks}) == 1

        assert chunks[0]["choices"][0]["delta"]["role"] == "assistant"
        content = "".join(chunk["choices"][0]["delta"].get("content", "") for chunk in chunks)
        assert content == "".join(_STREAM_DELTAS)

        final = chunks[-1]["choices"][0]
        assert final["delta"] == {}
        assert final["finish_reason"] == "stop"
        # Without stream_options.include_usage, no chunk reports usage.
        assert all("usage" not in chunk for chunk in chunks)

    async def test_streaming_with_include_usage_emits_final_usage_chunk(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(stream=True, stream_options={"include_usage": True}),
        )
        assert response.status_code == 200, response.text

        *deltas, usage_chunk = _validated_chunks(response.text)
        assert all(chunk["usage"] is None for chunk in deltas)
        assert deltas[-1]["choices"][0]["finish_reason"] == "stop"
        assert usage_chunk["choices"] == []
        usage = usage_chunk["usage"]
        assert usage["total_tokens"] == usage["prompt_tokens"] + usage["completion_tokens"]

    async def test_stream_options_without_stream_is_rejected(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(stream_options={"include_usage": True}),
        )
        assert response.status_code == 400, response.text
        assert "stream_options" in response.json()["error"]["message"]
        assert not build_model_spy.selections

    @pytest.mark.parametrize(
        "model",
        [
            pytest.param("gpt-4o", id="no_provider_prefix"),
            pytest.param("not-a-provider:gpt-4o", id="unrecognized_provider"),
            pytest.param("custom:only-an-id", id="custom_without_model_name"),
            pytest.param("openai:", id="empty_model_name"),
        ],
    )
    async def test_unknown_model_returns_openai_error(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
        model: str,
    ) -> None:
        response = await httpx_client.post("v1/chat/completions", json=_request_body(model=model))
        assert response.status_code == 404, response.text
        error = response.json()["error"]
        assert error["code"] == "model_not_found"
        assert error["type"] == "invalid_request_error"
        assert model in error["message"]
        assert not build_model_spy.selections

    async def test_tools_are_rejected(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(
                tools=[{"type": "function", "function": {"name": "f", "parameters": {}}}]
            ),
        )
        assert response.status_code == 400, response.text
        assert "Tool calling" in response.json()["error"]["message"]
        assert not build_model_spy.selections

    @pytest.mark.parametrize("stream", [False, True])
    async def test_provider_connection_failure_returns_openai_502(
        self,
        httpx_client: httpx.AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
        stream: bool,
    ) -> None:
        async def build_unreachable_model(*_: Any, **__: Any) -> FunctionModel:
            def respond(messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
                raise ModelAPIError("claude-sonnet-4-5", "connection refused")

            async def respond_stream(
                messages: list[ModelMessage], _info: AgentInfo
            ) -> AsyncIterator[Union[str, DeltaToolCalls]]:
                raise ModelAPIError("claude-sonnet-4-5", "connection refused")
                yield ""

            return FunctionModel(function=respond, stream_function=respond_stream)

        monkeypatch.setattr(chat_completions_module, "build_model", build_unreachable_model)
        response = await httpx_client.post("v1/chat/completions", json=_request_body(stream=stream))
        assert response.status_code == 502, response.text
        error = response.json()["error"]
        assert error["type"] == "api_error"
        assert "connection refused" in error["message"]

    async def test_malformed_custom_provider_id_returns_404(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(model="custom:not-a-global-id:gpt-4"),
        )
        assert response.status_code == 404, response.text
        error = response.json()["error"]
        assert error["code"] == "model_not_found"
        assert "Unknown model" in error["message"]

    async def test_validation_failure_returns_openai_error_shape(
        self,
        httpx_client: httpx.AsyncClient,
        build_model_spy: _BuildModelSpy,
    ) -> None:
        body = _request_body(
            messages=[{"role": "tool", "content": "result", "tool_call_id": "call_1"}]
        )
        response = await httpx_client.post("v1/chat/completions", json=body)
        assert response.status_code == 422, response.text
        error = response.json()["error"]
        assert error["type"] == "invalid_request_error"
        assert "role" in error["message"]
        assert not build_model_spy.selections

    async def test_custom_provider_not_found_returns_404(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        provider_id = str(GlobalID("GenerativeModelCustomProvider", "999999"))
        response = await httpx_client.post(
            "v1/chat/completions",
            json=_request_body(model=f"custom:{provider_id}:my-model"),
        )
        assert response.status_code == 404, response.text
        assert "not found" in response.json()["error"]["message"].lower()

    async def test_missing_builtin_credentials_returns_openai_error(
        self,
        httpx_client: httpx.AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        monkeypatch.delenv("DEEPSEEK_BASE_URL", raising=False)
        response = await httpx_client.post(
            "v1/chat/completions", json=_request_body(model="deepseek:deepseek-chat")
        )
        assert response.status_code == 400, response.text
        error = response.json()["error"]
        assert error["type"] == "invalid_request_error"
        assert "DEEPSEEK" in error["message"].upper()
