from typing import (
    List,
)

from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
RunCount: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = RunCount


class ExperimentRunCountsDataLoader(DataLoader[Key, Result]):
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
                func.count(models.ExperimentRun.experiment_id),
            )
            .outerjoin_from(
                from_=resolved_experiment_ids,
                target=models.ExperimentRun,
                onclause=resolved_experiment_ids.c.id == models.ExperimentRun.experiment_id,
            )
            .group_by(resolved_experiment_ids.c.id)
        )
        async with self._db() as session:
            run_counts = {
                experiment_id: run_count
                async for experiment_id, run_count in await session.stream(query)
            }
        return [
            run_counts.get(experiment_id, ValueError(f"Unknown experiment: {experiment_id}"))
            for experiment_id in experiment_ids
        ]
