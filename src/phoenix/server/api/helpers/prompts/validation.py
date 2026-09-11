"""Validate prompt invocation parameters against their model provider."""

from typing import Literal

from typing_extensions import assert_never

from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptAnthropicInvocationParameters,
    PromptAwsInvocationParameters,
    PromptGoogleInvocationParameters,
    PromptInvocationParameters,
)
from phoenix.server.api.exceptions import BadRequest

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
