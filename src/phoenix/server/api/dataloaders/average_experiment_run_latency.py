from typing import List, Optional

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

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        resolved_experiment_ids = (
            select(models.Experiment.id)
            .where(models.Experiment.id.in_(set(experiment_ids)))
            .subquery()
        )
        query = (
            select(
                resolved_experiment_ids.c.id,
                func.avg(
                    func.extract("epoch", models.ExperimentRun.end_time)
                    - func.extract("epoch", models.ExperimentRun.start_time)
                ),
            )
            .outerjoin_from(
                from_=resolved_experiment_ids,
                target=models.ExperimentRun,
                onclause=resolved_experiment_ids.c.id == models.ExperimentRun.experiment_id,
            )
            .group_by(resolved_experiment_ids.c.id)
        )
        async with self._db() as session:
            avg_latencies = {
                experiment_id: avg_latency
                async for experiment_id, avg_latency in await session.stream(query)
            }
        return [
            avg_latencies.get(experiment_id, ValueError(f"Unknown experiment: {experiment_id}"))
            for experiment_id in experiment_ids
        ]
