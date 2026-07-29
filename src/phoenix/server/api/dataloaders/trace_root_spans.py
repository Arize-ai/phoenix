from typing import Iterable, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import aliased
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

TraceRowId: TypeAlias = int
SpanRowId: TypeAlias = int

Key: TypeAlias = TraceRowId
Result: TypeAlias = Optional[SpanRowId]


class TraceRootSpansDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: Iterable[Key]) -> list[Result]:
        keys = list(keys)
        parent_span = aliased(models.Span)
        stmt = (
            select(models.Span.trace_rowid, models.Span.id)
            .where(models.Span.trace_rowid.in_(keys))
            .where(
                or_(
                    models.Span.parent_id.is_(None),
                    ~select(1)
                    .where(parent_span.trace_rowid == models.Span.trace_rowid)
                    .where(parent_span.span_id == models.Span.parent_id)
                    .exists(),
                )
            )
            .order_by(
                models.Span.trace_rowid,
                models.Span.start_time,
                models.Span.id.desc(),
            )
        )
        async with self._db.read() as session:
            result: dict[Key, int] = {}
            async for trace_rowid, span_rowid in await session.stream(stmt):
                result.setdefault(trace_rowid, span_rowid)
        return [result.get(key) for key in keys]
