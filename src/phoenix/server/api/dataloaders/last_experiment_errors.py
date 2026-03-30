from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import with_polymorphic
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

Key = int
Result = Optional[models.ExperimentLog]


class LastExperimentErrorsDataLoader(DataLoader[Key, Result]):
    """Batches loads of the most recent experiment log row per experiment id."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        poly = with_polymorphic(models.ExperimentLog, "*")
        # Correlated subquery: latest occurred_at per experiment_id
        latest_subq = (
            select(models.ExperimentLog.id)
            .where(models.ExperimentLog.experiment_id == poly.experiment_id)
            .order_by(models.ExperimentLog.occurred_at.desc())
            .limit(1)
            .correlate(poly)
            .scalar_subquery()
        )
        stmt = select(poly).where(poly.experiment_id.in_(keys)).where(poly.id == latest_subq)
        by_experiment_id: dict[int, models.ExperimentLog] = {}
        async with self._db() as session:
            for row in await session.scalars(stmt):
                by_experiment_id[row.experiment_id] = row
            for row in by_experiment_id.values():
                session.expunge(row)
        return [by_experiment_id.get(key) for key in keys]
