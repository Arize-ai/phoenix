"""Validate prompt invocation parameters against their model provider."""

from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.db.types.model_provider import ModelProvider, is_sdk_compatible_with_model_provider
from phoenix.db.types.prompts import (
    PromptAnthropicInvocationParameters,
    PromptAwsInvocationParameters,
    PromptGoogleInvocationParameters,
    PromptInvocationParameters,
)
from phoenix.server.api.exceptions import BadRequest, NotFound

InvocationFamily = Literal["openai", "anthropic", "google", "aws"]


def _expected_invocation_family(provider: ModelProvider) -> InvocationFamily:
    if provider is ModelProvider.ANTHROPIC:
        return "anthropic"
    if provider is ModelProvider.GOOGLE:
        return "google"
    if provider is ModelProvider.AWS:
        return "aws"
    if (
        provider is ModelProvider.OPENAI
        or provider is ModelProvider.AZURE_OPENAI
        or provider is ModelProvider.DEEPSEEK
        or provider is ModelProvider.XAI
        or provider is ModelProvider.OLLAMA
        or provider is ModelProvider.CEREBRAS
        or provider is ModelProvider.FIREWORKS
        or provider is ModelProvider.GROQ
        or provider is ModelProvider.MOONSHOT
        or provider is ModelProvider.MINIMAX
        or provider is ModelProvider.PERPLEXITY
        or provider is ModelProvider.TOGETHER
        or provider is ModelProvider.ZAI
    ):
        return "openai"
    assert_never(provider)


def _orm_invocation_family(invocation_parameters: PromptInvocationParameters) -> InvocationFamily:
    if isinstance(invocation_parameters, PromptAnthropicInvocationParameters):
        return "anthropic"
    if isinstance(invocation_parameters, PromptGoogleInvocationParameters):
        return "google"
    if isinstance(invocation_parameters, PromptAwsInvocationParameters):
        return "aws"
    return "openai"


def validate_invocation_parameters_match_provider(
    model_provider: ModelProvider,
    invocation_parameters: PromptInvocationParameters,
) -> None:
    """Reject prompt versions whose invocation-parameters family doesn't match the provider."""
    expected = _expected_invocation_family(model_provider)
    actual = _orm_invocation_family(invocation_parameters)
    if expected != actual:
        raise BadRequest(
            f"Invocation parameters variant '{actual}' does not match "
            f"model provider '{model_provider.value}' (expected '{expected}')."
        )


async def validate_custom_provider(session: AsyncSession, version: models.PromptVersion) -> None:
    """Reject a version whose custom provider is missing or cannot serve its model provider.

    Every path that stores a prompt version, whether through the prompt APIs or an LLM
    evaluator, runs this before the write so a provider that would fail at invocation time
    is refused up front. Raises NotFound for a missing provider and BadRequest for an SDK
    that cannot serve the version's model provider.
    """
    if (provider_id := version.custom_provider_id) is None:
        return
    provider = await session.get(
        models.GenerativeModelCustomProvider, provider_id, with_for_update={"read": True}
    )
    global_id = GlobalID("GenerativeModelCustomProvider", str(provider_id))
    if provider is None:
        raise NotFound(f"Custom provider not found: {global_id}")
    if not is_sdk_compatible_with_model_provider(provider.sdk, version.model_provider):
        raise BadRequest(
            f"Custom provider {global_id} uses the {provider.sdk} SDK, which cannot serve "
            f"model provider {version.model_provider.value}"
        )
