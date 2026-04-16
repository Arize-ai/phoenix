# type: ignore
"""Tests for OpenAI adapter generate_object runtime fallback behavior.

These tests verify that the adapter probes the API at runtime instead of
using hardcoded model capability lists, and that it caches the discovered
method for subsequent calls.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from openai import APIConnectionError, APITimeoutError, BadRequestError, RateLimitError

from phoenix.evals.llm.adapters.openai.adapter import OpenAIAdapter
from phoenix.evals.llm.types import ObjectGenerationMethod

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["yes", "no"]},
    },
    "required": ["label"],
}


def _bad_request(message: str) -> BadRequestError:
    """Construct a BadRequestError for simulating OpenAI capability-mismatch responses."""
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(400, request=request)
    return BadRequestError(message, response=response, body=None)


def _rate_limit(message: str = "rate limited") -> RateLimitError:
    """Construct a RateLimitError for simulating 429 responses."""
    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    response = httpx.Response(429, request=request)
    return RateLimitError(message, response=response, body=None)


def _make_sync_client(model: str = "test-model") -> MagicMock:
    """Create a mock sync OpenAI client."""
    client = MagicMock()
    client.__module__ = "openai"
    client.__class__.__name__ = "OpenAI"
    client.model = model
    client.chat.completions.create = MagicMock()
    return client


def _make_structured_output_response(label: str = "yes") -> MagicMock:
    """Create a mock response for structured output (response_format)."""
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = json.dumps({"label": label})
    return response


def _make_tool_calling_response(label: str = "yes") -> MagicMock:
    """Create a mock response for tool calling."""
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = None
    tool_call = MagicMock()
    tool_call.function.arguments = json.dumps({"label": label})
    response.choices[0].message.tool_calls = [tool_call]
    return response


class TestGenerateObjectAutoFallback:
    """Test AUTO mode: try structured output first, fall back to tool calling."""

    def test_auto_uses_structured_output_when_supported(self) -> None:
        """When structured output succeeds, use it and don't try tool calling."""
        client = _make_sync_client("gpt-4o")
        client.chat.completions.create.return_value = _make_structured_output_response()
        adapter = OpenAIAdapter(client, "gpt-4o")

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "yes"}
        assert client.chat.completions.create.call_count == 1
        # Verify structured output was used (response_format kwarg present)
        call_kwargs = client.chat.completions.create.call_args.kwargs
        assert "response_format" in call_kwargs

    def test_auto_falls_back_to_tool_calling_on_bad_request(self) -> None:
        """When structured output raises BadRequestError, fall back to tool calling."""
        client = _make_sync_client("o3-mini")

        # First call (structured output) raises BadRequestError, second call succeeds
        client.chat.completions.create.side_effect = [
            _bad_request("model does not support response_format"),
            _make_tool_calling_response("no"),
        ]
        adapter = OpenAIAdapter(client, "o3-mini")

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "no"}
        assert client.chat.completions.create.call_count == 2

    def test_auto_raises_when_both_fail_with_bad_request(self) -> None:
        """When both methods raise BadRequestError, raise ValueError with combined info."""
        client = _make_sync_client("unknown-model")
        client.chat.completions.create.side_effect = [
            _bad_request("structured output not supported"),
            _bad_request("tool calling not supported"),
        ]
        adapter = OpenAIAdapter(client, "unknown-model")

        with pytest.raises(ValueError, match="failed with both structured output and tool calling"):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

    def test_auto_raises_preserves_both_error_messages(self) -> None:
        """The combined error includes details from both failed attempts."""
        client = _make_sync_client("unknown-model")
        client.chat.completions.create.side_effect = [
            _bad_request("bad response_format"),
            _bad_request("tools param rejected"),
        ]
        adapter = OpenAIAdapter(client, "unknown-model")

        with pytest.raises(ValueError) as exc_info:
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        message = str(exc_info.value)
        assert "bad response_format" in message
        assert "tools param rejected" in message


class TestGenerateObjectAutoErrorPropagation:
    """Test that non-capability errors propagate without triggering fallback or caching.

    Regression coverage for: the previous bare ``except Exception`` swallowed
    rate-limit, timeout, and connection errors, converted them into a ValueError
    (which the outer RateLimiter could not recognize for retry), and in some
    cases silently cached a downgrade to tool calling.
    """

    def test_rate_limit_error_propagates_uncaught(self) -> None:
        """RateLimitError must propagate so the outer RateLimiter can back off."""
        client = _make_sync_client("gpt-4o")
        client.chat.completions.create.side_effect = _rate_limit()
        adapter = OpenAIAdapter(client, "gpt-4o")

        # The original RateLimitError must propagate — not be wrapped in ValueError
        with pytest.raises(RateLimitError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        # Must NOT have attempted tool calling (that would burn a second billable call)
        assert client.chat.completions.create.call_count == 1
        # Must NOT have cached a method — this was a transient failure
        assert adapter._preferred_method is None

    def test_api_timeout_error_propagates_uncaught(self) -> None:
        """APITimeoutError from structured output must propagate — not trigger fallback."""
        client = _make_sync_client("gpt-4o")
        request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        client.chat.completions.create.side_effect = APITimeoutError(request=request)
        adapter = OpenAIAdapter(client, "gpt-4o")

        with pytest.raises(APITimeoutError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert client.chat.completions.create.call_count == 1
        assert adapter._preferred_method is None

    def test_api_connection_error_propagates_uncaught(self) -> None:
        """APIConnectionError from structured output must propagate — not trigger fallback."""
        client = _make_sync_client("gpt-4o")
        request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        client.chat.completions.create.side_effect = APIConnectionError(request=request)
        adapter = OpenAIAdapter(client, "gpt-4o")

        with pytest.raises(APIConnectionError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert client.chat.completions.create.call_count == 1
        assert adapter._preferred_method is None

    def test_rate_limit_from_tool_calling_propagates(self) -> None:
        """If tool-calling fallback hits a rate limit, the error must propagate uncaught.

        Previously this was wrapped in ValueError and the outer RateLimiter
        couldn't retry — now it propagates so backoff fires.
        """
        client = _make_sync_client("o3-mini")
        client.chat.completions.create.side_effect = [
            _bad_request("structured output not supported"),
            _rate_limit("429 on tool calling"),
        ]
        adapter = OpenAIAdapter(client, "o3-mini")

        with pytest.raises(RateLimitError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        # We did try both, but the rate-limit from the second is what propagates
        assert client.chat.completions.create.call_count == 2
        # And tool calling was not cached — the rate limit is transient, not
        # a capability signal
        assert adapter._preferred_method is None


class TestGenerateObjectMethodCache:
    """Test that AUTO mode caches the discovered method after first call."""

    def test_caches_structured_output_on_success(self) -> None:
        """After structured output succeeds, subsequent calls skip discovery."""
        client = _make_sync_client("gpt-4o")
        client.chat.completions.create.return_value = _make_structured_output_response()
        adapter = OpenAIAdapter(client, "gpt-4o")

        # First call — discovery
        adapter.generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.STRUCTURED_OUTPUT

        # Second call — should use cache, only 1 more API call
        adapter.generate_object("prompt 2", SIMPLE_SCHEMA)
        assert client.chat.completions.create.call_count == 2  # 1 + 1, not 1 + 2

    def test_caches_tool_calling_after_fallback(self) -> None:
        """After falling back to tool calling on BadRequestError, subsequent calls go directly there."""
        client = _make_sync_client("o3-mini")

        # First call: structured output raises BadRequestError, tool calling succeeds
        client.chat.completions.create.side_effect = [
            _bad_request("not supported"),
            _make_tool_calling_response(),
        ]
        adapter = OpenAIAdapter(client, "o3-mini")
        adapter.generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

        # Second call: should go directly to tool calling (1 API call, not 2)
        client.chat.completions.create.side_effect = None
        client.chat.completions.create.return_value = _make_tool_calling_response()
        adapter.generate_object("prompt 2", SIMPLE_SCHEMA)

        # Total: 2 (discovery) + 1 (cached) = 3
        assert client.chat.completions.create.call_count == 3

    def test_no_cache_when_both_fail(self) -> None:
        """When both methods fail with BadRequestError, preferred_method stays None."""
        client = _make_sync_client("bad-model")
        client.chat.completions.create.side_effect = [
            _bad_request("nope"),
            _bad_request("also nope"),
        ]
        adapter = OpenAIAdapter(client, "bad-model")

        with pytest.raises(ValueError):
            adapter.generate_object("prompt", SIMPLE_SCHEMA)

        assert adapter._preferred_method is None


class TestExplicitMethodNoPrecheck:
    """Test that explicit method requests go straight to the API with no pre-check."""

    def test_structured_output_on_previously_blocklisted_model(self) -> None:
        """o3-mini was previously blocklisted — explicit STRUCTURED_OUTPUT should just try it."""
        client = _make_sync_client("o3-mini")
        client.chat.completions.create.return_value = _make_structured_output_response()
        adapter = OpenAIAdapter(client, "o3-mini")

        result = adapter.generate_object(
            "test prompt", SIMPLE_SCHEMA, method=ObjectGenerationMethod.STRUCTURED_OUTPUT
        )
        assert result == {"label": "yes"}

    def test_tool_calling_on_previously_blocklisted_model(self) -> None:
        """o1 was previously blocklisted — explicit TOOL_CALLING should just try it."""
        client = _make_sync_client("o1")
        client.chat.completions.create.return_value = _make_tool_calling_response()
        adapter = OpenAIAdapter(client, "o1")

        result = adapter.generate_object(
            "test prompt", SIMPLE_SCHEMA, method=ObjectGenerationMethod.TOOL_CALLING
        )
        assert result == {"label": "yes"}

    def test_explicit_method_propagates_api_error(self) -> None:
        """When an explicit method fails, the API error propagates directly."""
        client = _make_sync_client("gpt-4o")
        client.chat.completions.create.side_effect = Exception("API error: bad request")
        adapter = OpenAIAdapter(client, "gpt-4o")

        with pytest.raises(Exception, match="API error: bad request"):
            adapter.generate_object(
                "test prompt", SIMPLE_SCHEMA, method=ObjectGenerationMethod.STRUCTURED_OUTPUT
            )


def _make_async_adapter(model: str = "test-model") -> tuple[MagicMock, OpenAIAdapter]:
    """Create a mock client and an OpenAIAdapter forced into async mode.

    MagicMock auto-creates a `.client` child attribute, which confuses
    _check_if_async_client. We construct the adapter normally then
    override _is_async to True and return both the client and adapter
    so tests can configure side_effects on client.chat.completions.create.
    """
    client = _make_sync_client(model)
    adapter = OpenAIAdapter(client, model)
    adapter._is_async = True
    # Replace the sync create with an AsyncMock for async calls
    client.chat.completions.create = AsyncMock()
    return client, adapter


class TestAsyncGenerateObjectFallback:
    """Test async_generate_object has the same fallback and caching behavior."""

    @pytest.mark.asyncio
    async def test_async_auto_falls_back_to_tool_calling(self) -> None:
        """Async AUTO mode falls back from structured output to tool calling on BadRequestError."""
        client, adapter = _make_async_adapter("o3-mini")
        client.chat.completions.create = AsyncMock(
            side_effect=[
                _bad_request("structured output not supported"),
                _make_tool_calling_response("no"),
            ]
        )

        result = await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "no"}
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

    @pytest.mark.asyncio
    async def test_async_auto_caches_preferred_method(self) -> None:
        """Async AUTO mode caches the discovered method."""
        client, adapter = _make_async_adapter("gpt-4o")
        client.chat.completions.create = AsyncMock(return_value=_make_structured_output_response())

        await adapter.async_generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.STRUCTURED_OUTPUT

        await adapter.async_generate_object("prompt 2", SIMPLE_SCHEMA)
        assert client.chat.completions.create.call_count == 2

    @pytest.mark.asyncio
    async def test_async_auto_raises_when_both_fail(self) -> None:
        """Async AUTO mode raises ValueError with combined error when both fail with BadRequestError."""
        client, adapter = _make_async_adapter("bad-model")
        client.chat.completions.create = AsyncMock(
            side_effect=[
                _bad_request("structured nope"),
                _bad_request("tools nope"),
            ]
        )

        with pytest.raises(ValueError, match="failed with both structured output and tool calling"):
            await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

    @pytest.mark.asyncio
    async def test_async_rate_limit_error_propagates_uncaught(self) -> None:
        """Async: RateLimitError must propagate so the outer RateLimiter can back off."""
        client, adapter = _make_async_adapter("gpt-4o")
        client.chat.completions.create = AsyncMock(side_effect=_rate_limit())

        with pytest.raises(RateLimitError):
            await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

        assert client.chat.completions.create.call_count == 1
        assert adapter._preferred_method is None

    @pytest.mark.asyncio
    async def test_async_api_timeout_error_propagates_uncaught(self) -> None:
        """Async: APITimeoutError must propagate — not trigger fallback."""
        client, adapter = _make_async_adapter("gpt-4o")
        request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
        client.chat.completions.create = AsyncMock(side_effect=APITimeoutError(request=request))

        with pytest.raises(APITimeoutError):
            await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

        assert client.chat.completions.create.call_count == 1
        assert adapter._preferred_method is None
