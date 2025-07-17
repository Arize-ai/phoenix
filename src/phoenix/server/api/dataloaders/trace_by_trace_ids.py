from typing import List, Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = str
Result: TypeAlias = Optional[models.Trace]


class TraceByTraceIdsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        stmt = select(models.Trace).where(models.Trace.trace_id.in_(keys))
        async with self._db() as session:
            result: dict[Key, models.Trace] = {
                trace.trace_id: trace async for trace in await session.stream_scalars(stmt)
            }
        return [result.get(trace_id) for trace_id in keys]
