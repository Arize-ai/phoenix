from collections import defaultdict
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.sql.functions import coalesce
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.dataloaders.types import CostBreakdown, SpanCostSummary
from phoenix.server.types import DbSessionFactory

GenerativeModelId: TypeAlias = int
ProjectId: TypeAlias = int
Key: TypeAlias = tuple[GenerativeModelId, Optional[ProjectId]]
Result: TypeAlias = SpanCostSummary


class SpanCostSummaryByGenerativeModelDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        model_ids = [key[0] for key in keys]
        stmt = (
            select(
                models.SpanCost.model_id,
                models.Trace.project_rowid,
                coalesce(func.sum(models.SpanCost.prompt_cost), 0).label("prompt_cost"),
                coalesce(func.sum(models.SpanCost.completion_cost), 0).label("completion_cost"),
                coalesce(func.sum(models.SpanCost.total_cost), 0).label("total_cost"),
                coalesce(func.sum(models.SpanCost.prompt_tokens), 0).label("prompt_tokens"),
                coalesce(func.sum(models.SpanCost.completion_tokens), 0).label("completion_tokens"),
                coalesce(func.sum(models.SpanCost.total_tokens), 0).label("total_tokens"),
            )
            .join(models.Trace, models.Trace.id == models.SpanCost.trace_rowid)
            .where(models.SpanCost.model_id.in_(model_ids))
            .group_by(models.SpanCost.model_id, models.Trace.project_rowid)
        )
        data: dict[GenerativeModelId, dict[ProjectId, Result]] = {}

        async with self._db() as session:
            async for (
                model_id,
                project_id,
                prompt_cost,
                completion_cost,
                total_cost,
                prompt_tokens,
                completion_tokens,
                total_tokens,
            ) in await session.stream(stmt):
                summary = SpanCostSummary(
                    prompt=CostBreakdown(tokens=prompt_tokens, cost=prompt_cost),
                    completion=CostBreakdown(tokens=completion_tokens, cost=completion_cost),
                    total=CostBreakdown(tokens=total_tokens, cost=total_cost),
                )
                if model_id not in data:
                    data[model_id] = {}
                data[model_id][project_id] = summary

        results: defaultdict[Key, Result] = defaultdict(SpanCostSummary)
        for model_id, project_id in keys:
            if model_id not in data:
                continue
            if project_id is None:
                print(data[model_id])
                results[(model_id, project_id)] = sum(
                    data[model_id].values(), start=SpanCostSummary()
                )
            else:
                results[(model_id, project_id)] = data[model_id][project_id]
        return [results.get(key, SpanCostSummary()) for key in keys]
