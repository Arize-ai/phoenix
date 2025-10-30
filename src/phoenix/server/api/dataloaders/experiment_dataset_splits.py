from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = list[models.DatasetSplit]


class ExperimentDatasetSplitsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(
            load_fn=self._load_fn,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        async with self._db() as session:
            splits: dict[ExperimentID, list[models.DatasetSplit]] = {}

            async for experiment_id, split in await session.stream(
                select(models.ExperimentDatasetSplit.experiment_id, models.DatasetSplit)
                .select_from(models.DatasetSplit)
                .join(
                    models.ExperimentDatasetSplit,
                    onclause=(
                        models.DatasetSplit.id == models.ExperimentDatasetSplit.dataset_split_id
                    ),
                )
                .where(models.ExperimentDatasetSplit.experiment_id.in_(experiment_ids))
            ):
                if experiment_id not in splits:
                    splits[experiment_id] = []
                splits[experiment_id].append(split)

            return [
                sorted(splits.get(experiment_id, []), key=lambda x: x.name)
                for experiment_id in keys
            ]
