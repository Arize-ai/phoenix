from typing import Optional

from sqlalchemy import select
from strawberry.dataloader import DataLoader

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


class ExperimentExecutionConfigsDataLoader(
    DataLoader[int, Optional[models.ExperimentExecutionConfig]]
):
    """Batches loads of experiment execution config rows (PK equals experiment id)."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[int]) -> list[Optional[models.ExperimentExecutionConfig]]:
        by_id: dict[int, models.ExperimentExecutionConfig] = {}
        async with self._db() as session:
            stmt = select(models.ExperimentExecutionConfig).where(
                models.ExperimentExecutionConfig.id.in_(keys)
            )
            for record in await session.scalars(stmt):
                by_id[record.id] = record
        return [by_id.get(key) for key in keys]
