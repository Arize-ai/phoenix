from typing import Optional

import strawberry

from phoenix.db import models


@strawberry.type
class TokenCost:
    input: Optional[float]
    output: Optional[float]
    cache_read: Optional[float]
    cache_write: Optional[float]
    prompt_audio: Optional[float]
    completion_audio: Optional[float]
    reasoning: Optional[float]
    total: float


def to_gql_token_cost(span_cost: models.SpanCost) -> TokenCost:
    return TokenCost(
        input=span_cost.input_token_cost,
        output=span_cost.output_token_cost,
        cache_read=span_cost.cache_read_token_cost,
        cache_write=span_cost.cache_write_token_cost,
        prompt_audio=span_cost.prompt_audio_token_cost,
        completion_audio=span_cost.completion_audio_token_cost,
        reasoning=span_cost.reasoning_token_cost,
        total=span_cost.total_token_cost,
    )
