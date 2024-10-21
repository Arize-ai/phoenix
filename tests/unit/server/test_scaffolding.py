from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def new_database(db: DbSessionFactory) -> None:
    async with db() as session:
        project = models.Project(name="default")
        session.add(project)
        await session.flush()


async def test_scaffolding(db: DbSessionFactory, new_database: None) -> None:
    async with db() as session:
        created_at = await session.scalar(
            select(models.Project.created_at).where(models.Project.name == "default")
        )
    assert created_at is not None
    assert created_at - datetime.now(timezone.utc) < timedelta(minutes=5)
