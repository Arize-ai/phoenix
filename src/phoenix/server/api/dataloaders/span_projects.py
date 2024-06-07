from typing import (
    AsyncContextManager,
    Callable,
    List,
)

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

SpanID: TypeAlias = int
Key: TypeAlias = SpanID
Result: TypeAlias = models.Project


class SpanProjectsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        raise NotImplementedError("need to implement dataloader")
