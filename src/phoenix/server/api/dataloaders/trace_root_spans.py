from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import contains_eager
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[models.Span]


class TraceRootSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        stmt = (
            select(models.Span)
            .join(models.Trace)
            .where(models.Span.parent_id.is_(None))
            .where(models.Trace.id.in_(keys))
            .options(contains_eager(models.Span.trace).load_only(models.Trace.trace_id))
        )
        async with self._db() as session:
            result: dict[Key, models.Span] = {
                span.trace_rowid: span async for span in await session.stream_scalars(stmt)
            }
        return [result.get(key) for key in keys]
