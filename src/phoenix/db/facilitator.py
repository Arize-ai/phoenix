from __future__ import annotations

import asyncio
import logging
import secrets
from asyncio import gather
from functools import partial
from typing import Optional

import sqlalchemy as sa

from phoenix import config
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
    get_env_disable_basic_auth,
)
from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.enums import ENUM_COLUMNS
from phoenix.db.models import UserRoleName
from phoenix.db.types.trace_retention import (
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.email.types import WelcomeEmailSender
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)


class Facilitator:
    """
    Facilitates the creation of database records necessary for Phoenix to function. This includes
    ensuring that all enum values are present in their respective tables, ensuring that all user
    roles are present, and ensuring that the admin user has a password hash. These tasks will be
    carried out as callbacks at the very beginning of Starlette's lifespan process.
    """

    def __init__(
        self,
        *,
        db: DbSessionFactory,
        email_sender: Optional[WelcomeEmailSender] = None,
    ) -> None:
        self._db = db
        self._email_sender = email_sender

    async def __call__(self) -> None:
        for fn in (
            _ensure_enums,
            _ensure_user_roles,
            _get_system_user_id,
            partial(_ensure_admins, email_sender=self._email_sender),
            _ensure_default_project_trace_retention_policy,
        ):
            await fn(self._db)


async def _ensure_enums(db: DbSessionFactory) -> None:
    """
    Ensure that all enum values are present in their respective tables. If any values are missing,
    they will be added. If any values are present in the database but not in the enum, an error will
    be raised. This function is idempotent: it will not add duplicate values to the database.
    """
    for column in ENUM_COLUMNS:
        table = column.class_
        assert isinstance(column.type, sa.Enum)
        async with db() as session:
            existing = set(await session.scalars(sa.select(column)))
            expected = set(column.type.enums)
            if unexpected := existing - expected:
                raise ValueError(f"Unexpected values in {table.name}.{column.key}: {unexpected}")
            if not (missing := expected - existing):
                continue
            await session.execute(sa.insert(table), [{column.key: v} for v in missing])


async def _ensure_user_roles(db: DbSessionFactory) -> None:
    """
    Ensure that the system and admin roles are present in the database. If they are not, they will
    be added. The system user will have the email "system@localhost" and the admin user will have
    the email "admin@localhost".
    """
    async with db() as session:
        role_ids: dict[UserRoleName, int] = {
            name: id_
            async for name, id_ in await session.stream(
                sa.select(models.UserRole.name, models.UserRole.id)
            )
        }
        existing_roles: list[UserRoleName] = [
            name
            async for name in await session.stream_scalars(
                sa.select(sa.distinct(models.UserRole.name)).join_from(models.User, models.UserRole)
            )
        ]
        if (
            "SYSTEM" not in existing_roles
            and (system_role_id := role_ids.get("SYSTEM")) is not None
        ):
            system_user = models.LocalUser(
                user_role_id=system_role_id,
                username=DEFAULT_SYSTEM_USERNAME,
                email=DEFAULT_SYSTEM_EMAIL,
                reset_password=False,
                password_salt=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
                password_hash=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
            )
            session.add(system_user)
        if "ADMIN" not in existing_roles and (admin_role_id := role_ids.get("ADMIN")) is not None:
            salt = secrets.token_bytes(DEFAULT_SECRET_LENGTH)
            password = get_env_default_admin_initial_password()
            compute = partial(compute_password_hash, password=password, salt=salt)
            loop = asyncio.get_running_loop()
            hash_ = await loop.run_in_executor(None, compute)
            admin_user = models.LocalUser(
                user_role_id=admin_role_id,
                username=DEFAULT_ADMIN_USERNAME,
                email=DEFAULT_ADMIN_EMAIL,
                password_salt=salt,
                password_hash=hash_,
                reset_password=True,
            )
            session.add(admin_user)
        await session.flush()


async def _get_system_user_id(db: DbSessionFactory) -> None:
    """
    Set the system user ID in the config. This is used to identify the system user in the database.
    """
    async with db() as session:
        system_user_id = await session.scalar(
            sa.select(models.User.id)
            .join(models.UserRole)
            .where(models.UserRole.name == "SYSTEM")
            .order_by(models.User.id)
            .limit(1)
        )
    if system_user_id is None:
        raise ValueError("System user not found in database")
    config.SYSTEM_USER_ID = system_user_id


async def _ensure_admins(
    db: DbSessionFactory,
    *,
    email_sender: Optional[WelcomeEmailSender] = None,
) -> None:
    """
    Ensure that all startup admin users are present in the database. If any are missing, they will
    be added. Existing records will not be modified.
    """
    if not (admins := get_env_admins()):
        return
    disable_basic_auth = get_env_disable_basic_auth()
    async with db() as session:
        existing_emails = set(
            await session.scalars(
                sa.select(models.User.email).where(models.User.email.in_(admins.keys()))
            )
        )
        admins = {
            email: username for email, username in admins.items() if email not in existing_emails
        }
        if not admins:
            return
        existing_usernames = set(
            await session.scalars(
                sa.select(models.User.username).where(models.User.username.in_(admins.values()))
            )
        )
        admins = {
            email: username
            for email, username in admins.items()
            if username not in existing_usernames
        }
        if not admins:
            return
        admin_role_id = await session.scalar(sa.select(models.UserRole.id).filter_by(name="ADMIN"))
        assert admin_role_id is not None, "Admin role not found in database"
        user: models.User
        for email, username in admins.items():
            if not disable_basic_auth:
                user = models.LocalUser(
                    email=email,
                    username=username,
                    password_salt=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
                    password_hash=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
                )
            else:
                user = models.OAuth2User(
                    email=email,
                    username=username,
                )
            user.user_role_id = admin_role_id
            session.add(user)
        await session.flush()
    if email_sender is None:
        return
    for exc in await gather(
        *(email_sender.send_welcome_email(email, username) for email, username in admins.items()),
        return_exceptions=True,
    ):
        if isinstance(exc, Exception):
            logger.error(f"Failed to send welcome email: {exc}")


async def _ensure_default_project_trace_retention_policy(db: DbSessionFactory) -> None:
    """
    Ensures the default trace retention policy (id=1) exists in the database. Default policy
    applies to all projects without a specific policy (i.e. foreign key is null).

    This function checks for the presence of the default trace retention policy and
    creates it if missing. The default trace retention policy:

        - Has ID=0
        - Is named "Default"
        - Runs every Sunday at midnight UTC (cron: "0 0 * * 0")
        - Retains traces indefinitely

    If the default policy already exists, this function makes no changes.

    Args:
        db (DbSessionFactory): An async SQLAlchemy session factory.

    Returns:
        None
    """
    assert DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID == 0
    async with db() as session:
        if await session.scalar(
            sa.select(
                sa.exists().where(
                    models.ProjectTraceRetentionPolicy.id
                    == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
                )
            )
        ):
            return
        cron_expression = TraceRetentionCronExpression(root="0 0 * * 0")
        rule = TraceRetentionRule(root=MaxDaysRule(max_days=0))
        await session.execute(
            sa.insert(models.ProjectTraceRetentionPolicy),
            [
                {
                    "id": DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                    "name": "Default",
                    "cron_expression": cron_expression,
                    "rule": rule,
                }
            ],
        )
