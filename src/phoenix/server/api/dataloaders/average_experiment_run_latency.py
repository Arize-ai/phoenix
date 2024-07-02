from typing import (
    AsyncContextManager,
    Callable,
    List,
)

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

ExperimentID: TypeAlias = int
RunLatency: TypeAlias = float
Key: TypeAlias = ExperimentID
Result: TypeAlias = RunLatency


class AverageExperimentRunLatencyDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        async with self._db() as session:
            avg_latencies = {
                experiment_id: avg_latency
                async for experiment_id, avg_latency in await session.stream(
                    select(
                        models.ExperimentRun.experiment_id,
                        func.avg(
                            func.extract(
                                "epoch",
                                models.ExperimentRun.end_time,
                            )
                            - func.extract(
                                "epoch",
                                models.ExperimentRun.start_time,
                            )
                        ),
                    )
                    .where(models.ExperimentRun.experiment_id.in_(set(experiment_ids)))
                    .group_by(models.ExperimentRun.experiment_id)
                )
            }
        return [
            avg_latencies.get(experiment_id, ValueError(f"Unknown experiment: {experiment_id}"))
            for experiment_id in experiment_ids
        ]
