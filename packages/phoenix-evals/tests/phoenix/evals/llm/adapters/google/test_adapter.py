# type: ignore
"""Tests for ``GoogleGenAIAdapter.generate_object()`` AUTO-mode discovery.

``AUTO`` probes structured output first and only falls back to tool calling when
the API rejects the request itself. Rate-limit and transient errors must
propagate so the outer ``RateLimiter`` can throttle and retry them, and so a
transient failure never silently downgrades a request to a path without
server-side schema enforcement. The OpenAI and LiteLLM adapters pin this
behaviour; this module pins it for the Google GenAI adapter.
"""

from typing import Any, Dict, List

import pytest

pytest.importorskip("google.genai")

from google.genai import errors as gerrors  # noqa: E402

from phoenix.evals.llm.adapters.google.adapter import (  # noqa: E402
    GoogleGenAIAdapter,
    GoogleGenAIRateLimitError,
)
from phoenix.evals.llm.types import ObjectGenerationMethod  # noqa: E402

SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {"label": {"type": "string", "enum": ["good", "bad"]}},
    "required": ["label"],
}
MODEL = "gemini-2.5-flash"


def _api_error(code: int, message: str) -> gerrors.APIError:
    return gerrors.APIError(code=code, response_json={"error": {"message": message}})


def _tool_call_response(label: str) -> Any:
    class _FunctionCall:
        args = {"label": label}

    class _Part:
        function_call = _FunctionCall()

    class _Parts:
        def __iter__(self) -> Any:
            return iter([_Part()])

    class _Content:
        parts = _Parts()

    class _Candidate:
        content = _Content()

    class _Response:
        candidates = [_Candidate()]

    return _Response()


class _RecordingModels:
    """Stands in for ``client.models`` and records which wire path was used."""

    def __init__(self, structured: Any, tool: Any) -> None:
        self._structured = structured
        self._tool = tool
        self.calls: List[str] = []

    def _which(self, config: Any) -> str:
        # Only the structured-output path sets response_mime_type.
        return (
            "structured_output" if getattr(config, "response_mime_type", None) else "tool_calling"
        )

    def generate_content(self, model: str, contents: Any, config: Any = None, **kwargs: Any) -> Any:
        which = self._which(config)
        self.calls.append(which)
        outcome = self._structured if which == "structured_output" else self._tool
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class _SyncClient:
    """Minimal sync ``genai.Client`` stand-in (``.models`` plus a ``.aio`` marker)."""

    def __init__(self, models: _RecordingModels) -> None:
        self.models = models
        self.aio = object()  # presence of ``aio`` marks this the sync client
        self.model = MODEL


class _AsyncClient:
    """Minimal async ``genai.Client`` stand-in (no ``.aio`` attribute)."""

    def __init__(self, models: _RecordingModels) -> None:
        self.models = models
        self.model = MODEL


class _AsyncRecordingModels(_RecordingModels):
    async def generate_content(  # type: ignore[override]
        self, model: str, contents: Any, config: Any = None, **kwargs: Any
    ) -> Any:
        return _RecordingModels.generate_content(self, model, contents, config, **kwargs)


def _sync_adapter(structured: Any, tool: Any) -> GoogleGenAIAdapter:
    return GoogleGenAIAdapter(_SyncClient(_RecordingModels(structured, tool)), model=MODEL)


def _async_adapter(structured: Any, tool: Any) -> GoogleGenAIAdapter:
    client = _AsyncClient(_AsyncRecordingModels(structured, tool))
    return GoogleGenAIAdapter(client, model=MODEL)


def test_auto_falls_back_to_tool_calling_on_bad_request() -> None:
    """A 4xx rejection of the request itself is the fallback AUTO exists for."""
    client = _SyncClient(
        _RecordingModels(
            _api_error(400, "unsupported response schema"), _tool_call_response("good")
        )
    )
    adapter = GoogleGenAIAdapter(client, model=MODEL)

    assert adapter.generate_object("classify this", SCHEMA, method=ObjectGenerationMethod.AUTO) == {
        "label": "good"
    }
    assert client.models.calls == ["structured_output", "tool_calling"]


def test_auto_propagates_rate_limit_error_uncaught() -> None:
    """A 429 must reach the ``RateLimiter`` instead of being retried as a tool call."""
    models = _RecordingModels(
        _api_error(429, "quota exhausted"), _api_error(429, "quota exhausted")
    )
    adapter = GoogleGenAIAdapter(_SyncClient(models), model=MODEL)

    with pytest.raises(GoogleGenAIRateLimitError):
        adapter.generate_object("classify this", SCHEMA, method=ObjectGenerationMethod.AUTO)
    assert models.calls == ["structured_output"]


def test_auto_does_not_downgrade_to_tool_calling_on_rate_limit() -> None:
    """The unenforced tool-calling path must not run after a rate-limited attempt."""
    models = _RecordingModels(_api_error(429, "quota exhausted"), _tool_call_response("good"))
    adapter = GoogleGenAIAdapter(_SyncClient(models), model=MODEL)

    with pytest.raises(GoogleGenAIRateLimitError):
        adapter.generate_object("classify this", SCHEMA, method=ObjectGenerationMethod.AUTO)
    assert models.calls == ["structured_output"]


def test_auto_propagates_server_error_uncaught() -> None:
    """A 5xx is transient and must reach the executor's retry budget."""
    models = _RecordingModels(_api_error(503, "unavailable"), _api_error(503, "unavailable"))
    adapter = GoogleGenAIAdapter(_SyncClient(models), model=MODEL)

    with pytest.raises(gerrors.APIError):
        adapter.generate_object("classify this", SCHEMA, method=ObjectGenerationMethod.AUTO)
    assert models.calls == ["structured_output"]


async def test_async_auto_propagates_rate_limit_error_uncaught() -> None:
    """The async path is the production default and must behave identically."""
    models = _AsyncRecordingModels(_api_error(429, "quota exhausted"), _tool_call_response("good"))
    adapter = GoogleGenAIAdapter(_AsyncClient(models), model=MODEL)

    with pytest.raises(GoogleGenAIRateLimitError):
        await adapter.async_generate_object(
            "classify this", SCHEMA, method=ObjectGenerationMethod.AUTO
        )
    assert models.calls == ["structured_output"]


async def test_async_auto_falls_back_to_tool_calling_on_bad_request() -> None:
    models = _AsyncRecordingModels(
        _api_error(400, "unsupported response schema"), _tool_call_response("good")
    )
    adapter = GoogleGenAIAdapter(_AsyncClient(models), model=MODEL)

    assert await adapter.async_generate_object(
        "classify this", SCHEMA, method=ObjectGenerationMethod.AUTO
    ) == {"label": "good"}
    assert models.calls == ["structured_output", "tool_calling"]
