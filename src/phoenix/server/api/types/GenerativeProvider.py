from enum import Enum
from typing import Any, ClassVar, Optional, Union

import strawberry
from openinference.semconv.trace import OpenInferenceLLMProviderValues, SpanAttributes

from phoenix.trace.attributes import get_attribute_value


@strawberry.enum
class GenerativeProviderKey(Enum):
    OPENAI = "OpenAI"
    ANTHROPIC = "Anthropic"
    AZURE_OPENAI = "Azure OpenAI"
    GEMINI = "Google AI Studio"


@strawberry.type
class GenerativeProvider:
    name: str
    key: GenerativeProviderKey

    model_provider_to_model_prefix_map: ClassVar[dict[GenerativeProviderKey, list[str]]] = {
        GenerativeProviderKey.AZURE_OPENAI: [],
        GenerativeProviderKey.ANTHROPIC: ["claude"],
        GenerativeProviderKey.OPENAI: ["gpt", "o1"],
        GenerativeProviderKey.GEMINI: ["gemini"],
    }

    attribute_provider_to_generative_provider_map: ClassVar[dict[str, GenerativeProviderKey]] = {
        OpenInferenceLLMProviderValues.OPENAI.value: GenerativeProviderKey.OPENAI,
        OpenInferenceLLMProviderValues.ANTHROPIC.value: GenerativeProviderKey.ANTHROPIC,
        OpenInferenceLLMProviderValues.AZURE.value: GenerativeProviderKey.AZURE_OPENAI,
        OpenInferenceLLMProviderValues.GOOGLE.value: GenerativeProviderKey.GEMINI,
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
