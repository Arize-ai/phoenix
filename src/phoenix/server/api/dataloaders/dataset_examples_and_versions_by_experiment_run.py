from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentRunID: TypeAlias = int
DatasetExampleID: TypeAlias = int
DatasetVersionID: TypeAlias = int
Key: TypeAlias = ExperimentRunID
Result: TypeAlias = tuple[models.DatasetExample, DatasetVersionID]


class DatasetExamplesAndVersionsByExperimentRunDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_run_ids = set(keys)
        examples_and_versions_query = (
            select(
                models.ExperimentRun.id.label("experiment_run_id"),
                models.DatasetExample,
                models.Experiment.dataset_version_id.label("dataset_version_id"),
            )
            .select_from(models.ExperimentRun)
            .join(
                models.DatasetExample,
                models.DatasetExample.id == models.ExperimentRun.dataset_example_id,
            )
            .join(
                models.Experiment,
                models.Experiment.id == models.ExperimentRun.experiment_id,
            )
            .where(models.ExperimentRun.id.in_(experiment_run_ids))
        )
        async with self._db() as session:
            examples_and_versions = {
                experiment_run_id: (example, version_id)
                for experiment_run_id, example, version_id in (
                    await session.execute(examples_and_versions_query)
                ).all()
            }

        return [examples_and_versions[key] for key in keys]
