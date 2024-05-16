from phoenix.db import models
from sqlalchemy import select


async def test_projects_with_session_injection(session, project):
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_projects_with_db_injection(db, project):
    # this test demonstrates mixing the db and model fixtures
    async with db() as session:
        statement = select(models.Project).where(models.Project.name == "test_project")
        result = (await session.execute(statement)).scalars().first()
        assert result is not None


async def test_empty_projects(session):
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await session.execute(statement)).scalars().first()
    assert not result
