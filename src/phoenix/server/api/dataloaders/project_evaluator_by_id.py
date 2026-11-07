from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class ProjectEvaluatorByIdDataLoader(DataLoader[int, Optional[models.ProjectEvaluator]]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[int]) -> list[Optional[models.ProjectEvaluator]]:
        records_by_id: dict[int, models.ProjectEvaluator] = {}
        async with self._db.read() as session:
            records = await session.scalars(
                select(models.ProjectEvaluator).where(models.ProjectEvaluator.id.in_(keys))
            )
            for record in records:
                records_by_id[record.id] = record
        return [records_by_id.get(key) for key in keys]
