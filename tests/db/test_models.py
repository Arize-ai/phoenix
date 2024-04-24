import pytest
from phoenix.db import models
from sqlalchemy import select


@pytest.mark.parametrize("session", ["sqlite", "postgres"], indirect=["session"])
async def test_projects(session):
    project = models.Project(name="test_project")
    session.add(project)
    await session.commit()
    statement = select(models.Project).where(models.Project.name == "test_project")
    result = (await session.execute(statement)).scalars().first()
    assert result is not None
