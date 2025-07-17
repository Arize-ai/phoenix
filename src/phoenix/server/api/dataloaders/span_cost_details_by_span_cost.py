from collections import defaultdict

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanCostId: TypeAlias = int
Key: TypeAlias = SpanCostId
Result: TypeAlias = list[models.SpanCostDetail]


class SpanCostDetailsBySpanCostDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        entity = models.SpanCostDetail
        stmt = select(entity).where(entity.span_cost_id.in_(keys))
        result: defaultdict[Key, Result] = defaultdict(list)
        async with self._db() as session:
            async for obj in await session.stream_scalars(stmt):
                result[obj.span_cost_id].append(obj)
        return list(map(result.__getitem__, keys))
