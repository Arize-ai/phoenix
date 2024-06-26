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
RunCount: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = RunCount


class ExperimentRunCountsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: Callable[[], AsyncContextManager[AsyncSession]],
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: List[Key]) -> List[Result]:
        experiment_ids = keys
        async with self._db() as session:
            run_counts = {
                experiment_id: run_count
                async for experiment_id, run_count in await session.stream(
                    select(models.ExperimentRun.experiment_id, func.count())
                    .where(models.ExperimentRun.experiment_id.in_(set(experiment_ids)))
                    .group_by(models.ExperimentRun.experiment_id)
                )
            }
        return [
            run_counts.get(experiment_id, ValueError(f"Unknown experiment: {experiment_id}"))
            for experiment_id in experiment_ids
        ]
