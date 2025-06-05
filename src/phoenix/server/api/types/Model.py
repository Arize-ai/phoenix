from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID

from phoenix.server.api.types.GenerativeProvider import GenerativeProvider, GenerativeProviderKey


@strawberry.type
class Model(Node):
    id_attr: NodeID[int]
    name: str
    provider: Optional[str]
    name_pattern: str
    created_at: datetime
    updated_at: datetime

    @strawberry.field(
        description="The generative provider if the model provider matches a known provider"
    )
    def generative_provider(self) -> Optional[GenerativeProvider]:
        """
        Attempts to match the model's provider to a known GenerativeProvider.
        Returns None if no match is found.
        """
        if not self.provider:
            return None

        # Try to match by provider string
        provider_key = self._get_provider_key_from_string(self.provider)
        if provider_key:
            return GenerativeProvider(name=provider_key.value, key=provider_key)

        # Fallback: try to infer from model name
        provider_key = GenerativeProvider._infer_model_provider_from_model_name(self.name)
        if provider_key:
            return GenerativeProvider(name=provider_key.value, key=provider_key)

        return None

    def _get_provider_key_from_string(self, provider_str: str) -> Optional[GenerativeProviderKey]:
        """
        Maps a provider string to a GenerativeProviderKey.
        """
        provider_mapping = {
            "openai": GenerativeProviderKey.OPENAI,
            "anthropic": GenerativeProviderKey.ANTHROPIC,
            "azure_openai": GenerativeProviderKey.AZURE_OPENAI,
            "azure openai": GenerativeProviderKey.AZURE_OPENAI,
            "google": GenerativeProviderKey.GOOGLE,
            "deepseek": GenerativeProviderKey.DEEPSEEK,
            "xai": GenerativeProviderKey.XAI,
            "ollama": GenerativeProviderKey.OLLAMA,
        }

        return provider_mapping.get(provider_str.lower())

    @classmethod
    def from_orm(cls, model_orm) -> "Model":
        """
        Convert a SQLAlchemy Model instance to a Strawberry Model type.
        """
        return cls(
            id_attr=model_orm.id,
            name=model_orm.name,
            provider=model_orm.provider,
            name_pattern=model_orm.name_pattern,
            created_at=model_orm.created_at,
            updated_at=model_orm.updated_at,
        )
