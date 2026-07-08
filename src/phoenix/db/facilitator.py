from __future__ import annotations

import asyncio
import json
import logging
import re
import secrets
from asyncio import gather
from datetime import datetime, timedelta, timezone
from functools import partial
from pathlib import Path
from typing import Any, Mapping, NamedTuple, Optional, Sequence, Union

import sqlalchemy as sa
from sqlalchemy import Executable, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, joinedload
from sqlalchemy.sql.dml import ReturningDelete

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
    ENV_PHOENIX_ENABLE_AUTH,
    LDAPConfig,
    get_env_access_control_enabled,
    get_env_admins,
    get_env_default_admin_initial_password,
    get_env_default_retention_policy_days,
    get_env_disable_basic_auth,
    get_env_enable_auth,
    get_env_oauth2_settings,
)
from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.enums import ENUM_COLUMNS
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.trace_retention import (
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.access import (
    ACCESS_CONTROL_ENABLED_KEY,
    BUILTIN_PERMISSION_SETS,
    BUILTIN_ROLE_PERMISSIONS,
)
from phoenix.server.email.types import WelcomeEmailSender
from phoenix.server.types import DbSessionFactory

logger = logging.getLogger(__name__)

USER_FEEDBACK_ANNOTATION_NAME = "user_feedback"


def _insert_on_conflict_do_nothing(
    session: AsyncSession,
    table: type[models.Base],
    values: Sequence[Mapping[str, Any]],
    unique_columns: Sequence[str],
) -> Executable:
    bind = session.bind
    if bind is None:
        raise RuntimeError("Session has no bound engine; cannot determine SQL dialect.")
    dialect_name = bind.dialect.name
    if dialect_name == "postgresql":
        return (
            pg_insert(table)
            .values(list(values))
            .on_conflict_do_nothing(index_elements=list(unique_columns))
        )
    if dialect_name == "sqlite":
        return (
            sqlite_insert(table)
            .values(list(values))
            .on_conflict_do_nothing(index_elements=list(unique_columns))
        )
    raise ValueError(f"Unsupported SQL dialect for facilitator sync: {dialect_name}")


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
            _ensure_role_permissions,
            _ensure_permission_sets,
            _ensure_access_control_latch,
            _get_system_user_id,
            partial(_ensure_admins, email_sender=self._email_sender),
            _ensure_default_project_trace_retention_policy,
            _ensure_model_costs,
            _ensure_builtin_evaluators,
            _ensure_user_feedback_annotation_config,
            _ensure_sandbox_providers,
            _delete_expired_childless_records,
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
        role_ids: dict[models.UserRoleName, int] = {
            name: id_
            async for name, id_ in await session.stream(
                sa.select(models.UserRole.name, models.UserRole.id)
            )
        }
        existing_roles: list[models.UserRoleName] = [
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


async def _ensure_role_permissions(db: DbSessionFactory) -> None:
    """
    Ensure every built-in role's permission rows match its bundle in
    phoenix.server.access. Idempotent: missing rows are inserted and stray rows
    on built-in roles are removed, so the database is the persisted form of the
    constant. Runs on every boot, so an upgraded database gains the rows without
    a data migration and every user keeps exactly the access they had.
    """
    async with db() as session:
        role_ids: dict[str, int] = {
            name: id_
            async for name, id_ in await session.stream(
                sa.select(models.UserRole.name, models.UserRole.id)
            )
        }
        existing: set[tuple[int, str]] = {
            (role_id, permission)
            async for role_id, permission in await session.stream(
                sa.select(
                    models.RolePermission.user_role_id,
                    models.RolePermission.permission,
                )
            )
        }
        to_insert: list[dict[str, Union[int, str]]] = []
        for role_name, permissions in BUILTIN_ROLE_PERMISSIONS.items():
            if (role_id := role_ids.get(role_name)) is None:
                continue
            desired = {permission.value for permission in permissions}
            current = {permission for rid, permission in existing if rid == role_id}
            for permission in desired - current:
                to_insert.append({"user_role_id": role_id, "permission": permission})
            if stray := current - desired:
                await session.execute(
                    sa.delete(models.RolePermission).where(
                        models.RolePermission.user_role_id == role_id,
                        models.RolePermission.permission.in_(stray),
                    )
                )
        if to_insert:
            await session.execute(
                _insert_on_conflict_do_nothing(
                    session,
                    models.RolePermission,
                    to_insert,
                    unique_columns=["user_role_id", "permission"],
                )
            )


async def _ensure_permission_sets(db: DbSessionFactory) -> None:
    """
    Ensure the built-in permission sets (Resource Viewer/Editor/Manager) and their
    permissions exist and match their bundles. Idempotent and drift-repairing,
    like the global role seeding. Custom permission sets live alongside and are left
    untouched.
    """
    async with db() as session:
        await session.execute(
            _insert_on_conflict_do_nothing(
                session,
                models.PermissionSet,
                [{"name": role_name, "is_built_in": True} for role_name in BUILTIN_PERMISSION_SETS],
                unique_columns=["name"],
            )
        )
        role_ids: dict[str, int] = {
            name: id_
            async for name, id_ in await session.stream(
                sa.select(models.PermissionSet.name, models.PermissionSet.id)
            )
        }
        existing: set[tuple[int, str]] = {
            (role_id, permission)
            async for role_id, permission in await session.stream(
                sa.select(
                    models.PermissionSetItem.permission_set_id,
                    models.PermissionSetItem.permission,
                )
            )
        }
        to_insert: list[dict[str, Union[int, str]]] = []
        for role_name, permissions in BUILTIN_PERMISSION_SETS.items():
            if (role_id := role_ids.get(role_name)) is None:
                raise RuntimeError(f"Missing built-in permission set: {role_name}")
            desired = {permission.value for permission in permissions}
            current = {permission for rid, permission in existing if rid == role_id}
            for permission in desired - current:
                to_insert.append({"permission_set_id": role_id, "permission": permission})
            if stray := current - desired:
                await session.execute(
                    sa.delete(models.PermissionSetItem).where(
                        models.PermissionSetItem.permission_set_id == role_id,
                        models.PermissionSetItem.permission.in_(stray),
                    )
                )
        if to_insert:
            await session.execute(
                _insert_on_conflict_do_nothing(
                    session,
                    models.PermissionSetItem,
                    to_insert,
                    unique_columns=["permission_set_id", "permission"],
                )
            )


async def _ensure_access_control_latch(db: DbSessionFactory) -> None:
    """Bootstrap and guard the access-control activation latch at startup.

    ``PHOENIX_ACCESS_CONTROL_ENABLED`` is a *one-way switch*. When set, it turns
    the DB-latched ``access_control.enabled`` setting on — but only if the latch
    has never been set, so it can only ever *enable*, never disable, and once the
    latch row exists the env var stops bootstrapping. The running app exposes no
    runtime enable/disable path; changing the latch is an operator action that
    takes effect on a subsequent startup.

    Drift guard: if the env switch is *falsey* while access control is **on**, the
    deployment has lost its declared switch (config drift, a dropped var). Rather
    than run in that inconsistent state, refuse to start and make the operator
    re-assert the switch. Disabling access control is not an in-process operation;
    the latch must be changed out of band before startup.

    Authentication guard: access control presupposes authentication. Every access
    decision is keyed on an authenticated user identity; with auth off there is no
    such identity, so enforcement degrades to allow-all — a silent no-op that looks
    like it is enforcing but is not. Refuse to start with access control on and auth
    off rather than offer that false assurance. Idempotent.
    """
    env_enabled = get_env_access_control_enabled()
    auth_enabled = get_env_enable_auth()
    async with db() as session:
        value = await session.scalar(
            sa.select(models.SystemSetting.value).where(
                models.SystemSetting.key == ACCESS_CONTROL_ENABLED_KEY
            )
        )
        latched_on = isinstance(value, dict) and bool(value.get("enabled", False))
        bootstrapping_on = value is None and env_enabled
        if (latched_on or bootstrapping_on) and not auth_enabled:
            raise RuntimeError(
                "Access control is enabled but authentication is not "
                f"({ENV_PHOENIX_ENABLE_AUTH} is falsey). Access decisions require an "
                "authenticated user; with authentication off, enforcement silently allows "
                "everything. Enable authentication, or disable access control."
            )
        if env_enabled and value is None:
            await session.execute(
                _insert_on_conflict_do_nothing(
                    session,
                    models.SystemSetting,
                    [{"key": ACCESS_CONTROL_ENABLED_KEY, "value": {"enabled": True}}],
                    unique_columns=["key"],
                )
            )
        elif latched_on and not env_enabled:
            raise RuntimeError(
                "PHOENIX_ACCESS_CONTROL_ENABLED is falsey but access control is enabled "
                "(the access_control.enabled latch is on). Refusing to start in this "
                "inconsistent state. Set PHOENIX_ACCESS_CONTROL_ENABLED to re-assert the "
                "switch, or change the latch out of band before startup."
            )


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


async def _ensure_user_feedback_annotation_config(db: DbSessionFactory) -> None:
    """
    Ensure the app-owned user feedback annotation config exists.

    Existing configs named "user_feedback" are left unchanged so startup is idempotent and
    does not overwrite user data if a deployment already has a config with that name.
    """
    async with db() as session:
        await session.execute(
            _insert_on_conflict_do_nothing(
                session,
                models.AnnotationConfig,
                [
                    {
                        "name": USER_FEEDBACK_ANNOTATION_NAME,
                        "config": CategoricalAnnotationConfig(
                            type=AnnotationType.CATEGORICAL.value,
                            description="User feedback labels for traces.",
                            optimization_direction=OptimizationDirection.MAXIMIZE,
                            values=[
                                CategoricalAnnotationValue(label="positive", score=1.0),
                                CategoricalAnnotationValue(label="negative", score=0.0),
                            ],
                        ),
                    }
                ],
                unique_columns=["name"],
            )
        )


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

        # Determine which auth method to use for admin users
        # Priority: LOCAL (if enabled) > LDAP (if configured and no OAuth2) > OAuth2
        # Use try/except to handle invalid configurations gracefully
        try:
            ldap_config = LDAPConfig.from_env()
        except Exception:
            ldap_config = None
        try:
            oauth2_configs = get_env_oauth2_settings()
        except Exception:
            oauth2_configs = []
        use_ldap = disable_basic_auth and ldap_config is not None and not oauth2_configs

        user: models.User
        for email, username in admins.items():
            if not disable_basic_auth:
                user = models.LocalUser(
                    email=email,
                    username=username,
                    password_salt=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
                    password_hash=secrets.token_bytes(DEFAULT_SECRET_LENGTH),
                )
            elif use_ldap:
                user = models.LDAPUser(
                    email=email,
                    username=username,
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


_CHILDLESS_RECORD_DELETION_GRACE_PERIOD_DAYS = 1


def _stmt_to_delete_expired_childless_records(
    table: type[models.HasId],
    foreign_key: Union[InstrumentedAttribute[int], InstrumentedAttribute[Optional[int]]],
) -> ReturningDelete[tuple[int]]:
    """
    Creates a SQLAlchemy DELETE statement to permanently remove childless records.

    Args:
        table: The table model class that has a deleted_at column
        foreign_key: The foreign key attribute to check for child relationships

    Returns:
        A DELETE statement that removes childless records marked for deletion more than
        _CHILDLESS_RECORD_DELETION_GRACE_PERIOD_DAYS days ago
    """  # noqa: E501
    if not hasattr(table, "deleted_at"):
        raise TypeError("Table must have a 'deleted_at' column")
    cutoff_time = datetime.now(timezone.utc) - timedelta(
        days=_CHILDLESS_RECORD_DELETION_GRACE_PERIOD_DAYS
    )
    return (
        sa.delete(table)
        .where(table.deleted_at.isnot(None))
        .where(table.deleted_at < cutoff_time)
        .where(~sa.exists().where(table.id == foreign_key))
        .returning(table.id)
    )


async def _delete_expired_childless_records_on_generative_models(
    db: DbSessionFactory,
) -> None:
    """
    Permanently deletes childless GenerativeModel records that have been marked for deletion.

    This function removes GenerativeModel records that:
    - Have been marked for deletion (deleted_at is not NULL)
    - Were marked more than 1 day ago (grace period expired)
    - Have no associated SpanCost records (childless)

    This cleanup is necessary to remove orphaned records that may have been left behind
    due to previous migrations or deletions.
    """  # noqa: E501
    stmt = _stmt_to_delete_expired_childless_records(
        models.GenerativeModel,
        models.SpanCost.model_id,
    )
    async with db() as session:
        result = (await session.scalars(stmt)).all()
    if result:
        logger.info(f"Permanently deleted {len(result)} expired childless GenerativeModel records")
    else:
        logger.debug("No expired childless GenerativeModel records found for permanent deletion")


async def _delete_expired_childless_records(
    db: DbSessionFactory,
) -> None:
    """
    Permanently deletes childless records across all relevant tables.

    This function runs the deletion process for all table types that support soft deletion,
    handling any exceptions that occur during the process. Only records that have been
    marked for deletion for more than the grace period (1 day) are permanently removed.
    """  # noqa: E501
    exceptions = await gather(
        _delete_expired_childless_records_on_generative_models(db),
        return_exceptions=True,
    )
    for exc in exceptions:
        if isinstance(exc, Exception):
            logger.error(f"Failed to delete childless records: {exc}")


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
        cron_expression = TraceRetentionCronExpression(root="0 0 * * 0")
        rule = TraceRetentionRule(
            root=MaxDaysRule(max_days=get_env_default_retention_policy_days())
        )
        await session.execute(
            _insert_on_conflict_do_nothing(
                session,
                models.ProjectTraceRetentionPolicy,
                [
                    {
                        "id": DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                        "name": "Default",
                        "cron_expression": cron_expression,
                        "rule": rule,
                    }
                ],
                unique_columns=["id"],
            )
        )


_COST_MODEL_MANIFEST: Path = (
    Path(__file__).parent.parent / "server" / "cost_tracking" / "model_cost_manifest.json"
)


class _TokenTypeKey(NamedTuple):
    """
    Composite key for uniquely identifying token price configurations.

    Token prices are differentiated by both their type (e.g., "input", "output", "audio")
    and whether they represent prompt tokens (input to the model) or completion tokens
    (output from the model). Some token types like "audio" can exist in both categories.

    Attributes:
        token_type: The category of token (e.g., "input", "output", "audio", "cache_write")
        is_prompt: True if these are prompt/input tokens, False if completion/output tokens
    """

    token_type: str
    is_prompt: bool


async def _ensure_model_costs(db: DbSessionFactory) -> None:
    """
    Ensures that built-in generative models and their token pricing information are up-to-date
    in the database based on the model cost manifest file.

    This function performs a comprehensive synchronization between the database and the manifest:

    1. **Model Management**: Creates new built-in models from the manifest or updates existing ones
    2. **Token Price Synchronization**: Ensures all token prices match the manifest rates
    3. **Cleanup**: Soft-deletes built-in models no longer present in the manifest

    The function handles different token types including:
    - Input tokens (prompt): Standard input tokens for generation
    - Cache write tokens (prompt): Tokens written to cache systems
    - Cache read tokens (prompt): Tokens read from cache systems
    - Output tokens (non-prompt): Generated response tokens
    - Audio tokens (both prompt and non-prompt): Audio processing tokens

    Token prices are uniquely identified by (token_type, is_prompt) pairs to handle
    cases like audio tokens that can be both prompt and non-prompt.

    Args:
        db (DbSessionFactory): Database session factory for database operations

    Returns:
        None

    Raises:
        FileNotFoundError: If the model cost manifest file is not found
        json.JSONDecodeError: If the manifest file contains invalid JSON
        ValueError: If manifest data is malformed or missing required fields
    """
    # Load the authoritative model cost data from the manifest file
    with open(_COST_MODEL_MANIFEST) as f:
        manifest = json.load(f)

    async with db() as session:
        # Fetch all existing built-in models with their token prices eagerly loaded
        # Using .unique() to deduplicate models when multiple token prices are joined
        built_in_models = {
            omodel.name: omodel
            for omodel in (
                await session.scalars(
                    select(models.GenerativeModel)
                    .where(models.GenerativeModel.deleted_at.is_(None))
                    .where(models.GenerativeModel.is_built_in.is_(True))
                    .options(joinedload(models.GenerativeModel.token_prices))
                )
            ).unique()
        }

        seen_names: set[str] = set()
        seen_patterns: set[tuple[re.Pattern[str], str]] = set()

        for model_data in manifest["models"]:
            name = str(model_data.get("name") or "").strip()
            if not name:
                logger.warning("Skipping model with empty name in manifest")
                continue
            if name in seen_names:
                logger.warning(f"Skipping model '{name}' with duplicate name in manifest")
                continue
            seen_names.add(name)
            regex = str(model_data.get("name_pattern") or "").strip()
            try:
                pattern = re.compile(regex)
            except re.error as e:
                logger.warning(f"Skipping model '{name}' with invalid regex: {e}")
                continue
            provider = str(model_data.get("provider") or "").strip()
            if (pattern, provider) in seen_patterns:
                logger.warning(
                    f"Skipping model '{name}' with duplicate name_pattern/provider combination"
                )
                continue
            seen_patterns.add((pattern, provider))
            # Remove model from built_in_models dict (for cleanup tracking)
            # or create new model if not found
            model = built_in_models.pop(model_data["name"], None)
            is_existing_model = model is not None
            if model is None:
                # Create new built-in model from manifest data
                model = models.GenerativeModel(
                    name=name,
                    provider=provider,
                    name_pattern=pattern,
                    is_built_in=True,
                )
                session.add(model)
            else:
                # Update existing model's metadata from manifest
                model.provider = provider
                model.name_pattern = pattern

            # Create lookup table for existing token prices by (token_type, is_prompt)
            # Using pop() during iteration allows us to track which prices are no longer needed
            existing_token_prices = {
                _TokenTypeKey(token_price.token_type, token_price.is_prompt): token_price
                for token_price in model.token_prices
            }
            token_prices_changed = False

            # Synchronize token prices for all supported token types
            for manifest_token_price in model_data["token_prices"]:
                # Skip if this token type has no rate in the manifest
                if not (base_rate := manifest_token_price.get("base_rate")):
                    continue

                key = _TokenTypeKey(
                    manifest_token_price["token_type"],
                    manifest_token_price["is_prompt"],
                )
                # Remove from tracking dict and get existing price (if any)
                if not (token_price := existing_token_prices.pop(key, None)):
                    # Create new token price if it doesn't exist
                    token_price = models.TokenPrice(
                        token_type=manifest_token_price["token_type"],
                        is_prompt=manifest_token_price["is_prompt"],
                        base_rate=base_rate,
                    )
                    model.token_prices.append(token_price)
                    token_prices_changed = True
                elif token_price.base_rate != base_rate:
                    # Update existing price if rate has changed
                    token_price.base_rate = base_rate
                    token_prices_changed = True

            # Remove any token prices that are no longer in the manifest
            # These are prices that weren't popped from the token_prices dict above
            for token_price in existing_token_prices.values():
                model.token_prices.remove(token_price)
                token_prices_changed = True

            if is_existing_model and token_prices_changed:
                model.updated_at = datetime.now(timezone.utc)

    # Clean up built-in models that are no longer in the manifest
    # These are models that weren't popped from built_in_models dict above
    remaining_models = list(built_in_models.values())
    if not remaining_models:
        return

    # Soft delete obsolete built-in models
    async with db() as session:
        await session.execute(
            sa.update(models.GenerativeModel)
            .values(deleted_at=sa.func.now())
            .where(models.GenerativeModel.id.in_([m.id for m in remaining_models]))
            .where(~sa.exists().where(models.GenerativeModel.id == models.SpanCost.model_id))
        )


async def _ensure_sandbox_providers(db: DbSessionFactory) -> None:
    """Seed sandbox provider rows. Idempotent."""
    from phoenix.server.sandbox import SANDBOX_ADAPTER_METADATA  # noqa: PLC0415
    from phoenix.server.sandbox.sync import (  # noqa: PLC0415
        sync_languages,
        sync_sandbox_default_configs,
        sync_sandbox_providers,
    )

    async with db() as session:
        await sync_languages(session)
        await sync_sandbox_providers(session, SANDBOX_ADAPTER_METADATA)
        await sync_sandbox_default_configs(session, SANDBOX_ADAPTER_METADATA)


async def _ensure_builtin_evaluators(db: DbSessionFactory) -> None:
    """
    Synchronize the in-memory builtin evaluator registry to the database.

    This function ensures the `builtin_evaluators` table stays in sync with
    the in-memory registry. Builtin evaluators are part of the polymorphic
    evaluator hierarchy (inheriting from Evaluator), so we must upsert into
    both the base `evaluators` table and the `builtin_evaluators` subclass table.

    This function:
    1. Upserts all current builtin evaluators into base evaluators table
    2. Upserts corresponding records into builtin_evaluators subclass table
    3. Removes any stale evaluators no longer in the registry

    Safe to call multiple times (idempotent).
    """
    from phoenix.server.api.builtin_evaluator_sync import sync_builtin_evaluators

    await sync_builtin_evaluators(db)
