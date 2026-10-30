"""Where a decision request goes: one URL rule per client style.

A decision client is configured with a base URL, and its SDK appends a path to it:
OpenAI's Decisions API posts to ``{base}/decisions``, System One to
``{base}/v1/systemone``. Chat base URLs usually end in ``/v1`` (OpenAI's is
``https://api.openai.com/v1``), which is what the OpenAI style wants and what System One
adds itself, so the System One rule drops one trailing ``/v1``. These functions are the
only place that happens; the settings form mirrors them in
``js/app/src/pages/settings/decisionEndpoints.ts``, and both run the cases in
``tests/unit/server/decisions/decision_endpoint_cases.json``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from typing_extensions import assert_never

from phoenix.db.types.model_provider import (
    OPENAI_DEFAULT_BASE_URL,
    TYPESAFE_DEFAULT_BASE_URL,
    AnthropicCustomProviderConfig,
    AWSBedrockCustomProviderConfig,
    AzureOpenAICustomProviderConfig,
    GenerativeModelCustomerProviderConfigType,
    GoogleGenAICustomProviderConfig,
    OpenAICustomProviderConfig,
    TypeSafeCustomProviderConfig,
)

if TYPE_CHECKING:
    from phoenix.db.models import DecisionSDK

_DEFAULT_BASE_URLS: dict[DecisionSDK, str] = {
    "openai": OPENAI_DEFAULT_BASE_URL,
    "typesafe": TYPESAFE_DEFAULT_BASE_URL,
}

_PATHS: dict[DecisionSDK, str] = {
    "openai": "/decisions",
    "typesafe": "/v1/systemone",
}


def decision_client_base_url(decision_sdk: DecisionSDK, base_url: str) -> str:
    """The base URL to give the client's SDK, which appends its own path."""
    trimmed = base_url.strip().rstrip("/")
    if decision_sdk == "openai":
        return trimmed
    if decision_sdk == "typesafe":
        return trimmed.removesuffix("/v1")
    assert_never(decision_sdk)


def decision_endpoint_url(decision_sdk: DecisionSDK, base_url: str) -> str:
    """The exact URL a decision request posts to."""
    return decision_client_base_url(decision_sdk, base_url) + _PATHS[decision_sdk]


def guess_decision_base_url(decision_sdk: DecisionSDK, chat_base_url: Optional[str]) -> str:
    """A best guess at the decision base URL of a provider whose chat base URL is known.

    The chat base URL as it is: the System One rule already drops its ``/v1``, so the
    guess is shown in the form without it. With no chat base URL, the style's default.
    """
    chat = (chat_base_url or "").strip().rstrip("/")
    if not chat:
        return _DEFAULT_BASE_URLS[decision_sdk]
    if decision_sdk == "typesafe":
        return chat.removesuffix("/v1")
    return chat


def chat_base_url(config: GenerativeModelCustomerProviderConfigType) -> Optional[str]:
    """The base URL a provider's chat client is configured with, if it has one."""
    if isinstance(config, OpenAICustomProviderConfig):
        kwargs = config.openai_client_kwargs
        return kwargs.base_url if kwargs else None
    if isinstance(config, AzureOpenAICustomProviderConfig):
        endpoint = config.azure_openai_client_kwargs.azure_endpoint.rstrip("/")
        return endpoint if endpoint.endswith("/openai/v1") else f"{endpoint}/openai/v1"
    if isinstance(config, TypeSafeCustomProviderConfig):
        typesafe_kwargs = config.typesafe_client_kwargs
        return typesafe_kwargs.base_url if typesafe_kwargs else None
    if isinstance(config, AnthropicCustomProviderConfig):
        anthropic_kwargs = config.anthropic_client_kwargs
        return anthropic_kwargs.base_url if anthropic_kwargs else None
    if isinstance(config, GoogleGenAICustomProviderConfig):
        google_kwargs = config.google_genai_client_kwargs
        http_options = google_kwargs.http_options if google_kwargs else None
        return http_options.base_url if http_options else None
    if isinstance(config, AWSBedrockCustomProviderConfig):
        return config.aws_bedrock_client_kwargs.endpoint_url
    assert_never(config)


def resolve_decision_base_url(
    decision_sdk: DecisionSDK, config: GenerativeModelCustomerProviderConfigType
) -> str:
    """The decision base URL a custom provider's runs and endpoint test use.

    A TypeSafe provider's own base URL is its System One endpoint. Others use the
    configured decision base URL, else their chat base URL, else the style's default;
    :func:`decision_client_base_url` then applies the style's rule, so the result posts
    where :func:`guess_decision_base_url` says it would.
    """
    if isinstance(
        config,
        (OpenAICustomProviderConfig, AzureOpenAICustomProviderConfig),
    ):
        decision_models = config.decision_models
        if decision_models is not None and decision_models.base_url:
            return decision_models.base_url
    return chat_base_url(config) or _DEFAULT_BASE_URLS[decision_sdk]
