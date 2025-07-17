from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int

Key: TypeAlias = SpanRowId
Result: TypeAlias = int


class NumChildSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        span_rowids = list(set(keys))
        result: dict[Key, Result] = {}
        children = select(models.Span).alias("children")
        stmt = (
            select(models.Span.id, func.count())
            .where(models.Span.id.in_(span_rowids))
            .join(children, children.c.parent_id == models.Span.span_id)
            .group_by(models.Span.id)
        )
        async with self._db() as session:
            data = await session.stream(stmt)
            async for span_rowid, num_child_spans in data:
                result[span_rowid] = num_child_spans
        return [result.get(span_rowid, 0) for span_rowid in keys]
