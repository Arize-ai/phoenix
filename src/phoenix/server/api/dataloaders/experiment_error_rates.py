from typing import (
    AsyncContextManager,
    Callable,
    List,
    Optional,
)

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models

ExperimentID: TypeAlias = int
ErrorRate: TypeAlias = float
Key: TypeAlias = ExperimentID
Result: TypeAlias = Optional[ErrorRate]


class ExperimentErrorRatesDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        async with self._db() as session:
            error_rates = {
                experiment_id: error_rate
                async for experiment_id, error_rate in await session.stream(
                    select(
                        models.ExperimentRun.experiment_id,
                        func.count(models.ExperimentRun.error) / func.count(),
                    )
                    .group_by(models.ExperimentRun.experiment_id)
                    .where(models.ExperimentRun.experiment_id.in_(experiment_ids))
                )
            }
        return [error_rates.get(experiment_id) for experiment_id in experiment_ids]
