from typing import Optional, cast

import strawberry
from strawberry import UNSET, Info, Private
from strawberry.relay import Node, NodeID

from phoenix.db import models
from phoenix.server.api.context import Context
from phoenix.server.api.types.SpanCostDetail import SpanCostDetail


@strawberry.type
class SpanCost(Node):
    id_: NodeID[int]
    db_record: Private[models.SpanCost] = UNSET

    @strawberry.field
    async def details(
        self,
        info: Info[Context, None],
    ) -> list[SpanCostDetail]:
        loader = info.context.data_loaders.span_cost_details_by_span_cost
        records = await loader.load(self.id_)
        return [SpanCostDetail(id_=record.id, db_record=record) for record in records]

    @strawberry.field
    async def total_tokens(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.total_tokens
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.total_tokens),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def total_cost(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.total_cost
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.total_cost),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def total_cost_per_token(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.total_cost_per_token
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.total_cost_per_token),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def prompt_tokens(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.prompt_tokens
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.prompt_tokens),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def prompt_cost(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.prompt_cost
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.prompt_cost),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def prompt_cost_per_token(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.prompt_cost_per_token
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.prompt_cost_per_token),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def completion_tokens(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.completion_tokens
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.completion_tokens),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def completion_cost(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.completion_cost
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.completion_cost),
        )
        return cast(Optional[float], value)

    @strawberry.field
    async def completion_cost_per_token(
        self,
        info: Info[Context, None],
    ) -> Optional[float]:
        if self.db_record:
            return self.db_record.completion_cost_per_token
        value = await info.context.data_loaders.span_cost_fields.load(
            (self.id_, models.SpanCost.completion_cost_per_token),
        )
        return cast(Optional[float], value)
