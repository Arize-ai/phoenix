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
    costs: strawberry.Private[list[models.ModelCost]] = None

    @strawberry.field
    async def cost(self, info: Info[Context, None]) -> Optional[TokenCost]:
        if self.costs is None:
            raise NotImplementedError
        token_cost = TokenCost()
        for cost in self.costs:
            setattr(token_cost, cost.token_type, cost.cost_per_token)
        return token_cost
