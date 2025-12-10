from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class DatasetEvaluatorsByIdDataLoader(DataLoader[int, Optional[models.DatasetEvaluators]]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[int]) -> list[Optional[models.DatasetEvaluators]]:
        dataset_evaluators_by_id: dict[int, models.DatasetEvaluators] = {}
        async with self._db() as session:
            stmt = select(models.DatasetEvaluators).where(models.DatasetEvaluators.id.in_(keys))
            for record in await session.scalars(stmt):
                dataset_evaluators_by_id[record.id] = record
        return [dataset_evaluators_by_id.get(key) for key in keys]
