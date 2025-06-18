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
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TokenCost import TokenCost


@strawberry.type
class GenerativeModel(Node, ModelInterface):
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
    async def cost_summary(self, info: Info[Context, None]) -> SpanCostSummary:
        loader = info.context.data_loaders.span_cost_summary_by_generative_model
        summary = await loader.load(self.id_attr)
        return SpanCostSummary(
            prompt=CostBreakdown(
                tokens=summary.prompt.tokens,
                cost=summary.prompt.cost,
            ),
            completion=CostBreakdown(
                tokens=summary.completion.tokens,
                cost=summary.completion.cost,
            ),
            total=CostBreakdown(
                tokens=summary.total.tokens,
                cost=summary.total.cost,
            ),
        )

    @strawberry.field
    async def cost_detail_summary_entries(
        self,
        info: Info[Context, None],
    ) -> list[SpanCostDetailSummaryEntry]:
        loader = info.context.data_loaders.span_cost_detail_summary_entries_by_generative_model
        summary = await loader.load(self.id_attr)
        return [
            SpanCostDetailSummaryEntry(
                token_type=entry.token_type,
                is_prompt=entry.is_prompt,
                value=CostBreakdown(
                    tokens=entry.value.tokens,
                    cost=entry.value.cost,
                ),
            )
            for entry in summary
        ]


def to_gql_generative_model(model: models.GenerativeModel) -> GenerativeModel:
    costs_are_loaded = isinstance(inspect(model).attrs.costs.loaded_value, list)
    return GenerativeModel(
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
