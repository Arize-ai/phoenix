from typing import Optional

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
RunLatency: TypeAlias = Optional[float]
Key: TypeAlias = ExperimentID
Result: TypeAlias = RunLatency


class AverageExperimentRunLatencyDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        average_repetition_latency_ms = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                func.avg(models.ExperimentRun.latency_ms).label("average_repetition_latency_ms"),
            )
            .select_from(models.ExperimentRun)
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(models.ExperimentRun.dataset_example_id, models.ExperimentRun.experiment_id)
            .subquery()
        )
        query = select(
            average_repetition_latency_ms.c.experiment_id,
            func.avg(average_repetition_latency_ms.c.average_repetition_latency_ms).label(
                "average_run_latency_ms"
            ),
        ).group_by(average_repetition_latency_ms.c.experiment_id)
        async with self._db() as session:
            average_run_latencies_ms = {
                experiment_id: average_run_latency_ms
                async for experiment_id, average_run_latency_ms in await session.stream(query)
            }
        return [average_run_latencies_ms.get(experiment_id) for experiment_id in keys]
