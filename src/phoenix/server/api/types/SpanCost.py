from typing import Optional

import strawberry

from phoenix.db import models


@strawberry.type
class SpanCost:
    input_token_cost: Optional[float]
    output_token_cost: Optional[float]
    cache_read_token_cost: Optional[float]
    cache_write_token_cost: Optional[float]
    prompt_audio_token_cost: Optional[float]
    completion_audio_token_cost: Optional[float]
    reasoning_token_cost: Optional[float]
    total_token_cost: float


def to_gql_span_cost(span_cost: models.SpanCost) -> SpanCost:
    return SpanCost(
        input_token_cost=span_cost.input_token_cost,
        output_token_cost=span_cost.output_token_cost,
        cache_read_token_cost=span_cost.cache_read_token_cost,
        cache_write_token_cost=span_cost.cache_write_token_cost,
        prompt_audio_token_cost=span_cost.prompt_audio_token_cost,
        completion_audio_token_cost=span_cost.completion_audio_token_cost,
        reasoning_token_cost=span_cost.reasoning_token_cost,
        total_token_cost=span_cost.total_token_cost,
    )
