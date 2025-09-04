from sqlalchemy import distinct, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetExampleID: TypeAlias = int
ExperimentID: TypeAlias = int
Key: TypeAlias = tuple[DatasetExampleID, tuple[ExperimentID]]
Result: TypeAlias = list[models.Experiment]


class ExperimentsByDatasetExampleIdDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        example_ids: dict[tuple[ExperimentID], list[DatasetExampleID]] = {}
        for example_id, experiment_ids in keys:
            if experiment_ids not in example_ids:
                example_ids[experiment_ids] = []
            example_ids[experiment_ids].append(example_id)

        experiments_by_key: dict[Key, list[models.Experiment]] = {}

        async with self._db() as session:
            for (
                experiment_ids,
                dataset_example_ids,
            ) in example_ids.items():
                experiment_ids_subquery = (
                    select(distinct(models.ExperimentRun.experiment_id))
                    .select_from(models.ExperimentRun)
                    .where(models.ExperimentRun.dataset_example_id.in_(dataset_example_ids))
                    .scalar_subquery()
                )
                experiments_query = (
                    select(models.Experiment)
                    .where(models.Experiment.id.in_(experiment_ids_subquery))
                    .order_by(models.Experiment.id.asc())
                )
                if experiment_ids:
                    experiments_query = experiments_query.where(
                        models.Experiment.id.in_(experiment_ids)
                    )
                experiments = (await session.scalars(experiments_query)).all()
                for dataset_example_id in dataset_example_ids:
                    key = (dataset_example_id, experiment_ids)
                    if key not in experiments_by_key:
                        experiments_by_key[key] = []
                    experiments_by_key[key].extend(experiments)
        return [experiments_by_key.get(key, []) for key in keys]
