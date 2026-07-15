from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class ProjectEvaluatorCriteriaByIdDataLoader(
    DataLoader[int, Optional[models.ProjectEvaluatorCriteria]]
):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[int]) -> list[Optional[models.ProjectEvaluatorCriteria]]:
        records_by_id: dict[int, models.ProjectEvaluatorCriteria] = {}
        async with self._db.read() as session:
            records = await session.scalars(
                select(models.ProjectEvaluatorCriteria).where(
                    models.ProjectEvaluatorCriteria.id.in_(keys)
                )
            )
            for record in records:
                records_by_id[record.id] = record
        return [records_by_id.get(key) for key in keys]
