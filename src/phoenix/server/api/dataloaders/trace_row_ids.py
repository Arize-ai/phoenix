from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

TraceId: TypeAlias = str
Key: TypeAlias = TraceId
Result: TypeAlias = Optional[int]


class TraceRowIdsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: Callable[[], AsyncContextManager[AsyncSession]]) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        stmt = select(models.Trace.trace_id, models.Trace.id).where(models.Trace.trace_id.in_(keys))
        async with self._db() as session:
            result = {k: v async for k, v in await session.stream(stmt)}
        return list(map(result.get, keys))
