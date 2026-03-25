from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import aliased
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key = int
Result = Optional[models.ExperimentError]


class LastExperimentErrorsDataLoader(DataLoader[Key, Result]):
    """Batches loads of the most recent experiment error per experiment id."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        # Correlated subquery: latest occurred_at per experiment_id
        outer = aliased(models.ExperimentError)
        latest_subq = (
            select(models.ExperimentError.id)
            .where(models.ExperimentError.experiment_id == outer.experiment_id)
            .order_by(models.ExperimentError.occurred_at.desc())
            .limit(1)
            .correlate(outer)
            .scalar_subquery()
        )
        stmt = select(outer).where(outer.experiment_id.in_(keys)).where(outer.id == latest_subq)
        by_experiment_id: dict[int, models.ExperimentError] = {}
        async with self._db() as session:
            for row in await session.scalars(stmt):
                by_experiment_id[row.experiment_id] = row
        return [by_experiment_id.get(key) for key in keys]
