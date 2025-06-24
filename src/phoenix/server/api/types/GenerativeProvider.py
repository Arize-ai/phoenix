from enum import Enum
from typing import Any, ClassVar, Optional, Union

import strawberry
from openinference.semconv.trace import OpenInferenceLLMProviderValues, SpanAttributes

from phoenix.config import getenv
from phoenix.trace.attributes import get_attribute_value


@strawberry.enum
class GenerativeProviderKey(Enum):
    OPENAI = "OpenAI"
    ANTHROPIC = "Anthropic"
    AZURE_OPENAI = "Azure OpenAI"
    GOOGLE = "Google AI Studio"
    DEEPSEEK = "DeepSeek"
    XAI = "xAI"
    OLLAMA = "Ollama"
    AWS = "AWS Bedrock"


@strawberry.type
class GenerativeProviderCredentialConfig:
    env_var_name: str
    is_required: bool


@strawberry.type
class GenerativeProvider:
    name: str
    key: GenerativeProviderKey

    model_provider_to_model_prefix_map: ClassVar[dict[GenerativeProviderKey, list[str]]] = {
        GenerativeProviderKey.AZURE_OPENAI: [],
        GenerativeProviderKey.ANTHROPIC: ["claude"],
        GenerativeProviderKey.OPENAI: ["gpt", "o1"],
        GenerativeProviderKey.GOOGLE: ["gemini"],
        GenerativeProviderKey.DEEPSEEK: ["deepseek"],
        GenerativeProviderKey.XAI: ["grok"],
        GenerativeProviderKey.OLLAMA: ["llama", "mistral", "codellama", "phi", "qwen", "gemma"],
        GenerativeProviderKey.AWS: ["nova", "titan"],
    }

    attribute_provider_to_generative_provider_map: ClassVar[dict[str, GenerativeProviderKey]] = {
        OpenInferenceLLMProviderValues.OPENAI.value: GenerativeProviderKey.OPENAI,
        OpenInferenceLLMProviderValues.ANTHROPIC.value: GenerativeProviderKey.ANTHROPIC,
        OpenInferenceLLMProviderValues.AZURE.value: GenerativeProviderKey.AZURE_OPENAI,
        OpenInferenceLLMProviderValues.GOOGLE.value: GenerativeProviderKey.GOOGLE,
        OpenInferenceLLMProviderValues.AWS.value: GenerativeProviderKey.AWS,
        # Note: DeepSeek uses OpenAI compatibility but we can't duplicate the key in the dict
        # The provider will be determined through model name prefix matching instead
        # Note: xAI uses OpenAI compatibility but we can't duplicate the key in the dict
        # The provider will be determined through model name prefix matching instead
        # Note: Ollama uses OpenAI compatibility but we can't duplicate the key in the dict
        # The provider will be determined through model name prefix matching instead
    }

    """
    A map of model provider keys to their credential requirements.
    E.x. OpenAI requires a single API key
    """
    model_provider_to_credential_requirements_map: ClassVar[
        dict[GenerativeProviderKey, list[GenerativeProviderCredentialConfig]]
    ] = {
        GenerativeProviderKey.AZURE_OPENAI: [
            GenerativeProviderCredentialConfig(
                env_var_name="AZURE_OPENAI_API_KEY", is_required=True
            )
        ],
        GenerativeProviderKey.ANTHROPIC: [
            GenerativeProviderCredentialConfig(env_var_name="ANTHROPIC_API_KEY", is_required=True)
        ],
        GenerativeProviderKey.OPENAI: [
            GenerativeProviderCredentialConfig(env_var_name="OPENAI_API_KEY", is_required=True)
        ],
        GenerativeProviderKey.GOOGLE: [
            GenerativeProviderCredentialConfig(env_var_name="GEMINI_API_KEY", is_required=True)
        ],
        GenerativeProviderKey.DEEPSEEK: [
            GenerativeProviderCredentialConfig(env_var_name="DEEPSEEK_API_KEY", is_required=True)
        ],
        GenerativeProviderKey.XAI: [
            GenerativeProviderCredentialConfig(env_var_name="XAI_API_KEY", is_required=True)
        ],
        GenerativeProviderKey.OLLAMA: [],
        GenerativeProviderKey.AWS: [
            GenerativeProviderCredentialConfig(env_var_name="AWS_ACCESS_KEY_ID", is_required=True),
            GenerativeProviderCredentialConfig(
                env_var_name="AWS_SECRET_ACCESS_KEY", is_required=True
            ),
            GenerativeProviderCredentialConfig(env_var_name="AWS_SESSION_TOKEN", is_required=False),
        ],
    }

    @strawberry.field
    async def dependencies(self) -> list[str]:
        from phoenix.server.api.helpers.playground_registry import (
            PLAYGROUND_CLIENT_REGISTRY,
            PROVIDER_DEFAULT,
        )

        default_client = PLAYGROUND_CLIENT_REGISTRY.get_client(self.key, PROVIDER_DEFAULT)
        if default_client:
            return [dependency.name for dependency in default_client.dependencies()]
        return []

    @strawberry.field
    async def dependencies_installed(self) -> bool:
        from phoenix.server.api.helpers.playground_registry import (
            PLAYGROUND_CLIENT_REGISTRY,
            PROVIDER_DEFAULT,
        )

        default_client = PLAYGROUND_CLIENT_REGISTRY.get_client(self.key, PROVIDER_DEFAULT)
        if default_client:
            return default_client.dependencies_are_installed()
        return False

    @strawberry.field(description="The credential requirements for the provider")  # type: ignore
    async def credential_requirements(self) -> list[GenerativeProviderCredentialConfig]:
        # Handle providers that don't require credentials
        credential_requirements = self.model_provider_to_credential_requirements_map.get(self.key)
        if credential_requirements is None:
            return []
        return self.model_provider_to_credential_requirements_map[self.key]

    @strawberry.field(description="Whether the credentials are set on the server for the provider")  # type: ignore
    async def credentials_set(self) -> bool:
        # Check if every required credential is set
        return all(
            getenv(credential_config.env_var_name) is not None or not credential_config.is_required
            for credential_config in await self.credential_requirements()
        )

    @classmethod
    def _infer_model_provider_from_model_name(
        cls,
        model_name: str,
    ) -> Union[GenerativeProviderKey, None]:
        for provider, prefixes in cls.model_provider_to_model_prefix_map.items():
            if any(prefix.lower() in model_name.lower() for prefix in prefixes):
                return provider
        return None

    @classmethod
    def get_model_provider_from_attributes(
        cls,
        attributes: dict[str, Any],
    ) -> Union[GenerativeProviderKey, None]:
        llm_provider: Optional[str] = get_attribute_value(attributes, SpanAttributes.LLM_PROVIDER)

        if isinstance(llm_provider, str) and (
            provider := cls.attribute_provider_to_generative_provider_map.get(llm_provider)
        ):
            return provider
        llm_model = get_attribute_value(attributes, SpanAttributes.LLM_MODEL_NAME)
        if isinstance(llm_model, str):
            return cls._infer_model_provider_from_model_name(llm_model)
        return None
