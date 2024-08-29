from sqlalchemy import select

from phoenix.db import models
from phoenix.db.insertion.dataset import ExampleContent, add_dataset_examples
from phoenix.server.types import DbSessionFactory


async def test_create_dataset(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        await add_dataset_examples(
            session=session,
            examples=[
                ExampleContent(input={"x": 1, "y": 2}, output={"z": 3}, metadata={"zz": 4}),
                ExampleContent(input={"x": 11, "y": 22}, output={"z": 33}, metadata={"zz": 44}),
            ],
            name="abc",
            description="xyz",
            metadata={"m": 0},
        )
    async with db() as session:
        data = await session.scalars(
            select(models.DatasetExampleRevision)
            .join(models.DatasetExample)
            .join_from(models.DatasetExample, models.Dataset)
            .where(models.Dataset.name == "abc")
            .where(models.Dataset.description == "xyz")
            .where(models.Dataset.metadata_["m"].as_float() == 0)
            .order_by(models.DatasetExampleRevision.id)
        )
    rev = next(data)
    assert rev.input == {"x": 1, "y": 2}
    assert rev.output == {"z": 3}
    assert rev.metadata_ == {"zz": 4}
    rev = next(data)
    assert rev.input == {"x": 11, "y": 22}
    assert rev.output == {"z": 33}
    assert rev.metadata_ == {"zz": 44}
