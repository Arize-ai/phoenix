from collections import defaultdict
from typing import Iterable

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db.models import Span
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
SpanKindStr: TypeAlias = str

Key: TypeAlias = TraceRowId
Result: TypeAlias = list[tuple[SpanKindStr, int]]


class TraceSpanCountsByKindDataLoader(DataLoader[Key, Result]):
    """Counts spans per `(trace_rowid, span_kind)` pair.

    Returns, per trace, a list of `(span_kind, count)` pairs in deterministic
    order (descending count, then ascending kind name). Absent kinds are
    omitted — callers can treat a missing kind as zero.
    """

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        keys = list(keys)
        stmt = (
            select(Span.trace_rowid, Span.span_kind, func.count().label("cnt"))
            .where(Span.trace_rowid.in_(keys))
            .group_by(Span.trace_rowid, Span.span_kind)
        )
        buckets: dict[Key, list[tuple[SpanKindStr, int]]] = defaultdict(list)
        async with self._db.read() as session:
            async for trace_rowid, span_kind, cnt in await session.stream(stmt):
                buckets[trace_rowid].append((span_kind, cnt))
        # Sort each bucket deterministically: count desc, then kind asc.
        for trace_rowid in buckets:
            buckets[trace_rowid].sort(key=lambda row: (-row[1], row[0]))
        return [buckets.get(key, []) for key in keys]
