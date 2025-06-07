from typing import Optional

import strawberry

from phoenix.db import models


@strawberry.type
class TokenCost:
    input: Optional[float] = None
    output: Optional[float] = None
    cache_read: Optional[float] = None
    cache_write: Optional[float] = None
    prompt_audio: Optional[float] = None
    completion_audio: Optional[float] = None
    reasoning: Optional[float] = None
    total: Optional[float] = None


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
