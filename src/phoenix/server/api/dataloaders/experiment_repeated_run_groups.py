from dataclasses import dataclass

from sqlalchemy import select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
DatasetExampleID: TypeAlias = int
Key: TypeAlias = tuple[ExperimentID, DatasetExampleID]


@dataclass
class ExperimentRepeatedRunGroup:
    experiment_rowid: int
    dataset_example_rowid: int
    runs: list[models.ExperimentRun]


Result: TypeAlias = ExperimentRepeatedRunGroup


class ExperimentRepeatedRunGroupsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        repeated_run_groups_query = (
            select(models.ExperimentRun)
            .where(
                tuple_(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRun.dataset_example_id,
                ).in_(set(keys))
            )
            .order_by(models.ExperimentRun.repetition_number)
        )

        async with self._db() as session:
            runs_by_key: dict[Key, list[models.ExperimentRun]] = {}
            for run in (await session.scalars(repeated_run_groups_query)).all():
                key = (run.experiment_id, run.dataset_example_id)
                if key not in runs_by_key:
                    runs_by_key[key] = []
                runs_by_key[key].append(run)

        return [
            ExperimentRepeatedRunGroup(
                experiment_rowid=experiment_id,
                dataset_example_rowid=dataset_example_id,
                runs=runs_by_key.get((experiment_id, dataset_example_id), []),
            )
            for (experiment_id, dataset_example_id) in keys
        ]
