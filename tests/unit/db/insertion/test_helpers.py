from asyncio import sleep

import pytest
from sqlalchemy import insert, select

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.types import DbSessionFactory


class Test_insert_on_conflict:
    @pytest.mark.parametrize(
        "on_conflict",
        [
            pytest.param(
                OnConflict.DO_NOTHING,
                id="do-nothing",
            ),
            pytest.param(
                OnConflict.DO_UPDATE,
                id="update",
            ),
        ],
    )
    async def test_inserts_new_tuple_when_no_conflict_is_present(
        self,
        on_conflict: OnConflict,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            values = dict(
                name="name",
                description="description",
            )
            await session.execute(
                insert_on_conflict(
                    values,
                    dialect=dialect,
                    table=models.Project,
                    unique_by=("name",),
                    on_conflict=on_conflict,
                )
            )
        projects = (await session.scalars(select(models.Project))).all()
        assert len(projects) == 1
        assert projects[0].name == "name"
        assert projects[0].description == "description"

    @pytest.mark.parametrize(
        "on_conflict",
        [
            pytest.param(
                OnConflict.DO_NOTHING,
                id="do-nothing",
            ),
            pytest.param(
                OnConflict.DO_UPDATE,
                id="do-update",
            ),
        ],
    )
    async def test_handles_conflicts_in_expected_manner(
        self,
        on_conflict: OnConflict,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project_id = await session.scalar(
                insert(models.Project)
                .values(dict(name="abc", description="initial description"))
                .returning(models.Project.id)
            )
            project_record = await session.scalar(
                select(models.Project).where(models.Project.id == project_id)
            )
        assert project_record is not None

        async with db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            new_values = dict(name="abc", description="updated description")
            await sleep(1)
            await session.execute(
                insert_on_conflict(
                    new_values,
                    dialect=dialect,
                    table=models.Project,
                    unique_by=("name",),
                    on_conflict=on_conflict,
                )
            )
            updated_project = await session.scalar(
                select(models.Project).where(models.Project.id == project_id)
            )
        assert updated_project is not None

        if on_conflict is OnConflict.DO_NOTHING:
            assert updated_project.description == "initial description"
            assert updated_project.updated_at == project_record.updated_at
        else:
            assert updated_project.description == "updated description"
            assert updated_project.updated_at > project_record.updated_at
