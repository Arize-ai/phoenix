from collections import defaultdict

from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.session_aggregates import cost_summary_by_session
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
        stmt = cost_summary_by_session().as_grouped_subquery(keys)
        results: defaultdict[Key, Result] = defaultdict(SpanCostSummary)
        async with self._db.read() as session:
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
