from typing import Iterable, Optional

from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.trace_aggregates import SPAN_ROWID, TRACE_ROWID, representative_root_span_by_trace
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
SpanRowId: TypeAlias = int

Key: TypeAlias = TraceRowId
Result: TypeAlias = Optional[SpanRowId]


class TraceRootSpansDataLoader(DataLoader[Key, Result]):
    """The representative root span of each trace.

    A root span has no parent id, or a parent id whose span was never received (an orphan).
    Ties break on earliest start time, so every surface that shows one span per trace shows
    the same one.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        keys = list(keys)
        stmt = representative_root_span_by_trace(keys=keys)
        async with self._db.read() as session:
            result: dict[Key, int] = {
                row[TRACE_ROWID]: row[SPAN_ROWID]
                async for row in (await session.stream(stmt)).mappings()
            }
        return [result.get(key) for key in keys]
