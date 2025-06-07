from datetime import datetime
from typing import Optional

import strawberry
from strawberry.relay import Node, NodeID
from strawberry.types import Info

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
