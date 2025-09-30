from sqlalchemy import select
from strawberry.dataloader import DataLoader
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

ExampleID: TypeAlias = int
Key: TypeAlias = ExampleID
Result: TypeAlias = list[models.DatasetSplit]


class DatasetExampleSplitsDataLoader(DataLoader[Key, Result]):
    def __init__(self, db: DbSessionFactory) -> None:
        super().__init__(
            load_fn=self._load_fn,
        )
        self._db = db

    async def _load_fn(self, keys: list[Key]) -> list[Result]:
        example_ids = keys
        async with self._db() as session:
            splits: dict[ExampleID, list[models.DatasetSplit]] = {}

            async for example_id, split in await session.stream(
                select(models.DatasetSplitDatasetExample.dataset_example_id, models.DatasetSplit)
                .select_from(models.DatasetSplit)
                .join(
                    models.DatasetSplitDatasetExample,
                    onclause=(
                        models.DatasetSplit.id == models.DatasetSplitDatasetExample.dataset_split_id
                    ),
                )
                .where(models.DatasetSplitDatasetExample.dataset_example_id.in_(example_ids))
            ):
                if example_id not in splits:
                    splits[example_id] = []
                splits[example_id].append(split)

            return [sorted(splits.get(example_id, []), key=lambda x: x.name) for example_id in keys]
