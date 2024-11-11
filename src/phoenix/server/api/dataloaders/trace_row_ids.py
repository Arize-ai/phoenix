from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

TraceId: TypeAlias = str
Key: TypeAlias = TraceId
TraceRowId: TypeAlias = int
ProjectRowId: TypeAlias = int
Result: TypeAlias = Optional[tuple[TraceRowId, ProjectRowId]]


class TraceRowIdsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = select(
            models.Trace.trace_id,
            models.Trace.id,
            models.Trace.project_rowid,
        ).where(models.Trace.trace_id.in_(keys))
        async with self._db() as session:
            result = {
                trace_id: (id_, project_rowid)
                async for trace_id, id_, project_rowid in await session.stream(stmt)
            }
        return list(map(result.get, keys))
