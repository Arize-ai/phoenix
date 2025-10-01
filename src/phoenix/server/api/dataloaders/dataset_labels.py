from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetID: TypeAlias = int
Key: TypeAlias = DatasetID
Result: TypeAlias = list[models.DatasetLabel]


class DatasetLabelsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(load_fn=self._load_fn)
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        dataset_ids = keys
        async with self._db() as session:
            labels: dict[Key, Result] = {}
            for dataset_id, label in await session.execute(
                select(models.DatasetsDatasetLabel.dataset_id, models.DatasetLabel)
                .select_from(models.DatasetLabel)
                .join(
                    models.DatasetsDatasetLabel,
                    models.DatasetLabel.id == models.DatasetsDatasetLabel.dataset_label_id,
                )
                .where(models.DatasetsDatasetLabel.dataset_id.in_(dataset_ids))
            ):
                if dataset_id not in labels:
                    labels[dataset_id] = []
                labels[dataset_id].append(label)
        return [
            sorted(labels.get(dataset_id, []), key=lambda label: label.name) for dataset_id in keys
        ]
