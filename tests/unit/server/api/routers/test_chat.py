import json
import re
from base64 import b64encode
from pathlib import Path
from typing import Any

import httpx
import pytest

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

    async def test_chat_returns_404_for_missing_custom_provider(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.post(
            "/chat",
            params={
                "provider_type": "custom",
                "provider_id": b64encode(b"GenerativeModelCustomProvider:999999").decode(),
                "model_name": _CHAT_PARAMS["model_name"],
            },
            json=_CHAT_BODY,
        )

        assert response.status_code == 404
        assert response.text == "Custom provider not found."


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
