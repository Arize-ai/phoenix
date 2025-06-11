from datetime import datetime
from typing import Optional

import strawberry
from openinference.semconv.trace import OpenInferenceLLMProviderValues
from sqlalchemy import inspect
from strawberry.relay import Node, NodeID
from strawberry.types import Info
from typing_extensions import assert_never

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface
from phoenix.server.api.types.TokenCost import TokenCost


@strawberry.type
class Model(Node, ModelInterface):
    id_attr: NodeID[int]
    name: str
    provider: Optional[str]
    name_pattern: str
    is_override: bool
    created_at: datetime
    updated_at: datetime
    provider_key: Optional[GenerativeProviderKey]
    costs: strawberry.Private[Optional[list[models.ModelCost]]] = None

    @strawberry.field
    async def token_cost(self, info: Info[Context, None]) -> Optional[TokenCost]:
        if self.costs is None:
            raise NotImplementedError
        token_cost = TokenCost()
        for cost in self.costs:
            setattr(token_cost, cost.token_type, cost.cost_per_token)
        return token_cost

    @strawberry.field
    async def total_token_cost(self, info: Info[Context, None]) -> Optional[TokenCost]:
        total_costs = await info.context.data_loaders.model_total_costs.load(self.id_attr)
        if total_costs is None:
            return None
        return TokenCost(
            input=total_costs.total_input_token_cost,
            output=total_costs.total_output_token_cost,
            cache_read=total_costs.total_cache_read_token_cost,
            cache_write=total_costs.total_cache_write_token_cost,
            prompt_audio=total_costs.total_prompt_audio_token_cost,
            completion_audio=total_costs.total_completion_audio_token_cost,
            reasoning=total_costs.total_reasoning_token_cost,
            total=total_costs.total_token_cost,
        )


def to_gql_model(model: models.Model) -> Model:
    costs_are_loaded = isinstance(inspect(model).attrs.costs.loaded_value, list)
    return Model(
        id_attr=model.id,
        name=model.name,
        provider=model.provider,
        name_pattern=model.name_pattern,
        is_override=model.is_override,
        created_at=model.created_at,
        updated_at=model.updated_at,
        provider_key=_semconv_provider_to_gql_generative_provider_key(model.provider)
        if model.provider
        else None,
        costs=model.costs if costs_are_loaded else None,
    )


def _semconv_provider_to_gql_generative_provider_key(
    semconv_provider_str: str,
) -> Optional[GenerativeProviderKey]:
    """
    Translates a semconv provider string to a GQL GenerativeProviderKey.
    """

    try:
        semconv_provider = OpenInferenceLLMProviderValues(semconv_provider_str)
    except Exception:
        return None
    if semconv_provider == OpenInferenceLLMProviderValues.OPENAI:
        return GenerativeProviderKey.OPENAI
    if semconv_provider == OpenInferenceLLMProviderValues.ANTHROPIC:
        return GenerativeProviderKey.ANTHROPIC
    if semconv_provider == OpenInferenceLLMProviderValues.AZURE:
        return GenerativeProviderKey.AZURE_OPENAI
    if semconv_provider == OpenInferenceLLMProviderValues.GOOGLE:
        return GenerativeProviderKey.GOOGLE
    if semconv_provider == OpenInferenceLLMProviderValues.DEEPSEEK:
        return GenerativeProviderKey.DEEPSEEK
    if semconv_provider == OpenInferenceLLMProviderValues.XAI:
        return GenerativeProviderKey.XAI
    if semconv_provider == OpenInferenceLLMProviderValues.AWS:
        raise NotImplementedError("AWS models are not yet supported")
    if semconv_provider == OpenInferenceLLMProviderValues.COHERE:
        raise NotImplementedError("Cohere models are not yet supported")
    if semconv_provider == OpenInferenceLLMProviderValues.MISTRALAI:
        raise NotImplementedError("Mistral AI models are not yet supported")
    assert_never(semconv_provider)
