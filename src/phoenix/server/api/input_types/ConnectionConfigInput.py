"""
GraphQL input type for SDK connection configuration.

Maps 1:1 to the DB storage model (ConnectionConfig pydantic types),
eliminating the need for a translation layer.
"""

from typing import Optional

import strawberry

from phoenix.db.types.experiment_config import (
    AnthropicConnectionConfig,
    AWSBedrockConnectionConfig,
    AzureOpenAIConnectionConfig,
    ConnectionConfig,
    GoogleGenAIConnectionConfig,
    OpenAIConnectionConfig,
)
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.input_types.ModelClientOptionsInput import OpenAIApiType
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey


@strawberry.input
class ConnectionConfigInput:
    """SDK connection overrides for builtin providers.

    Flat input — the backend determines which SDK-specific config to create
    based on the model provider. Only the fields relevant to that provider
    are used; the rest are ignored.
    """

    base_url: Optional[str] = None
    # Azure
    azure_endpoint: Optional[str] = None
    # AWS
    region_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    # OpenAI/Azure
    openai_api_type: Optional[OpenAIApiType] = None
    # OpenAI
    organization: Optional[str] = None
    project: Optional[str] = None


OPENAI_SDK_STYLE_PROVIDER_KEYS: frozenset[GenerativeProviderKey] = frozenset(
    {
        GenerativeProviderKey.OPENAI,
        GenerativeProviderKey.DEEPSEEK,
        GenerativeProviderKey.XAI,
        GenerativeProviderKey.OLLAMA,
        GenerativeProviderKey.CEREBRAS,
        GenerativeProviderKey.FIREWORKS,
        GenerativeProviderKey.GROQ,
        GenerativeProviderKey.MOONSHOT,
        GenerativeProviderKey.MINIMAX,
        GenerativeProviderKey.PERPLEXITY,
        GenerativeProviderKey.TOGETHER,
        GenerativeProviderKey.ZAI,
        GenerativeProviderKey.META,
    }
)


def to_connection_config(
    *,
    model_provider: ModelProvider,
    connection_config_input: ConnectionConfigInput | None,
) -> ConnectionConfig | None:
    """Convert provider overrides to a typed connection config for DB storage.

    Return None when no connection override applies, preserving default provider routing.
    """
    if connection_config_input is None:
        return None

    provider_key = GenerativeProviderKey.from_model_provider(model_provider)
    openai_api_type_or_default = (
        connection_config_input.openai_api_type or OpenAIApiType.CHAT_COMPLETIONS
    ).value

    if provider_key in OPENAI_SDK_STYLE_PROVIDER_KEYS:
        has_routing_override = (
            connection_config_input.base_url is not None
            or connection_config_input.openai_api_type is not None
        )
        if not has_routing_override:
            return None
        return OpenAIConnectionConfig(
            type="openai",
            base_url=connection_config_input.base_url,
            organization=connection_config_input.organization,
            project=connection_config_input.project,
            openai_api_type=openai_api_type_or_default,
        )

    if provider_key is GenerativeProviderKey.AZURE_OPENAI:
        if connection_config_input.azure_endpoint is None:
            return None
        return AzureOpenAIConnectionConfig(
            type="azure_openai",
            azure_endpoint=connection_config_input.azure_endpoint,
            openai_api_type=openai_api_type_or_default,
        )

    if provider_key is GenerativeProviderKey.ANTHROPIC:
        if connection_config_input.base_url is None:
            return None
        return AnthropicConnectionConfig(
            type="anthropic",
            base_url=connection_config_input.base_url,
        )

    if provider_key is GenerativeProviderKey.GOOGLE:
        if connection_config_input.base_url is None:
            return None
        return GoogleGenAIConnectionConfig(
            type="google_genai",
            base_url=connection_config_input.base_url,
        )

    if provider_key is GenerativeProviderKey.AWS:
        if connection_config_input.region_name is None:
            return None
        return AWSBedrockConnectionConfig(
            type="aws_bedrock",
            region_name=connection_config_input.region_name,
            endpoint_url=connection_config_input.endpoint_url,
        )

    return None
