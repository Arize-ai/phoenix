from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import (
    CostBreakdown,
    SpanCostDetailSummaryEntry,
)
from phoenix.server.types import DbSessionFactory

GenerativeModelId: TypeAlias = int
Key: TypeAlias = GenerativeModelId
Result: TypeAlias = list[SpanCostDetailSummaryEntry]


class SpanCostDetailSummaryEntriesByGenerativeModelDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        pk = models.SpanCost.model_id
        stmt = (
            select(
                pk,
                models.SpanCostDetail.token_type,
                models.SpanCostDetail.is_prompt,
                coalesce(func.sum(models.SpanCostDetail.cost), 0).label("cost"),
                coalesce(func.sum(models.SpanCostDetail.tokens), 0).label("tokens"),
            )
            .select_from(models.SpanCostDetail)
            .join(models.SpanCost, models.SpanCostDetail.span_cost_id == models.SpanCost.id)
            .where(pk.in_(keys))
            .group_by(pk, models.SpanCostDetail.token_type, models.SpanCostDetail.is_prompt)
        )
        results: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for (
                id_,
                token_type,
                is_prompt,
                cost,
                tokens,
            ) in data:
                entry = SpanCostDetailSummaryEntry(
                    token_type=token_type,
                    is_prompt=is_prompt,
                    value=CostBreakdown(tokens=tokens, cost=cost),
                )
                results[id_].append(entry)
        return list(map(list, map(results.__getitem__, keys)))
