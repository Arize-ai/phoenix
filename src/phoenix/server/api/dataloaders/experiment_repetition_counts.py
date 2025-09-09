from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
RepetitionCount: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = RepetitionCount


class ExperimentRepetitionCountsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        repetition_counts_query = (
            select(
                models.ExperimentRun.experiment_id,
                func.max(models.ExperimentRun.repetition_number).label("repetition_count"),
            )
            .group_by(models.ExperimentRun.experiment_id)
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
        )
        async with self._db() as session:
            repetition_counts = {
                experiment_id: repetition_count
                for experiment_id, repetition_count in await session.execute(
                    repetition_counts_query
                )
            }
        return [repetition_counts.get(experiment_id, 0) for experiment_id in keys]
