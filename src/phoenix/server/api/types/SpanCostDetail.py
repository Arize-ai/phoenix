from typing import Optional, cast

import strawberry
from strawberry import UNSET, Info, Private
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context


@strawberry.type
class SpanCostDetail(Node):
    id_: NodeID[int]
    db_record: Private[models.SpanCostDetail] = UNSET

    @strawberry.field
    async def token_type(
        self,
        info: Info[Context, None],
    ) -> str:
        if self.db_record:
            return self.db_record.token_type
        loader = info.context.data_loaders.span_cost_detail_fields
        value = await loader.load(
            (self.id_, models.SpanCostDetail.token_type),
        )
        return cast(str, value)

    @strawberry.field
    async def is_prompt(
        self,
        info: Info[Context, None],
    ) -> bool:
        if self.db_record:
            return self.db_record.is_prompt
        loader = info.context.data_loaders.span_cost_detail_fields
        value = await loader.load(
            (self.id_, models.SpanCostDetail.is_prompt),
        )
        return cast(bool, value)

    @strawberry.field
    async def tokens(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.tokens
        loader = info.context.data_loaders.span_cost_detail_fields
        value = await loader.load(
            (self.id_, models.SpanCostDetail.tokens),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def cost(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.cost
        loader = info.context.data_loaders.span_cost_detail_fields
        value = await loader.load(
            (self.id_, models.SpanCostDetail.cost),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def cost_per_token(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.cost_per_token
        loader = info.context.data_loaders.span_cost_detail_fields
        value = await loader.load(
            (self.id_, models.SpanCostDetail.cost_per_token),
        )
        return cast(Optional[float], value)
