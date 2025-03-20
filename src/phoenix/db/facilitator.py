from __future__ import annotations

import asyncio
import secrets
from functools import partial

from sqlalchemy import (
    distinct,
    insert,
    select,
)
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.auth import (
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_USERNAME,
    DEFAULT_SECRET_LENGTH,
    DEFAULT_SYSTEM_EMAIL,
    DEFAULT_SYSTEM_USERNAME,
    compute_password_hash,
)
from phoenix.config import (
    get_env_admins,
    get_env_default_admin_initial_password,
)
from phoenix.db import models
from phoenix.db.enums import COLUMN_ENUMS, UserRole
from phoenix.server.types import DbSessionFactory


class Facilitator:
    """
    Facilitates the creation of database records necessary for Phoenix to function. This includes
    ensuring that all enum values are present in their respective tables, ensuring that all user
    roles are present, and ensuring that the admin user has a password hash. These tasks will be
    carried out as callbacks at the very beginning of Starlette's lifespan process.
    """

    def __init__(self, *, db: DbSessionFactory) -> None:
        self._db = db

    async def __call__(self) -> None:
        for fn in (
            _ensure_enums,
            _ensure_user_roles,
            _ensure_admins,
        ):
            async with self._db() as session:
                await fn(session)


async def _ensure_enums(session: AsyncSession) -> None:
    """
    Ensure that all enum values are present in their respective tables. If any values are missing,
    they will be added. If any values are present in the database but not in the enum, an error will
    be raised. This function is idempotent: it will not add duplicate values to the database.
    """
    for column, enum in COLUMN_ENUMS.items():
        table = column.class_
        existing = set([_ async for _ in await session.stream_scalars(select(distinct(column)))])
        expected = set(e.value for e in enum)
        if unexpected := existing - expected:
            raise ValueError(f"Unexpected values in {table.name}.{column.key}: {unexpected}")
        if not (missing := expected - existing):
            continue
        await session.execute(insert(table), [{column.key: v} for v in missing])


async def _ensure_user_roles(session: AsyncSession) -> None:
    """
    Ensure that the system and admin roles are present in the database. If they are not, they will
    be added. The system user will have the email "system@localhost" and the admin user will have
    the email "admin@localhost".
    """
    role_ids = {
        name: id_
        async for name, id_ in await session.stream(
            select(models.UserRole.name, models.UserRole.id)
        )
    }
    existing_roles = [
        name
        async for name in await session.stream_scalars(
            select(distinct(models.UserRole.name)).join_from(models.User, models.UserRole)
        )
    ]
    if (system_role := UserRole.SYSTEM.value) not in existing_roles and (
        system_role_id := role_ids.get(system_role)
    ) is not None:
        system_user = models.User(
            user_role_id=system_role_id,
            username=DEFAULT_SYSTEM_USERNAME,
            email=DEFAULT_SYSTEM_EMAIL,
            reset_password=False,
            password_salt=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
            password_hash=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
        )
        session.add(system_user)
    if (admin_role := UserRole.ADMIN.value) not in existing_roles and (
        admin_role_id := role_ids.get(admin_role)
    ) is not None:
        salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
        password = get_env_default_admin_initial_password()
        compute = partial(compute_password_hash, password=password, salt=salt)
        loop = asyncio.get_running_loop()
        hash_ = await loop.run_in_executor(None, compute)
        admin_user = models.User(
            user_role_id=admin_role_id,
            username=DEFAULT_ADMIN_USERNAME,
            email=DEFAULT_ADMIN_EMAIL,
            password_salt=salt,
            password_hash=hash_,
            reset_password=True,
        )
        session.add(admin_user)
    await session.flush()


async def _ensure_admins(session: AsyncSession) -> None:
    """
    Ensure that all startup admin users are present in the database. If any are missing, they will
    be added. Existing records will not be modified.
    """
    if not (admins := get_env_admins()):
        return
    existing_emails = set(
        await session.scalars(select(models.User.email).where(models.User.email.in_(admins.keys())))
    )
    admins = {email: username for email, username in admins.items() if email not in existing_emails}
    if not admins:
        return
    existing_usernames = set(
        await session.scalars(
            select(models.User.username).where(models.User.username.in_(admins.values()))
        )
    )
    admins = {
        email: username for email, username in admins.items() if username not in existing_usernames
    }
    if not admins:
        return
    admin_role_id = await session.scalar(
        select(models.UserRole.id).filter_by(name=UserRole.ADMIN.value)
    )
    assert admin_role_id is not None, "Admin role not found in database"
    for email, username in admins.items():
        values = dict(
            user_role_id=admin_role_id,
            username=username,
            email=email,
            password_salt=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
            password_hash=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
            reset_password=True,
        )
        await session.execute(insert(models.User).values(values))
