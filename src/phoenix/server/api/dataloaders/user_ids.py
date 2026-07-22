from typing import Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import InstrumentedAttribute
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias, assert_never

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = Optional[str]

Kind = Literal["session", "trace"]


class UserIdsDataLoader(DataLoader[Key, Result]):
    """Loads the first non-null `user.id` span attribute for each session or trace,
    ordered by span start time."""

    def __init__(self, db: DbSessionFactory, kind: Kind) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db
        self._kind = kind

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        id_col: InstrumentedAttribute[Optional[int]]
        if self._kind == "session":
            id_col = models.Trace.project_session_rowid
        elif self._kind == "trace":
            id_col = models.Span.trace_rowid
        else:
            assert_never(self._kind)
        user_id = models.Span.attributes[models.USER_ID].as_string()
        stmt = (
            select(
                id_col.label("id_"),
                user_id.label("user_id"),
                func.row_number()
                .over(
                    partition_by=id_col,
                    order_by=[models.Span.start_time.asc(), models.Span.id.asc()],
                )
                .label("rank"),
            )
            .where(id_col.in_(keys))
            .where(user_id.is_not(None))
        )
        if self._kind == "session":
            stmt = stmt.join_from(models.Span, models.Trace)
        subq = stmt.subquery()
        async with self._db.read() as session:
            result: dict[Key, str] = {
                id_: value
                async for id_, value in await session.stream(
                    select(subq.c.id_, subq.c.user_id).filter_by(rank=1)
                )
                if id_ is not None
            }
        return [result.get(key) for key in keys]
