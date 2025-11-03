from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanID: TypeAlias = int
Key: TypeAlias = SpanID
Result: TypeAlias = Optional[models.SpanCost]


class SpanCostsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        span_ids = list(set(keys))
        async with self._db() as session:
            costs = {
                span_cost.span_rowid: span_cost
                async for span_cost in await session.stream_scalars(
                    select(models.SpanCost).where(models.SpanCost.span_rowid.in_(span_ids))
                )
            }
        return [costs.get(span_id) for span_id in keys]
