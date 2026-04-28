import json
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import httpx
import pytest

from phoenix.db.types.model_provider import (
    AnthropicCustomProviderConfig,
    AzureOpenAICustomProviderConfig,
    OpenAICustomProviderConfig,
)
from phoenix.server.api.routers import chat as chat_router
from tests.unit.vcr import CustomVCR

_CHAT_PARAMS = {
    "provider_type": "builtin",
    "provider": "ANTHROPIC",
    "model_name": "claude-haiku-4-5-20251001",
}

_CHAT_BODY = {
    "trigger": "submit-message",
    "id": "test-session-1",
    "sessionId": "test-session-1",
    "messages": [
        {
            "id": "test-msg-1",
            "role": "user",
            "parts": [
                {
                    "type": "text",
                    "text": "What is the capital of France? Answer in one word.",
                }
            ],
        }
    ],
}

_UPSERT_OR_DELETE_SECRETS_MUTATION = """
mutation UpsertOrDeleteSecrets($input: UpsertOrDeleteSecretsMutationInput!) {
  upsertOrDeleteSecrets(input: $input) {
    upsertedSecrets {
      key
    }
  }
}
"""

_CREATE_CUSTOM_PROVIDER_MUTATION = """
mutation CreateGenerativeModelCustomProviderMutation(
  $input: CreateGenerativeModelCustomProviderMutationInput!
) {
  createGenerativeModelCustomProvider(input: $input) {
    provider {
      id
    }
  }
}
"""

_EXISTING_CHAT_CASSETTE = (
    Path(__file__).parent / "cassettes" / "test_chat" / "TestChatRouter.test_chat_completion.yaml"
)


@pytest.fixture(autouse=True)
def _enable_agents(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_DANGEROUSLY_ENABLE_AGENTS", "true")
    # Prevent the MCP docs client from making outbound calls to the
    # Mintlify endpoint during VCR-recorded tests.
    monkeypatch.setenv("PHOENIX_ALLOW_EXTERNAL_RESOURCES", "false")


class TestChatRouter:
    async def test_chat_completion(
        self,
        httpx_client: httpx.AsyncClient,
        anthropic_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        with custom_vcr.use_cassette():
            response = await httpx_client.post("/chat", params=_CHAT_PARAMS, json=_CHAT_BODY)

        _assert_successful_chat_stream(response, session_id="test-session-1")

    async def test_chat_completion_uses_secret_backed_builtin_provider(
        self,
        httpx_client: httpx.AsyncClient,
        gql_client: Any,
        monkeypatch: pytest.MonkeyPatch,
        custom_vcr: CustomVCR,
    ) -> None:
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        result = await gql_client.execute(
            query=_UPSERT_OR_DELETE_SECRETS_MUTATION,
            variables={
                "input": {"secrets": [{"key": "ANTHROPIC_API_KEY", "value": "sk-0123456789"}]}
            },
        )
        assert not result.errors

        with custom_vcr.use_cassette(path=_EXISTING_CHAT_CASSETTE):
            response = await httpx_client.post("/chat", params=_CHAT_PARAMS, json=_CHAT_BODY)

        _assert_successful_chat_stream(response, session_id="test-session-1")

    async def test_chat_completion_uses_settings_backed_custom_provider(
        self,
        httpx_client: httpx.AsyncClient,
        gql_client: Any,
        monkeypatch: pytest.MonkeyPatch,
        custom_vcr: CustomVCR,
    ) -> None:
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        result = await gql_client.execute(
            query=_CREATE_CUSTOM_PROVIDER_MUTATION,
            variables={
                "input": {
                    "name": "PXI Anthropic Provider",
                    "provider": "anthropic",
                    "clientConfig": {
                        "anthropic": {"anthropicAuthenticationMethod": {"apiKey": "sk-0123456789"}}
                    },
                }
            },
            operation_name="CreateGenerativeModelCustomProviderMutation",
        )
        assert not result.errors
        assert result.data is not None
        provider_id = result.data["createGenerativeModelCustomProvider"]["provider"]["id"]

        with custom_vcr.use_cassette(path=_EXISTING_CHAT_CASSETTE):
            response = await httpx_client.post(
                "/chat",
                params={
                    "provider_type": "custom",
                    "provider_id": provider_id,
                    "model_name": _CHAT_PARAMS["model_name"],
                },
                json=_CHAT_BODY,
            )

        _assert_successful_chat_stream(response, session_id="test-session-1")


class TestCustomProviderModels:
    async def test_openai_family_custom_providers_disable_sdk_retries(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import openai

        class DummyAsyncOpenAI:
            def __init__(self, **kwargs: Any) -> None:
                self.kwargs = kwargs
                self.base_url = kwargs.get("base_url", "https://example.test/v1")

        monkeypatch.setattr(openai, "AsyncOpenAI", DummyAsyncOpenAI)

        openai_config = OpenAICustomProviderConfig(
            openai_authentication_method={"type": "api_key", "api_key": "sk-test-openai"},
            openai_client_kwargs={
                "base_url": "https://openai.example.test/v1",
                "organization": "org-1",
                "project": "project-1",
            },
            openai_api_type="responses",
        )
        openai_model = (
            await chat_router._get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=SimpleNamespace(config=openai_config.model_dump_json().encode()),
                model_name="gpt-4o-mini",
                decrypt=lambda value: value,
            )
        )
        assert openai_model._provider.client.kwargs["max_retries"] == 0

        azure_config = AzureOpenAICustomProviderConfig(
            azure_openai_authentication_method={"type": "api_key", "api_key": "azure-test-key"},
            azure_openai_client_kwargs={"azure_endpoint": "https://azure.example.test"},
            openai_api_type="responses",
        )
        azure_model = (
            await chat_router._get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=SimpleNamespace(config=azure_config.model_dump_json().encode()),
                model_name="gpt-4o-mini",
                decrypt=lambda value: value,
            )
        )
        assert azure_model._provider.client.kwargs["max_retries"] == 0

    async def test_anthropic_custom_provider_disables_sdk_retries(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import anthropic

        class DummyAsyncAnthropic:
            def __init__(self, **kwargs: Any) -> None:
                self.kwargs = kwargs

        monkeypatch.setattr(anthropic, "AsyncAnthropic", DummyAsyncAnthropic)

        anthropic_config = AnthropicCustomProviderConfig(
            anthropic_authentication_method={"type": "api_key", "api_key": "sk-test-anthropic"},
            anthropic_client_kwargs={"base_url": "https://anthropic.example.test"},
        )
        anthropic_model = (
            await chat_router._get_pydantic_ai_model_from_generative_model_custom_provider(
                provider_record=SimpleNamespace(config=anthropic_config.model_dump_json().encode()),
                model_name="claude-3-5-sonnet-20241022",
                decrypt=lambda value: value,
            )
        )
        assert anthropic_model._provider.client.kwargs["max_retries"] == 0


def _assert_successful_chat_stream(response: httpx.Response, *, session_id: str) -> None:
    assert response.status_code == 200
    events = _parse_server_sent_events(response.text)

    types = [event["type"] for event in events]
    assert types[0] == "start"
    assert types[1] == "start-step"
    assert "text-start" in types
    assert "text-delta" in types
    assert "text-end" in types
    assert types[-2] == "finish-step"
    assert types[-1] == "finish"

    finish_event = next(
        event for event in events if isinstance(event, dict) and event.get("type") == "finish"
    )
    assert finish_event["finishReason"] == "stop"

    start_event = next(
        event for event in events if isinstance(event, dict) and event.get("type") == "start"
    )
    message_metadata = start_event.get("messageMetadata")
    assert message_metadata is not None
    assert re.fullmatch(r"[0-9a-f]{32}", message_metadata["traceId"])
    assert re.fullmatch(r"[0-9a-f]{16}", message_metadata["rootSpanId"])
    assert message_metadata["sessionId"] == session_id

    text_events = [
        event
        for event in events
        if isinstance(event, dict) and event.get("type") in ("text-start", "text-delta", "text-end")
    ]
    stream_ids = {event["id"] for event in text_events}
    assert len(stream_ids) == 1, "text-start, text-delta, text-end should share one stream ID"

    text_deltas = [
        event for event in events if isinstance(event, dict) and event.get("type") == "text-delta"
    ]
    assert text_deltas, "Expected at least one text-delta event"
    full_text = "".join(event["delta"] for event in text_deltas)
    assert isinstance(full_text, str)
    assert "Paris" in full_text


def _parse_server_sent_events(content: str) -> list[dict[str, Any]]:
    """Parse SSE content into a list of parsed JSON events, asserting [DONE] terminates the stream."""
    events: list[dict[str, Any]] = []
    blocks = [b.strip() for b in content.strip().split("\n\n") if b.strip()]
    assert blocks[-1] == "data: [DONE]", f"Expected stream to end with [DONE], got: {blocks[-1]!r}"
    for block in blocks[:-1]:
        assert block.startswith("data: "), f"Unexpected SSE line: {block!r}"
        events.append(json.loads(block[len("data: ") :]))
    return events
