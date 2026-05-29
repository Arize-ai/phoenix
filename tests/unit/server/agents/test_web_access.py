"""Tests for provider-native web search capability resolution.

The OpenAI/Anthropic/Google cases use real pydantic-ai model classes because
the bug they guard against lives in pydantic-ai's profiles: they advertise
``WebSearchTool`` as supported for *every* model in the family, including legacy
models (e.g. ``gpt-3.5-turbo``, ``claude-3-opus``, ``gemini-1.0-pro``) that
reject web search at request time.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel, OpenAIResponsesModel
from pydantic_ai.native_tools import WebSearchTool
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider

from phoenix.server.agents.web_access import build_web_search_capability

# Fake keys are fine; no network call is made when only building the model.


@pytest.fixture
def openai_provider() -> OpenAIProvider:
    return OpenAIProvider(api_key="sk-fake")


@pytest.fixture
def anthropic_provider() -> AnthropicProvider:
    return AnthropicProvider(api_key="sk-fake")


@pytest.fixture
def google_provider() -> GoogleProvider:
    return GoogleProvider(api_key="fake")


class TestBuildWebSearchCapabilityOpenAI:
    @pytest.mark.parametrize(
        "model_name",
        [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-5",
            "gpt-5.1",
            "o1",
            "o3",
            "o4-mini",
            "chatgpt-4o-latest",
            # Future families are assumed to support web search (denylist), so
            # models not yet released must pass through automatically.
            "gpt-6",
            "gpt-4.5-preview",
        ],
    )
    def test_responses_api_supported_for_modern_models(
        self,
        openai_provider: OpenAIProvider,
        model_name: str,
    ) -> None:
        model = OpenAIResponsesModel(model_name, provider=openai_provider)
        assert build_web_search_capability(model) is not None

    @pytest.mark.parametrize(
        "model_name",
        [
            "gpt-3.5-turbo",
            "gpt-4",
            "gpt-4-turbo",
            "gpt-4-0613",
        ],
    )
    def test_responses_api_unsupported_for_legacy_models(
        self,
        openai_provider: OpenAIProvider,
        model_name: str,
    ) -> None:
        """Regression: the Responses-API profile over-reports web search support
        for legacy models. The model-name denylist must exclude them so the UI
        does not offer a request that fails at the provider.
        """
        model = OpenAIResponsesModel(model_name, provider=openai_provider)
        assert build_web_search_capability(model) is None

    def test_chat_completions_only_supports_search_preview(
        self,
        openai_provider: OpenAIProvider,
    ) -> None:
        # On Chat Completions, pydantic-ai already restricts web search to the
        # explicit search-preview models.
        supported = OpenAIChatModel("gpt-4o-search-preview", provider=openai_provider)
        unsupported = OpenAIChatModel("gpt-4o", provider=openai_provider)
        assert build_web_search_capability(supported) is not None
        assert build_web_search_capability(unsupported) is None


class TestBuildWebSearchCapabilityAnthropic:
    @pytest.mark.parametrize(
        "model_name",
        [
            "claude-3-5-sonnet-latest",
            "claude-3-5-sonnet-20240620",
            "claude-3-5-haiku-latest",
            "claude-3-7-sonnet-latest",
            "claude-sonnet-4-5",
            "claude-opus-4-1",
            # Future families pass through automatically.
            "claude-opus-5",
        ],
    )
    def test_supported_for_modern_models(
        self,
        anthropic_provider: AnthropicProvider,
        model_name: str,
    ) -> None:
        model = AnthropicModel(model_name, provider=anthropic_provider)
        assert build_web_search_capability(model) is not None

    @pytest.mark.parametrize(
        "model_name",
        [
            "claude-2.1",
            "claude-instant-1.2",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
        ],
    )
    def test_unsupported_for_legacy_models(
        self,
        anthropic_provider: AnthropicProvider,
        model_name: str,
    ) -> None:
        """Regression: pre-3.5 Claude models lack the web search server tool but
        the profile advertises it; the denylist must exclude them.
        """
        model = AnthropicModel(model_name, provider=anthropic_provider)
        assert build_web_search_capability(model) is None


class TestBuildWebSearchCapabilityGoogle:
    @pytest.mark.parametrize(
        "model_name",
        [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-2.0-flash",
            "gemini-2.5-pro",
            # Future families pass through automatically.
            "gemini-3-pro",
        ],
    )
    def test_supported_for_modern_models(
        self,
        google_provider: GoogleProvider,
        model_name: str,
    ) -> None:
        model = GoogleModel(model_name, provider=google_provider)
        assert build_web_search_capability(model) is not None

    @pytest.mark.parametrize(
        "model_name",
        [
            "gemini-1.0-pro",
            "gemini-pro",
            "gemini-pro-vision",
        ],
    )
    def test_unsupported_for_legacy_models(
        self,
        google_provider: GoogleProvider,
        model_name: str,
    ) -> None:
        """Regression: Gemini 1.0 used the older grounding config and lacks the
        modern `google_search` tool; the denylist must exclude it.
        """
        model = GoogleModel(model_name, provider=google_provider)
        assert build_web_search_capability(model) is None


@dataclass
class _FakeProfile:
    supported_native_tools: frozenset[type] = field(default_factory=frozenset)


@dataclass
class _FakeModel:
    system: str
    model_name: str
    profile: _FakeProfile


class TestBuildWebSearchCapabilityFallbacks:
    def test_unsupported_when_profile_lacks_web_search_tool(self) -> None:
        # The profile gate runs first: no WebSearchTool means no capability,
        # regardless of provider or model name.
        model = _FakeModel(
            system="anthropic",
            model_name="claude-3-5-sonnet",
            profile=_FakeProfile(frozenset()),
        )
        assert build_web_search_capability(model) is None  # type: ignore[arg-type]

    def test_provider_without_denylist_trusts_the_profile(self) -> None:
        # A provider with no Phoenix-side denylist (e.g. Bedrock) is governed
        # solely by its profile.
        model = _FakeModel(
            system="bedrock",
            model_name="some-model",
            profile=_FakeProfile(frozenset({WebSearchTool})),
        )
        assert build_web_search_capability(model) is not None  # type: ignore[arg-type]

    def test_openai_compatible_custom_provider_is_gated_by_denylist(self) -> None:
        # Custom OpenAI-compatible providers also report ``system == "openai"``,
        # so a legacy model name is gated even though the profile advertises
        # web search.
        model = _FakeModel(
            system="openai",
            model_name="gpt-3.5-turbo",
            profile=_FakeProfile(frozenset({WebSearchTool})),
        )
        assert build_web_search_capability(model) is None  # type: ignore[arg-type]
