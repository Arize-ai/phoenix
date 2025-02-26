from collections import defaultdict
from typing import Iterable

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

SpanRowId: TypeAlias = int

Key: TypeAlias = SpanRowId
Result: TypeAlias = list[int]


class ChildSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        span_rowids = list(set(keys))
        result: defaultdict[Key, Result] = defaultdict(list)
        children = select(models.Span).alias("children")
        stmt = (
            select(models.Span.id, children.c.id)
            .where(models.Span.id.in_(span_rowids))
            .join(children, children.c.parent_id == models.Span.span_id)
        )
        async with self._db() as session:
            data = await session.stream(stmt)
            async for span_rowid, child_rowid in data:
                result[span_rowid].append(child_rowid)
        return [result.get(span_rowid, []).copy() for span_rowid in keys]
