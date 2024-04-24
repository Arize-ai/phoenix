from phoenix.db import models
from sqlalchemy import select


async def test_projects(session, project):
    # this test demonstrates parametrizing the session fixture
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await session.execute(statement)).scalars().first()
    assert result is not None


async def test_empty_projects(session):
    # shows that databases are reset between tests
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await session.execute(statement)).scalars().first()
    assert not result
