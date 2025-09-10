from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import CostBreakdown, SpanCostSummary
from phoenix.server.types import DbSessionFactory

ProjectSessionRowId: TypeAlias = int
Key: TypeAlias = ProjectSessionRowId
Result: TypeAlias = SpanCostSummary


class SpanCostSummaryByProjectSessionDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        pk = models.Trace.project_session_rowid
        stmt = (
            select(
                pk,
                coalesce(func.sum(models.SpanCost.prompt_cost), 0).label("prompt_cost"),
                coalesce(func.sum(models.SpanCost.completion_cost), 0).label("completion_cost"),
                coalesce(func.sum(models.SpanCost.total_cost), 0).label("total_cost"),
                coalesce(func.sum(models.SpanCost.prompt_tokens), 0).label("prompt_tokens"),
                coalesce(func.sum(models.SpanCost.completion_tokens), 0).label("completion_tokens"),
                coalesce(func.sum(models.SpanCost.total_tokens), 0).label("total_tokens"),
            )
            .join_from(models.SpanCost, models.Trace)
            .where(pk.in_(keys))
            .group_by(pk)
        )
        results: defaultdict[Key, Result] = defaultdict(SpanCostSummary)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for (
                id_,
                prompt_cost,
                completion_cost,
                total_cost,
                prompt_tokens,
                completion_tokens,
                total_tokens,
            ) in data:
                summary = SpanCostSummary(
                    prompt=CostBreakdown(tokens=prompt_tokens, cost=prompt_cost),
                    completion=CostBreakdown(tokens=completion_tokens, cost=completion_cost),
                    total=CostBreakdown(tokens=total_tokens, cost=total_cost),
                )
                results[id_] = summary
        return list(map(results.__getitem__, keys))
