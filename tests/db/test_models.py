from phoenix.db import models
from sqlalchemy import select


async def test_sqlite_initialization(sqlite_session):
    project = models.Project(name="test_project")
    sqlite_session.add(project)
    await sqlite_session.commit()
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await sqlite_session.execute(statement)).scalars().first()
    assert result is not None


async def test_psql_initialization(postgresql_session):
    project = models.Project(name="test_project")
    postgresql_session.add(project)
    await postgresql_session.commit()
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await postgresql_session.execute(statement)).scalars().first()
    assert result is not None
