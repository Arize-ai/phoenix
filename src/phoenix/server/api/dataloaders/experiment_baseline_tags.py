from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.experiment_tags import BASELINE_EXPERIMENT_TAG_NAME
from phoenix.server.types import DbSessionFactory

ExperimentID: TypeAlias = int
Key: TypeAlias = ExperimentID
Result: TypeAlias = bool


class ExperimentBaselineTagsDataLoader(DataLoader[Key, Result]):
    def __init__(
        self,
        db: DbSessionFactory,
    ) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        query = (
            select(models.ExperimentTag.experiment_id)
            .where(models.ExperimentTag.experiment_id.in_(set(keys)))
            .where(models.ExperimentTag.name == BASELINE_EXPERIMENT_TAG_NAME)
        )
        async with self._db.read() as session:
            baseline_experiment_ids = set(await session.scalars(query))
        return [experiment_id in baseline_experiment_ids for experiment_id in keys]
