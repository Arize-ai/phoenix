#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
# ]
# ///
"""Deterministic OpenAI-compatible responses for offline trace recording."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from hashlib import sha256
from http import HTTPStatus
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING or __package__:
    from scripts.datagen.recording import RecorderFixture
else:
    from recording import RecorderFixture  # type: ignore[import-not-found,no-redef]


class ScriptedProviderError(ValueError):
    """Raised when a response script cannot serve an OpenAI request."""


class ScriptedOpenAIProvider:
    """Serve a fixed response sequence through an in-process HTTP transport."""

    def __init__(self, responses: Sequence[Mapping[str, Any]]) -> None:
        if not responses:
            raise ScriptedProviderError("a provider script must contain at least one response")
        self._responses = tuple(dict(response) for response in responses)
        self._response_index = 0
        self.requests: list[dict[str, Any]] = []

    @classmethod
    def for_fixture(cls, fixture: RecorderFixture) -> ScriptedOpenAIProvider:
        turns = fixture.inputs.get("turns")
        if not isinstance(turns, list) or not turns:
            raise ScriptedProviderError(
                f"fixture {fixture.fragment_id!r} does not contain scripted turns"
            )
        responses = []
        for turn in turns:
            if not isinstance(turn, dict) or not isinstance(turn.get("assistant"), str):
                raise ScriptedProviderError(
                    f"fixture {fixture.fragment_id!r} has an invalid scripted turn"
                )
            responses.append({"content": turn["assistant"]})
        return cls(responses)

    @property
    def response_index(self) -> int:
        return self._response_index

    def http_client(self) -> Any:
        import httpx

        return httpx.Client(transport=httpx.MockTransport(self._handle))

    def _handle(self, request: Any) -> Any:
        import httpx

        if request.url.path != "/v1/chat/completions":
            return httpx.Response(
                HTTPStatus.NOT_FOUND,
                json={"error": {"message": "not found", "type": "invalid_request_error"}},
                request=request,
            )
        try:
            body = json.loads(request.content)
        except (json.JSONDecodeError, TypeError):
            return httpx.Response(
                HTTPStatus.BAD_REQUEST,
                json={"error": {"message": "invalid JSON", "type": "invalid_request_error"}},
                request=request,
            )
        if not isinstance(body, dict):
            return httpx.Response(
                HTTPStatus.BAD_REQUEST,
                json={"error": {"message": "request must be an object"}},
                request=request,
            )
        self.requests.append(body)
        if self._response_index >= len(self._responses):
            raise ScriptedProviderError("provider received more requests than scripted responses")
        response = self._responses[self._response_index]
        self._response_index += 1

        status = response.get("status", HTTPStatus.OK)
        if not isinstance(status, int):
            raise ScriptedProviderError("scripted response status must be an integer")
        if status != HTTPStatus.OK:
            error = response.get("error")
            payload = (
                {"error": dict(error)}
                if isinstance(error, Mapping)
                else {"error": {"message": f"scripted HTTP {status}"}}
            )
            return httpx.Response(status, json=payload, request=request)

        completion = _completion(body, response, self._response_index)
        if body.get("stream"):
            return httpx.Response(
                HTTPStatus.OK,
                headers={"content-type": "text/event-stream"},
                content=stream_chat_completion(completion),
                request=request,
            )
        return httpx.Response(HTTPStatus.OK, json=completion, request=request)


def _completion(
    request: Mapping[str, Any],
    response: Mapping[str, Any],
    response_index: int,
) -> dict[str, Any]:
    message: dict[str, Any] = {"role": "assistant", "content": None}
    tool_call = response.get("tool_call")
    if tool_call is not None:
        if not isinstance(tool_call, Mapping):
            raise ScriptedProviderError("tool_call must be an object")
        name = tool_call.get("name")
        arguments = tool_call.get("arguments")
        if not isinstance(name, str) or not isinstance(arguments, Mapping):
            raise ScriptedProviderError("tool_call requires a name and object arguments")
        message["tool_calls"] = [
            {
                "id": f"call-{response_index}",
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(arguments, sort_keys=True, separators=(",", ":")),
                },
            }
        ]
        finish_reason = "tool_calls"
    else:
        content = response.get("content")
        if not isinstance(content, str):
            raise ScriptedProviderError("scripted response requires content or tool_call")
        message["content"] = content
        finish_reason = "stop"

    prompt_tokens = _token_count(request.get("messages", []))
    completion_tokens = _token_count(message)
    identifier = _stable_id({"request": request, "response_index": response_index})
    return {
        "id": f"chatcmpl-{identifier[:24]}",
        "object": "chat.completion",
        "created": 0,
        "model": request.get("model", "datagen-scripted"),
        "choices": [
            {
                "index": 0,
                "message": message,
                "finish_reason": finish_reason,
            }
        ],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "prompt_tokens_details": {"cached_tokens": 0},
            "completion_tokens_details": {"reasoning_tokens": 0},
        },
    }


def stream_chat_completion(completion: Mapping[str, Any]) -> bytes:
    """Encode a text completion as an OpenAI server-sent-event stream."""
    choice = completion["choices"][0]
    content = choice["message"].get("content") or ""
    chunks = [
        {
            "id": completion["id"],
            "object": "chat.completion.chunk",
            "created": completion["created"],
            "model": completion["model"],
            "choices": [{"index": 0, "delta": {"content": content}, "finish_reason": None}],
        },
        {
            "id": completion["id"],
            "object": "chat.completion.chunk",
            "created": completion["created"],
            "model": completion["model"],
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        },
        {
            "id": completion["id"],
            "object": "chat.completion.chunk",
            "created": completion["created"],
            "model": completion["model"],
            "choices": [],
            "usage": completion["usage"],
        },
    ]
    events = [f"data: {json.dumps(chunk, separators=(',', ':'))}\n\n" for chunk in chunks]
    return ("".join(events) + "data: [DONE]\n\n").encode()


def _token_count(value: Any) -> int:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return max(1, round(len(text.split()) * 1.35))


def _stable_id(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return sha256(encoded).hexdigest()
