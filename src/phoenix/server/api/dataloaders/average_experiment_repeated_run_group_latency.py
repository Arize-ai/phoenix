from typing import Optional

from sqlalchemy import func, select, tuple_
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
DatasetExampleID: TypeAlias = int
RunLatency: TypeAlias = float
Key: TypeAlias = tuple[ExperimentID, DatasetExampleID]
Result: TypeAlias = Optional[RunLatency]


class AverageExperimentRepeatedRunGroupLatencyDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        average_latency_query = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                models.ExperimentRun.dataset_example_id.label("example_id"),
                func.avg(models.ExperimentRun.latency_ms).label("average_repetition_latency_ms"),
            )
            .select_from(models.ExperimentRun)
            .where(
                tuple_(
                    models.ExperimentRun.experiment_id, models.ExperimentRun.dataset_example_id
                ).in_(set(keys))
            )
            .group_by(models.ExperimentRun.experiment_id, models.ExperimentRun.dataset_example_id)
        )
        async with self._db() as session:
            average_run_latencies_ms = {
                (experiment_id, example_id): average_run_latency_ms
                async for experiment_id, example_id, average_run_latency_ms in await session.stream(
                    average_latency_query
                )
            }
        return [
            average_run_latencies_ms.get((experiment_id, example_id))
            for experiment_id, example_id in keys
        ]
