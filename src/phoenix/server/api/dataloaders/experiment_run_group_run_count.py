from sqlalchemy import func, select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetExampleID: TypeAlias = int
ExperimentID: TypeAlias = int
Key: TypeAlias = tuple[ExperimentID, DatasetExampleID]
Result: TypeAlias = int


class ExperimentRunGroupRunCountsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        run_counts_query = (
            select(
                models.ExperimentRun.experiment_id,
                models.ExperimentRun.dataset_example_id,
                func.count(models.ExperimentRun.id),
            )
            .group_by(
                models.ExperimentRun.experiment_id,
                models.ExperimentRun.dataset_example_id,
            )
            .where(
                tuple_(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRun.dataset_example_id,
                ).in_(keys),
            )
        )
        async with self._db() as session:
            run_counts = {
                (experiment_id, dataset_example_id): run_count
                async for experiment_id, dataset_example_id, run_count in await session.stream(
                    run_counts_query
                )
            }
        return [
            run_counts.get((experiment_id, dataset_example_id), 0)
            for (experiment_id, dataset_example_id) in keys
        ]
