import contextlib
from typing import AsyncContextManager, AsyncGenerator, AsyncIterator, Callable

import pytest
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
)


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
    async def test_inserts_new_tuple_when_no_conflict_is_present(self, on_conflict, session):
        dialect = SupportedSQLDialect(session.bind.dialect.name)
        values = dict(
            name="name",
            description="description",
        )
        await session.execute(
            insert_on_conflict(
                dialect=dialect,
                table=models.Project,
                values=values,
                constraint="uq_projects_name",
                column_names=("name",),
                on_conflict=on_conflict,
                set_=values,
            )
        )
        projects = (await session.scalars(select(models.Project))).all()
        assert len(projects) == 1
        assert projects[0].name == "name"
        assert projects[0].description == "description"

    @pytest.mark.parametrize(
        "on_conflict, expected_description",
        [
            pytest.param(
                OnConflict.DO_NOTHING,
                "original-description",
                id="do-nothing",
            ),
            pytest.param(
                OnConflict.DO_UPDATE,
                "updated-description",
                id="update",
            ),
        ],
    )
    async def test_handles_conflicts_in_expected_manner(
        self,
        on_conflict,
        expected_description,
        prod_db,  # the insert_on_conflict function is sensitive to the way the DB is set up
    ):
        async with prod_db() as session:
            await session.execute(
                insert(models.Project).values(dict(name="name", description="original-description"))
            )
            projects = (await session.scalars(select(models.Project))).all()
            assert len(projects) == 1
            assert projects[0].name == "name"
            assert projects[0].description == "original-description"

        async with prod_db() as session:
            dialect = SupportedSQLDialect(session.bind.dialect.name)
            values = dict(
                name="name",
                description="updated-description",
            )
            await session.execute(
                insert_on_conflict(
                    dialect=dialect,
                    table=models.Project,
                    values=values,
                    constraint="uq_projects_name",
                    column_names=("name",),
                    on_conflict=on_conflict,
                    set_=values,
                )
            )

            projects = (await session.scalars(select(models.Project))).all()
            assert len(projects) == 1
            assert projects[0].name == "name"
            assert projects[0].description == expected_description


@pytest.fixture
def prod_db(request, dialect) -> async_sessionmaker:
    """
    Instantiates DB in a manner similar to production.
    """
    if dialect == "sqlite":
        return request.getfixturevalue("prod_sqlite_db")
    elif dialect == "postgresql":
        return request.getfixturevalue("prod_postgres_db")
    raise ValueError(f"Unknown db fixture: {dialect}")


@pytest.fixture
async def prod_sqlite_db(
    sqlite_engine: AsyncEngine,
) -> AsyncGenerator[Callable[[], AsyncContextManager[AsyncSession]], None]:
    """
    Instantiates SQLite in a manner similar to production.
    """
    Session = async_sessionmaker(sqlite_engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with Session.begin() as session:
            yield session

    return factory


@pytest.fixture
async def prod_postgres_db(
    postgres_engine: AsyncEngine,
) -> AsyncGenerator[Callable[[], AsyncContextManager[AsyncSession]], None]:
    """
    Instantiates Postgres in a manner similar to production.
    """
    Session = async_sessionmaker(postgres_engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with Session.begin() as session:
            yield session

    return factory
