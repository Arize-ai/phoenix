from collections import defaultdict

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import CostBreakdown, SpanCostSummary
from phoenix.server.types import DbSessionFactory

ExperimentId: TypeAlias = int
Key: TypeAlias = ExperimentId
Result: TypeAlias = SpanCostSummary


class SpanCostSummaryByExperimentDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(
                models.ExperimentRun.experiment_id,
                func.sum(models.SpanCost.prompt_cost).label("prompt_cost"),
                func.sum(models.SpanCost.completion_cost).label("completion_cost"),
                func.sum(models.SpanCost.total_cost).label("total_cost"),
                func.sum(models.SpanCost.prompt_tokens).label("prompt_tokens"),
                func.sum(models.SpanCost.completion_tokens).label("completion_tokens"),
                func.sum(models.SpanCost.total_tokens).label("total_tokens"),
            )
            .select_from(models.ExperimentRun)
            .join(models.Trace, models.ExperimentRun.trace_id == models.Trace.trace_id)
            .join(models.SpanCost, models.SpanCost.trace_rowid == models.Trace.id)
            .where(models.ExperimentRun.experiment_id.in_(keys))
            .group_by(models.ExperimentRun.experiment_id)
        )

        results: defaultdict[Key, Result] = defaultdict(SpanCostSummary)
        async with self._db() as session:
            data = await session.stream(stmt)
            async for (
                experiment_id,
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
                results[experiment_id] = summary
        return list(map(results.__getitem__, keys))
