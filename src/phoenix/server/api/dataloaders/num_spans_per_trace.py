from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span, Trace
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int

Key: TypeAlias = TraceRowId
Result: TypeAlias = int


class NumSpansPerTraceDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        stmt = (
            select(Trace.id, func.count()).join(Span).where(Trace.id.in_(keys)).group_by(Trace.id)
        )
        async with self._db() as session:
            data = await session.stream(stmt)
            result: dict[Key, Result] = {id_: cnt async for id_, cnt in data}
        return [result.get(id_, 0) for id_ in keys]
