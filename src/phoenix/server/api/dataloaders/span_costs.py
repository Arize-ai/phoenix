from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import joinedload, load_only
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
                span.id: span.span_cost
                async for span in await session.stream_scalars(
                    select(models.Span)
                    .where(models.Span.id.in_(span_ids))
                    .options(
                        load_only(models.Span.id),
                        joinedload(models.Span.span_cost),
                    )
                )
            }
        return [costs.get(span_id) for span_id in keys]
