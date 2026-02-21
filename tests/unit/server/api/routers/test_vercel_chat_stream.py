import json
from typing import Any

import httpx

from tests.unit.vcr import CustomVCR


class TestVercelChatStreamRouter:
    async def test_chat_completion(
        self,
        httpx_client: httpx.AsyncClient,
        anthropic_api_key: str,
        custom_vcr: CustomVCR,
    ) -> None:
        params = {
            "provider_type": "builtin",
            "provider": "ANTHROPIC",
            "model_name": "claude-haiku-4-5-20251001",
        }
        body = {
            "trigger": "submit-message",
            "id": "test-session-1",
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
        with custom_vcr.use_cassette():
            response = await httpx_client.post("/vercel_chat_stream", params=params, json=body)

        assert response.status_code == 200
        events = _parse_server_sent_events(response.text)

        # Verify overall event sequence structure
        types = [event["type"] for event in events]
        assert types[0] == "start"
        assert types[1] == "start-step"
        assert "text-start" in types
        assert "text-delta" in types
        assert "text-end" in types
        assert types[-2] == "finish-step"
        assert types[-1] == "finish"

        # Verify the finish event signals a clean stop
        finish_event = next(
            event for event in events if isinstance(event, dict) and event.get("type") == "finish"
        )
        assert finish_event["finishReason"] == "stop"

        # Verify text-start, text-delta, text-end all share the same stream ID
        text_events = [
            event
            for event in events
            if isinstance(event, dict)
            and event.get("type") in ("text-start", "text-delta", "text-end")
        ]
        stream_ids = {event["id"] for event in text_events}
        assert len(stream_ids) == 1, "text-start, text-delta, text-end should share one stream ID"

        # Verify the full response text contains the expected answer
        text_deltas = [
            event
            for event in events
            if isinstance(event, dict) and event.get("type") == "text-delta"
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
