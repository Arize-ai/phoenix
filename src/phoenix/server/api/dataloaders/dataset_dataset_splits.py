from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

DatasetID: TypeAlias = int
Key: TypeAlias = DatasetID
Result: TypeAlias = list[models.DatasetSplit]


class DatasetDatasetSplitsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(
            load_fn=self._load_fn,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        dataset_ids = keys
        async with self._db() as session:
            splits: dict[DatasetID, dict[int, models.DatasetSplit]] = {
                dataset_id: {} for dataset_id in dataset_ids
            }

            async for dataset_id, split in await session.stream(
                select(models.DatasetExample.dataset_id, models.DatasetSplit)
                .select_from(models.DatasetSplit)
                .join(
                    models.DatasetSplitDatasetExample,
                    onclause=(
                        models.DatasetSplit.id == models.DatasetSplitDatasetExample.dataset_split_id
                    ),
                )
                .join(
                    models.DatasetExample,
                    onclause=(
                        models.DatasetSplitDatasetExample.dataset_example_id
                        == models.DatasetExample.id
                    ),
                )
                .where(models.DatasetExample.dataset_id.in_(dataset_ids))
            ):
                # Use dict to deduplicate splits by split.id
                if dataset_id in splits:
                    splits[dataset_id][split.id] = split

            return [
                sorted(splits.get(dataset_id, {}).values(), key=lambda x: x.name)
                for dataset_id in keys
            ]
