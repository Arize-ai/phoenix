from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int  # project rowid
Result: TypeAlias = bool


class ProjectHasTracesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        pid = models.Trace.project_rowid
        stmt = select(pid).where(pid.in_(keys)).group_by(pid)
        async with self._db() as session:
            result = set(await session.scalars(stmt))
        return [key in result for key in keys]
