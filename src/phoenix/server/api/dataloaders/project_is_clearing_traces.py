from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key: TypeAlias = int  # project rowid
Result: TypeAlias = bool


class ProjectIsClearingTracesDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        project_id_column = models.ProjectClearCleanupTask.project_id
        async with self._db.read() as session:
            clearing = set(
                await session.scalars(select(project_id_column).where(project_id_column.in_(keys)))
            )
        return [key in clearing for key in keys]
