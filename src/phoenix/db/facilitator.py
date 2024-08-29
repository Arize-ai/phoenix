from __future__ import annotations

import asyncio
from functools import partial

from sqlalchemy import (
    distinct,
    func,
    insert,
    select,
    update,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.functions import coalesce

from phoenix.auth import compute_password_hash
from phoenix.config import ENABLE_AUTH, PHOENIX_SECRET
from phoenix.db import enums, models
from phoenix.db.enums import ENUM_TABLE_PAIRS
from phoenix.db.session import DbSessionFactory


class Facilitator:
    def __init__(self, db: DbSessionFactory) -> None:
        self._db = db

    async def __call__(self) -> None:
        async with self._db() as session:
            for fn in (
                _ensure_enums,
                _ensure_users,
                *((_ensure_admin_password,) if ENABLE_AUTH else ()),
            ):
                async with session.begin_nested():
                    await fn(session)


async def _ensure_enums(session: AsyncSession) -> None:
    for column, enum in ENUM_TABLE_PAIRS.items():
        table = column.class_
        existing = set([_ async for _ in await session.stream_scalars(select(distinct(column)))])
        expected = set(e.value for e in enum)
        if unknown := existing - expected:
            raise ValueError(f"Unexpected values in {table.name}.{column.key}: {unknown}")
        if not (missing := expected - existing):
            continue
        await session.execute(insert(table), [{column.key: value} for value in missing])


async def _ensure_users(session: AsyncSession) -> None:
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

    if (system_role := enums.UserRole.SYSTEM.value) not in existing_roles and (
        system_role_id := role_ids.get(system_role)
    ) is not None:
        system_user = models.User(
            user_role_id=system_role_id,
            email="system@localhost",
            auth_method="LOCAL",
            reset_password=False,
        )
        session.add(system_user)
    if (admin_role := enums.UserRole.ADMIN.value) not in existing_roles and (
        admin_role_id := role_ids.get(admin_role)
    ) is not None:
        admin_user = models.User(
            user_role_id=admin_role_id,
            username="admin",
            email="admin@localhost",
            auth_method="LOCAL",
            reset_password=True,
        )
        session.add(admin_user)
    await session.flush()


async def _ensure_admin_password(session: AsyncSession) -> None:
    assert PHOENIX_SECRET
    loop = asyncio.get_running_loop()
    compute = partial(compute_password_hash, password=PHOENIX_SECRET, salt=PHOENIX_SECRET)
    hash_ = await loop.run_in_executor(None, compute)
    password_hash = coalesce(models.User.password_hash, hash_)
    first_admin = (
        select(func.min(models.User.id))
        .join(models.UserRole)
        .where(models.UserRole.name == enums.UserRole.ADMIN.value)
        .scalar_subquery()
    )
    stmt = (
        update(models.User).where(models.User.id == first_admin).values(password_hash=password_hash)
    )
    await session.execute(stmt)
