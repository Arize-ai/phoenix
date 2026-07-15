from typing import Optional

from openinference.semconv.trace import SpanAttributes
from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[str]


class TraceUserIdsDataLoader(DataLoader[Key, Result]):
    """Loads the first non-null `user.id` span attribute for each trace."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        user_id = models.Span.attributes[USER_ID].as_string()
        subq = (
            select(
                models.Span.trace_rowid.label("id_"),
                user_id.label("user_id"),
                func.row_number()
                .over(
                    partition_by=models.Span.trace_rowid,
                    order_by=[
                        models.Span.start_time.asc(),
                        models.Span.id.asc(),
                    ],
                )
                .label("rank"),
            )
            .where(models.Span.trace_rowid.in_(keys))
            .where(user_id.is_not(None))
        ).subquery()
        stmt = select(subq.c.id_, subq.c.user_id).filter_by(rank=1)
        async with self._db.read() as session:
            result: dict[Key, str] = {
                id_: value async for id_, value in await session.stream(stmt) if id_ is not None
            }
        return [result.get(key) for key in keys]


USER_ID = SpanAttributes.USER_ID.split(".")
