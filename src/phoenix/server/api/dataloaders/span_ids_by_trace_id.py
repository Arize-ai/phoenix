from typing import List

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = List[int]


class SpanIdsByTraceIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        stmt = select(models.Span.id, models.Span.trace_rowid).where(
            models.Span.trace_rowid.in_(keys)
        )
        async with self._db() as session:
            result: dict[Key, List[int]] = {trace_id: [] for trace_id in keys}
            async for span_id, trace_id in await session.stream(stmt):
                result[trace_id].append(span_id)
        return [result[trace_id] for trace_id in keys]
