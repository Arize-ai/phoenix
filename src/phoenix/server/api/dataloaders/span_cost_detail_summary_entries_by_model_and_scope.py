from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

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


@dataclass(frozen=True)
class GenerativeModelCostDetailScope:
    model_id: int
    project_id: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


Scope: TypeAlias = tuple[Optional[int], Optional[datetime], Optional[datetime]]
Result: TypeAlias = list[SpanCostDetailSummaryEntry]


class SpanCostDetailSummaryEntriesByModelAndScopeDataLoader(
    DataLoader[GenerativeModelCostDetailScope, Result]
):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[GenerativeModelCostDetailScope]) -> list[Result]:
        results: defaultdict[GenerativeModelCostDetailScope, Result] = defaultdict(list)
        keys_by_scope: defaultdict[Scope, list[GenerativeModelCostDetailScope]] = defaultdict(list)
        for key in keys:
            scope = (key.project_id, key.start_time, key.end_time)
            keys_by_scope[scope].append(key)

        async with self._db.read() as session:
            for scope, scoped_keys in keys_by_scope.items():
                project_id, start_time, end_time = scope
                model_ids = [key.model_id for key in scoped_keys]
                stmt = (
                    select(
                        models.SpanCost.model_id,
                        models.SpanCostDetail.token_type,
                        models.SpanCostDetail.is_prompt,
                        coalesce(func.sum(models.SpanCostDetail.cost), 0).label("cost"),
                        coalesce(func.sum(models.SpanCostDetail.tokens), 0).label("tokens"),
                    )
                    .select_from(models.SpanCostDetail)
                    .join(
                        models.SpanCost,
                        models.SpanCostDetail.span_cost_id == models.SpanCost.id,
                    )
                    .where(models.SpanCost.model_id.in_(model_ids))
                    .group_by(
                        models.SpanCost.model_id,
                        models.SpanCostDetail.token_type,
                        models.SpanCostDetail.is_prompt,
                    )
                )
                if project_id is not None:
                    stmt = stmt.join(
                        models.Trace,
                        models.SpanCost.trace_rowid == models.Trace.id,
                    ).where(models.Trace.project_rowid == project_id)
                if start_time is not None:
                    stmt = stmt.where(models.SpanCost.span_start_time >= start_time)
                if end_time is not None:
                    stmt = stmt.where(models.SpanCost.span_start_time < end_time)

                data = await session.stream(stmt)
                async for model_id, token_type, is_prompt, cost, tokens in data:
                    key = GenerativeModelCostDetailScope(
                        model_id=model_id,
                        project_id=project_id,
                        start_time=start_time,
                        end_time=end_time,
                    )
                    results[key].append(
                        SpanCostDetailSummaryEntry(
                            token_type=token_type,
                            is_prompt=is_prompt,
                            value=CostBreakdown(tokens=tokens, cost=cost),
                        )
                    )

        return [results[key] for key in keys]
