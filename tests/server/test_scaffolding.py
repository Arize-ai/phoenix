from datetime import datetime, timedelta, timezone

import pytest
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from sqlalchemy import select


@pytest.fixture
async def new_database(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()


async def test_scaffolding(db, new_database) -> None:
    async with db() as session:
        created_at = await session.scalar(
            select(models.Project.created_at).where(models.Project.name == "default")
        )
    assert created_at - datetime.now(timezone.utc) < timedelta(minutes=5)
