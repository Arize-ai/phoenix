from typing import Optional

from sqlalchemy import func, select
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

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        experiment_ids = keys
        average_repetition_error_rates_subquery = (
            select(
                models.ExperimentRun.experiment_id.label("experiment_id"),
                (
                    func.count(models.ExperimentRun.error) / func.count(models.ExperimentRun.id)
                ).label("average_repetition_error_rate"),
            )
            .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
            .group_by(models.ExperimentRun.dataset_example_id, models.ExperimentRun.experiment_id)
            .subquery()
            .alias("average_repetition_error_rates")
        )
        average_run_error_rates_query = select(
            average_repetition_error_rates_subquery.c.experiment_id,
            func.avg(average_repetition_error_rates_subquery.c.average_repetition_error_rate).label(
                "average_run_error_rates"
            ),
        ).group_by(average_repetition_error_rates_subquery.c.experiment_id)
        async with self._db() as session:
            average_run_error_rates = {
                experiment_id: error_rate
                async for experiment_id, error_rate in await session.stream(
                    average_run_error_rates_query
                )
            }
        return [average_run_error_rates.get(experiment_id) for experiment_id in experiment_ids]
