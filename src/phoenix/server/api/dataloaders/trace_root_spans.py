from typing import Iterable, Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
SpanRowId: TypeAlias = int

Key: TypeAlias = TraceRowId
Result: TypeAlias = Optional[SpanRowId]


class TraceRootSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        stmt = (
            select(models.Trace.id, models.Span.id)
            .join(models.Trace)
            .where(models.Span.parent_id.is_(None))
            .where(models.Trace.id.in_(keys))
        )
        async with self._db() as session:
            result: dict[Key, int] = {k: v async for k, v in await session.stream(stmt)}
        return [result.get(key) for key in keys]
