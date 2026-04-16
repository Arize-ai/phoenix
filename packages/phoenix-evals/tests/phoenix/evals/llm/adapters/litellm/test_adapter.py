# type: ignore
"""Tests for LiteLLM adapter generate_object runtime fallback behavior.

These tests verify that the adapter probes the API at runtime instead of
gating on a capability allowlist from ``litellm.get_supported_openai_params``,
and that it caches the discovered method for subsequent calls.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from litellm import BadRequestError as LiteLLMBadRequestError
from litellm import RateLimitError as LiteLLMRateLimitError

from phoenix.evals.llm.adapters.litellm.adapter import LiteLLMAdapter
from phoenix.evals.llm.adapters.litellm.client import LiteLLMClient
from phoenix.evals.llm.types import ObjectGenerationMethod

SIMPLE_SCHEMA = {
    "type": "object",
    "properties": {
        "label": {"type": "string", "enum": ["yes", "no"]},
    },
    "required": ["label"],
}


def _bad_request(message: str = "bad request") -> LiteLLMBadRequestError:
    """Construct a LiteLLM BadRequestError for capability-mismatch simulation."""
    return LiteLLMBadRequestError(message=message, model="test-model", llm_provider="openai")


def _rate_limit(message: str = "rate limited") -> LiteLLMRateLimitError:
    """Construct a LiteLLM RateLimitError for 429 simulation."""
    return LiteLLMRateLimitError(message=message, model="test-model", llm_provider="openai")


def _make_structured_output_response(label: str = "yes") -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = json.dumps({"label": label})
    return response


def _make_tool_calling_response(label: str = "yes") -> MagicMock:
    response = MagicMock()
    response.choices = [MagicMock()]
    response.choices[0].message.content = None
    tool_call = MagicMock()
    tool_call.function.arguments = json.dumps({"label": label})
    response.choices[0].message.tool_calls = [tool_call]
    return response


def _make_adapter(
    monkeypatch: pytest.MonkeyPatch,
    provider: str = "openai",
    model: str = "gpt-4o",
    supported_params: list[str] | None = None,
) -> tuple[LiteLLMAdapter, MagicMock, MagicMock]:
    """Build a LiteLLMAdapter with ``litellm.completion`` / ``acompletion`` and
    ``get_supported_openai_params`` patched.

    Returns (adapter, completion_mock, acompletion_mock).
    """
    client = LiteLLMClient(provider=provider, model=model)
    adapter = LiteLLMAdapter(client, model)

    completion_mock = MagicMock()
    acompletion_mock = AsyncMock()

    monkeypatch.setattr(adapter._litellm, "completion", completion_mock)
    monkeypatch.setattr(adapter._litellm, "acompletion", acompletion_mock)
    if supported_params is not None:
        monkeypatch.setattr(
            adapter._litellm,
            "get_supported_openai_params",
            lambda model: supported_params,
        )

    return adapter, completion_mock, acompletion_mock


class TestGenerateObjectAutoFallback:
    """AUTO mode: try structured output first, fall back to tool calling on BadRequestError."""

    def test_auto_uses_structured_output_when_supported(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch)
        completion_mock.return_value = _make_structured_output_response()

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "yes"}
        assert completion_mock.call_count == 1
        call_kwargs = completion_mock.call_args.kwargs
        assert "response_format" in call_kwargs

    def test_auto_falls_back_to_tool_calling_on_bad_request(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch, model="some-reasoning-model")
        completion_mock.side_effect = [
            _bad_request("response_format not supported"),
            _make_tool_calling_response("no"),
        ]

        result = adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "no"}
        assert completion_mock.call_count == 2
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

    def test_auto_raises_when_both_fail_with_bad_request(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch, model="unknown-model")
        completion_mock.side_effect = [
            _bad_request("structured output rejected"),
            _bad_request("tool calls rejected"),
        ]

        with pytest.raises(ValueError, match="failed with both"):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert adapter._preferred_method is None

    def test_auto_combined_error_preserves_both_messages(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch, model="unknown-model")
        completion_mock.side_effect = [
            _bad_request("SO_MESSAGE_MARKER"),
            _bad_request("TC_MESSAGE_MARKER"),
        ]

        with pytest.raises(ValueError) as exc_info:
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        message = str(exc_info.value)
        assert "SO_MESSAGE_MARKER" in message
        assert "TC_MESSAGE_MARKER" in message


class TestGenerateObjectAutoProbeOrder:
    """Probe order is informed by ``get_supported_openai_params`` when available."""

    def test_tries_tool_calling_first_when_response_format_unsupported(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """If the provider list says response_format isn't supported but tools is,
        probe tool calling first — don't waste a billable call on a known-bad SO probe.
        """
        adapter, completion_mock, _ = _make_adapter(
            monkeypatch,
            model="tc-only-model",
            supported_params=["tools"],
        )
        completion_mock.return_value = _make_tool_calling_response()

        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert completion_mock.call_count == 1
        # Verify tool calling was used (tools kwarg, not response_format)
        call_kwargs = completion_mock.call_args.kwargs
        assert "tools" in call_kwargs
        assert "response_format" not in call_kwargs
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

    def test_defaults_to_structured_output_first_when_both_supported(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(
            monkeypatch,
            supported_params=["response_format", "tools"],
        )
        completion_mock.return_value = _make_structured_output_response()

        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        call_kwargs = completion_mock.call_args.kwargs
        assert "response_format" in call_kwargs

    def test_defaults_to_structured_output_first_when_introspection_fails(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch)

        def _raise(model: str) -> list[str]:
            raise RuntimeError("introspection broken")

        monkeypatch.setattr(adapter._litellm, "get_supported_openai_params", _raise)
        completion_mock.return_value = _make_structured_output_response()

        adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        call_kwargs = completion_mock.call_args.kwargs
        assert "response_format" in call_kwargs


class TestGenerateObjectMethodCache:
    """AUTO mode caches the discovered method after first call."""

    def test_caches_structured_output_on_success(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch)
        completion_mock.return_value = _make_structured_output_response()

        adapter.generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.STRUCTURED_OUTPUT

        adapter.generate_object("prompt 2", SIMPLE_SCHEMA)
        assert completion_mock.call_count == 2  # 1 + 1, not 1 + 2

    def test_caches_tool_calling_after_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch, model="reasoning-model")
        completion_mock.side_effect = [
            _bad_request("not supported"),
            _make_tool_calling_response(),
        ]

        adapter.generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

        # Second call: cached, goes directly to tool calling
        completion_mock.side_effect = None
        completion_mock.return_value = _make_tool_calling_response()
        adapter.generate_object("prompt 2", SIMPLE_SCHEMA)

        # Total: 2 (discovery) + 1 (cached) = 3
        assert completion_mock.call_count == 3


class TestGenerateObjectErrorPropagation:
    """Non-capability errors must propagate so the outer RateLimiter can retry.

    Regression coverage for the old behavior where the adapter gated on a
    static capability list and never attempted the API at all for stale models.
    """

    def test_rate_limit_error_propagates_uncaught(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch)
        completion_mock.side_effect = _rate_limit()

        with pytest.raises(LiteLLMRateLimitError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        # Must not burn a second billable call on fallback
        assert completion_mock.call_count == 1
        assert adapter._preferred_method is None

    def test_rate_limit_from_fallback_propagates(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """If the fallback path hits a rate limit, the error must propagate
        uncaught — not be wrapped in ValueError where the outer RateLimiter
        can't recognize it for backoff.
        """
        adapter, completion_mock, _ = _make_adapter(monkeypatch, model="reasoning-model")
        completion_mock.side_effect = [
            _bad_request("response_format not supported"),
            _rate_limit("429 on tool calling"),
        ]

        with pytest.raises(LiteLLMRateLimitError):
            adapter.generate_object("test prompt", SIMPLE_SCHEMA)

        assert completion_mock.call_count == 2
        # Tool calling was not cached — rate limit isn't a capability signal
        assert adapter._preferred_method is None


class TestExplicitMethodNoPrecheck:
    """Explicit method requests skip capability gating entirely."""

    def test_structured_output_without_capability_precheck(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Even if provider introspection says response_format isn't supported,
        explicit STRUCTURED_OUTPUT just tries the API — no pre-raise.
        """
        adapter, completion_mock, _ = _make_adapter(
            monkeypatch,
            model="new-model-not-in-litellm-table",
            supported_params=["tools"],  # SO not in the list
        )
        completion_mock.return_value = _make_structured_output_response()

        result = adapter.generate_object(
            "test prompt",
            SIMPLE_SCHEMA,
            method=ObjectGenerationMethod.STRUCTURED_OUTPUT,
        )

        assert result == {"label": "yes"}

    def test_tool_calling_without_capability_precheck(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, completion_mock, _ = _make_adapter(
            monkeypatch,
            model="new-model-not-in-litellm-table",
            supported_params=["response_format"],  # tools not in the list
        )
        completion_mock.return_value = _make_tool_calling_response()

        result = adapter.generate_object(
            "test prompt",
            SIMPLE_SCHEMA,
            method=ObjectGenerationMethod.TOOL_CALLING,
        )

        assert result == {"label": "yes"}

    def test_explicit_method_propagates_api_error(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter, completion_mock, _ = _make_adapter(monkeypatch)
        completion_mock.side_effect = _bad_request("bad schema")

        with pytest.raises(LiteLLMBadRequestError, match="bad schema"):
            adapter.generate_object(
                "test prompt",
                SIMPLE_SCHEMA,
                method=ObjectGenerationMethod.STRUCTURED_OUTPUT,
            )


class TestAsyncGenerateObjectFallback:
    """async_generate_object has the same fallback, caching, and error-propagation behavior."""

    @pytest.mark.asyncio
    async def test_async_auto_falls_back_to_tool_calling(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, _, acompletion_mock = _make_adapter(monkeypatch, model="reasoning-model")
        acompletion_mock.side_effect = [
            _bad_request("response_format not supported"),
            _make_tool_calling_response("no"),
        ]

        result = await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

        assert result == {"label": "no"}
        assert adapter._preferred_method == ObjectGenerationMethod.TOOL_CALLING

    @pytest.mark.asyncio
    async def test_async_auto_caches_preferred_method(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, _, acompletion_mock = _make_adapter(monkeypatch)
        acompletion_mock.return_value = _make_structured_output_response()

        await adapter.async_generate_object("prompt 1", SIMPLE_SCHEMA)
        assert adapter._preferred_method == ObjectGenerationMethod.STRUCTURED_OUTPUT

        await adapter.async_generate_object("prompt 2", SIMPLE_SCHEMA)
        assert acompletion_mock.call_count == 2

    @pytest.mark.asyncio
    async def test_async_auto_raises_when_both_fail(self, monkeypatch: pytest.MonkeyPatch) -> None:
        adapter, _, acompletion_mock = _make_adapter(monkeypatch, model="bad-model")
        acompletion_mock.side_effect = [
            _bad_request("structured nope"),
            _bad_request("tools nope"),
        ]

        with pytest.raises(ValueError, match="failed with both"):
            await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

    @pytest.mark.asyncio
    async def test_async_rate_limit_error_propagates_uncaught(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        adapter, _, acompletion_mock = _make_adapter(monkeypatch)
        acompletion_mock.side_effect = _rate_limit()

        with pytest.raises(LiteLLMRateLimitError):
            await adapter.async_generate_object("test prompt", SIMPLE_SCHEMA)

        assert acompletion_mock.call_count == 1
        assert adapter._preferred_method is None
