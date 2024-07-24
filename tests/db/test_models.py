from typing import Any, AsyncContextManager, Callable

from phoenix.db import models
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_projects_with_session_injection(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    project: Any,
):
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_projects_with_db_injection(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    project: Any,
):
    # this test demonstrates mixing the db and model fixtures
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_empty_projects(
    db: Callable[[], AsyncContextManager[AsyncSession]],
):
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    async with db() as session:
        result = (await session.execute(statement)).scalars().first()
    assert not result
