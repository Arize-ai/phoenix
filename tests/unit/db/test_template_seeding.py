"""The unit conftest seeds each worker's template database with the app's startup rows."""

import sqlalchemy as sa
from sqlalchemy import select

from phoenix.auth import DEFAULT_SYSTEM_EMAIL
from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def _count(db: DbSessionFactory, table: type[models.Base]) -> int:
    async with db() as session:
        count = await session.scalar(select(sa.func.count()).select_from(table))
    return int(count or 0)


async def test_template_database_carries_the_apps_startup_rows(db: DbSessionFactory) -> None:
    """A test that never boots an app still finds the rows the Facilitator
    seeds at startup, because the template every test database comes from
    was seeded once per worker."""
    async with db() as session:
        role_names = set((await session.scalars(select(models.UserRole.name))).all())
        system_user = await session.scalar(
            select(models.User).where(models.User.email == DEFAULT_SYSTEM_EMAIL)
        )
    assert {"SYSTEM", "ADMIN"} <= role_names
    assert system_user is not None
    assert await _count(db, models.BuiltinEvaluator) > 0
    assert await _count(db, models.SandboxProvider) > 0


async def test_template_database_leaves_model_costs_to_the_per_test_opt_in(
    db: DbSessionFactory,
) -> None:
    """The model cost manifest is the one startup step the seeding skips: the
    suite stubs it per app, and only tests marked ``seeded_model_costs`` get
    the built-in models."""
    async with db() as session:
        built_in = await session.scalar(
            select(sa.func.count())
            .select_from(models.GenerativeModel)
            .where(models.GenerativeModel.is_built_in.is_(True))
        )
    assert int(built_in or 0) == 0
