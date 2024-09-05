from typing import (
    List,
    Optional,
)

from sqlalchemy import case, func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
ErrorRate: TypeAlias = float
Key: TypeAlias = ExperimentID
Result: TypeAlias = Optional[ErrorRate]


class ExperimentErrorRatesDataLoader(DataLoader[Key, Result]):
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
                case(
                    (
                        func.count(models.ExperimentRun.id) != 0,
                        func.count(models.ExperimentRun.error)
                        / func.count(models.ExperimentRun.id),
                    ),
                    else_=None,
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
            error_rates = {
                experiment_id: error_rate
                async for experiment_id, error_rate in await session.stream(query)
            }
        return [
            error_rates.get(experiment_id, ValueError(f"Unknown experiment ID: {experiment_id}"))
            for experiment_id in keys
        ]
