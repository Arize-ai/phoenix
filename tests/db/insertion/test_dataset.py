from typing import AsyncContextManager, Callable

from phoenix.db import models
from phoenix.db.insertion.dataset import add_table
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_create_dataset(
    db: Callable[[], AsyncContextManager[AsyncSession]],
) -> None:
    async with db() as session:
        await add_table(
            session=session,
            table=[
                {"x": 1, "y": 2, "z": 3, "zz": 4},
                {"x": 11, "y": 22, "z": 33, "zz": 44},
            ],
            input_keys=["x", "y"],
            output_keys=["z"],
            metadata_keys=["zz"],
            name="abc",
            description="xyz",
            metadata={"m": 0},
        )
    async with db() as session:
        data = await session.scalars(
            select(models.DatasetExampleRevisions)
            .join(models.DatasetExample)
            .join_from(models.DatasetExample, models.Dataset)
            .where(models.Dataset.name == "abc")
            .where(models.Dataset.description == "xyz")
            .where(models.Dataset.metadata_["m"].as_float() == 0)
            .order_by(models.DatasetExampleRevisions.id)
        )
    rev = next(data)
    assert rev.input == {"x": 1, "y": 2}
    assert rev.output == {"z": 3}
    assert rev.metadata_ == {"zz": 4}
    rev = next(data)
    assert rev.input == {"x": 11, "y": 22}
    assert rev.output == {"z": 33}
    assert rev.metadata_ == {"zz": 44}
