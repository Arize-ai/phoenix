from typing import (
    List,
    Optional,
)

from sqlalchemy import distinct, func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentId: TypeAlias = int
Key: TypeAlias = ExperimentId
Result: TypeAlias = Optional[int]


class ExperimentSequenceNumberDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        dataset_ids = (
            select(distinct(models.Experiment.dataset_id))
            .where(models.Experiment.id.in_(experiment_ids))
            .scalar_subquery()
        )
        row_number = (
            func.row_number().over(
                partition_by=models.Experiment.dataset_id,
                order_by=models.Experiment.id,
            )
        ).label("row_number")
        subq = (
            select(models.Experiment.id, row_number)
            .where(models.Experiment.dataset_id.in_(dataset_ids))
            .subquery()
        )
        stmt = select(subq).where(subq.c.id.in_(experiment_ids))
        async with self._db() as session:
            result = {
                experiment_id: sequence_number
                async for experiment_id, sequence_number in await session.stream(stmt)
            }
        return [result.get(experiment_id) for experiment_id in keys]
