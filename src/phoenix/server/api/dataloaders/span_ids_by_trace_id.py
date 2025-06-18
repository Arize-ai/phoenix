from typing import List

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
SpanRowId: TypeAlias = int

Key: TypeAlias = TraceRowId
Result: TypeAlias = List[SpanRowId]


class SpanIdsByTraceIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        stmt = select(models.Span.id, models.Span.trace_rowid).where(
            models.Span.trace_rowid.in_(keys)
        )
        async with self._db() as session:
            result: dict[TraceRowId, List[SpanRowId]] = {trace_rowid: [] for trace_rowid in keys}
            async for span_rowid, trace_rowid in await session.stream(stmt):
                result[trace_rowid].append(span_rowid)
        return [result[trace_rowid] for trace_rowid in keys]
