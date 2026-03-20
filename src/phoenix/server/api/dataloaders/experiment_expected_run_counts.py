from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
ExpectedRunCount: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = ExpectedRunCount


class ExperimentExpectedRunCountsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        resolved_experiment_ids = (
            select(models.Experiment.id)
            .where(models.Experiment.id.in_(set(experiment_ids)))
            .subquery()
        )
        query = (
            select(
                resolved_experiment_ids.c.id,
                func.count(models.ExperimentDatasetExample.dataset_example_id)
                * models.Experiment.repetitions,
            )
            .select_from(resolved_experiment_ids)
            .join(
                models.Experiment,
                resolved_experiment_ids.c.id == models.Experiment.id,
            )
            .outerjoin(
                models.ExperimentDatasetExample,
                models.ExperimentDatasetExample.experiment_id == resolved_experiment_ids.c.id,
            )
            .group_by(resolved_experiment_ids.c.id, models.Experiment.repetitions)
        )
        async with self._db() as session:
            expected_counts = {
                experiment_id: expected_count
                async for experiment_id, expected_count in await session.stream(query)
            }
        return [
            expected_counts.get(experiment_id, ValueError(f"Unknown experiment: {experiment_id}"))
            for experiment_id in keys
        ]
