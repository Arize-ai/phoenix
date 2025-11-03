from collections import defaultdict

from sqlalchemy import select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentId: TypeAlias = int
DatasetExampleId: TypeAlias = int
Key: TypeAlias = tuple[ExperimentId, DatasetExampleId]
Result: TypeAlias = list[models.ExperimentRun]


class ExperimentRunsByExperimentAndExampleDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        runs_by_key: defaultdict[Key, Result] = defaultdict(list)

        async with self._db() as session:
            stmt = (
                select(models.ExperimentRun)
                .where(
                    tuple_(
                        models.ExperimentRun.experiment_id,
                        models.ExperimentRun.dataset_example_id,
                    ).in_(keys)
                )
                .order_by(
                    models.ExperimentRun.experiment_id,
                    models.ExperimentRun.dataset_example_id,
                    models.ExperimentRun.repetition_number,
                )
            )
            result = await session.stream_scalars(stmt)
            async for run in result:
                key = (run.experiment_id, run.dataset_example_id)
                runs_by_key[key].append(run)

        return [runs_by_key[key] for key in keys]
