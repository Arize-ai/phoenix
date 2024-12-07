from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int
Result: TypeAlias = int


class SessionNumTracesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        stmt = (
            select(
                models.Trace.project_session_rowid.label("id_"),
                func.count(models.Trace.id).label("value"),
            )
            .group_by(models.Trace.project_session_rowid)
            .where(models.Trace.project_session_rowid.in_(keys))
        )
        async with self._db() as session:
            result: dict[Key, int] = {
                id_: value async for id_, value in await session.stream(stmt) if id_ is not None
            }
        return [result.get(key, 0) for key in keys]
