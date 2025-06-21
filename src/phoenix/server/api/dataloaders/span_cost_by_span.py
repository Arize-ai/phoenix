from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int
Key: TypeAlias = SpanRowId
Result: TypeAlias = Optional[models.SpanCost]


class SpanCostBySpanDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = select(models.SpanCost).where(models.SpanCost.span_rowid.in_(keys))
        async with self._db() as session:
            result = {sc.span_rowid: sc async for sc in await session.stream_scalars(stmt)}
        return list(map(result.get, keys))
