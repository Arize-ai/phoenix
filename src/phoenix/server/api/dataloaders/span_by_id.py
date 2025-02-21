from typing import Union

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = models.Span


class SpanByIdDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Union[Result, ValueError]]:
        ids = list(set(keys))
        spans: dict[Key, Result] = {}
        async with self._db() as session:
            data = await session.stream_scalars(select(models.Span).where(models.Span.id.in_(ids)))
            async for Span in data:
                spans[Span.id] = Span
        return [spans.get(id_, ValueError("Invalid primary key for span")) for id_ in keys]
