import pytest
from sqlalchemy import insert
from strawberry.schema import Schema as StrawberrySchema

from phoenix.db import models
from phoenix.server.api.queries import Query
from phoenix.server.types import DbSessionFactory


@pytest.fixture
def strawberry_schema() -> StrawberrySchema:
    return StrawberrySchema(Query)


@pytest.fixture
async def interlaced_experiments(db: DbSessionFactory) -> list[int]:
    async with db() as session:
        dataset_ids = list(
            await session.scalars(
                insert(models.Dataset).returning(models.Dataset.id),
                [{"name": f"{i}", "metadata_": {}} for i in range(3)],
            )
        )
        dataset_version_ids = list(
            await session.scalars(
                insert(models.DatasetVersion).returning(models.DatasetVersion.dataset_id),
                [{"dataset_id": dataset_id, "metadata_": {}} for dataset_id in dataset_ids],
            )
        )
        return list(
            await session.scalars(
                insert(models.Experiment).returning(models.Experiment.id),
                [
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": dataset_version_ids[i],
                        "name": f"experiment-{i}",
                        "repetitions": 1,
                        "metadata_": {},
                    }
                    for _ in range(4)
                    for i, dataset_id in enumerate(dataset_ids)
                ],
            )
        )
