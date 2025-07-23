from datetime import datetime
from enum import Enum
from typing import Optional

import strawberry
from openinference.semconv.trace import OpenInferenceLLMProviderValues
from sqlalchemy import inspect
from strawberry.relay import Node, NodeID
from strawberry.relay.types import GlobalID
from strawberry.types import Info
from strawberry.types.unset import UNSET
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.api.types.CostBreakdown import CostBreakdown
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.ModelInterface import ModelInterface
from phoenix.server.api.types.node import from_global_id
from phoenix.server.api.types.SpanCostDetailSummaryEntry import SpanCostDetailSummaryEntry
from phoenix.server.api.types.SpanCostSummary import SpanCostSummary
from phoenix.server.api.types.TokenPrice import TokenKind, TokenPrice


@strawberry.enum
class GenerativeModelKind(Enum):
    CUSTOM = "CUSTOM"
    BUILT_IN = "BUILT_IN"


ProjectId: TypeAlias = int
TimeRangeKey: TypeAlias = tuple[Optional[datetime], Optional[datetime]]
CachedCostSummaryKey: TypeAlias = tuple[Optional[ProjectId], TimeRangeKey]


@strawberry.type
class GenerativeModel(Node, ModelInterface):
    id_attr: NodeID[int]
    name: str
    provider: Optional[str]
    name_pattern: str
    kind: GenerativeModelKind
    created_at: datetime
    updated_at: datetime
    provider_key: Optional[GenerativeProviderKey]
    costs: strawberry.Private[Optional[list[models.TokenPrice]]] = None
    start_time: Optional[datetime] = None
    cached_cost_summary: strawberry.Private[
        Optional[dict[CachedCostSummaryKey, SpanCostSummary]]
    ] = None

    def add_cached_cost_summary(
        self, project_id: Optional[int], time_range: TimeRange, cost_summary: SpanCostSummary
    ) -> None:
        if self.cached_cost_summary is None:
            self.cached_cost_summary = {}
        time_range_key = (time_range.start, time_range.end) if time_range else (None, None)
        cache_key = (project_id, time_range_key)
        self.cached_cost_summary[cache_key] = cost_summary

    @strawberry.field
    async def token_prices(self) -> list[TokenPrice]:
        if self.costs is None:
            raise NotImplementedError
        token_prices: list[TokenPrice] = list()
        for cost in self.costs:
            token_prices.append(
                TokenPrice(
                    token_type=cost.token_type,
                    kind=TokenKind.PROMPT if cost.is_prompt else TokenKind.COMPLETION,
                    cost_per_million_tokens=cost.base_rate * 1_000_000,
                    cost_per_token=cost.base_rate,
                )
            )
        return token_prices

    @strawberry.field
    async def cost_summary(
        self,
        info: Info[Context, None],
        project_id: Optional[GlobalID] = UNSET,
        time_range: Optional[TimeRange] = UNSET,
    ) -> SpanCostSummary:
        if self.cached_cost_summary is not None:
            time_range_key = (time_range.start, time_range.end) if time_range else (None, None)
            project_rowid: Optional[int] = None
            if project_id:
                type_name, project_rowid = from_global_id(project_id)
                if type_name != models.Project.__name__:
                    raise BadRequest("Invalid Project ID")
            cache_key = (project_rowid, time_range_key)
            if cache_key in self.cached_cost_summary:
                return self.cached_cost_summary[cache_key]

        if time_range or project_id:
            raise BadRequest(
                "Cost summaries for specific projects or time ranges are not yet implemented"
            )

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

    @strawberry.field
    async def last_used_at(self, info: Info[Context, None]) -> Optional[datetime]:
        model_id = self.id_attr
        return await info.context.data_loaders.last_used_times_by_generative_model_id.load(model_id)


def to_gql_generative_model(
    model: models.GenerativeModel,
) -> GenerativeModel:
    costs_are_loaded = isinstance(inspect(model).attrs.token_prices.loaded_value, list)
    name_pattern = model.name_pattern.pattern
    assert isinstance(name_pattern, str)
    return GenerativeModel(
        id_attr=model.id,
        name=model.name,
        provider=model.provider or None,
        name_pattern=name_pattern,
        kind=GenerativeModelKind.BUILT_IN if model.is_built_in else GenerativeModelKind.CUSTOM,
        created_at=model.created_at,
        updated_at=model.updated_at,
        start_time=model.start_time,
        provider_key=_semconv_provider_to_gql_generative_provider_key(model.provider)
        if model.provider
        else None,
        costs=model.token_prices if costs_are_loaded else None,
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
