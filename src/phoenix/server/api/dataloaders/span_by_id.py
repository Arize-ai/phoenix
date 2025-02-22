from typing import Iterable, Union

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int

Key: TypeAlias = SpanRowId
Result: TypeAlias = models.Span


class SpanByIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Union[Result, ValueError]]:
        span_rowids = list(set(keys))
        spans: dict[Key, Result] = {}
        stmt = select(models.Span).where(models.Span.id.in_(span_rowids))
        async with self._db() as session:
            data = await session.stream_scalars(stmt)
            async for span in data:
                spans[span.id] = span
        return [spans.get(span_rowid, ValueError("Invalid span row id")) for span_rowid in keys]
