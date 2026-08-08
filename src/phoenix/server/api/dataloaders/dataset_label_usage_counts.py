from sqlalchemy import func, select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetLabelID: TypeAlias = int
UsageCount: TypeAlias = int
Key: TypeAlias = DatasetLabelID
Result: TypeAlias = UsageCount


class DatasetLabelUsageCountsDataLoader(DataLoader[Key, Result]):
    """Batches per-label counts of how many datasets reference each dataset label."""

    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        dataset_label_ids = keys
        query = (
            select(
                models.DatasetsDatasetLabel.dataset_label_id,
                func.count(models.DatasetsDatasetLabel.dataset_id),
            )
            .where(models.DatasetsDatasetLabel.dataset_label_id.in_(set(dataset_label_ids)))
            .group_by(models.DatasetsDatasetLabel.dataset_label_id)
        )
        async with self._db.read() as session:
            counts = {
                dataset_label_id: usage_count
                async for dataset_label_id, usage_count in await session.stream(query)
            }
        return [counts.get(dataset_label_id, 0) for dataset_label_id in keys]
