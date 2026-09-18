"""Verify ID non-reuse at head and across historical migration boundaries.

Head checks cover the final schema's AUTOINCREMENT behavior. Migration checks
allocate and delete IDs before upgrading or downgrading: preserving the
AUTOINCREMENT declaration alone does not preserve SQLite's saved counter.
"""

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Callable, Literal

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy.ext.asyncio import AsyncEngine

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
)

from . import _down, _run_async, _up


def _create_user_role(connection: sa.Connection) -> int:
    role_id = connection.execute(
        sa.text("INSERT INTO user_roles (name) VALUES ('MEMBER') RETURNING id")
    ).scalar_one()
    assert isinstance(role_id, int)
    return role_id


def _insert_user(connection: sa.Connection, role_id: int) -> int:
    users = sa.Table("users", sa.MetaData(), autoload_with=connection)
    values: dict[str, object] = {
        "user_role_id": role_id,
        "username": token_hex(8),
        "email": f"{token_hex(8)}@example.com",
        "password_hash": b"hash",
        "password_salt": b"salt",
        "reset_password": False,
    }
    if "auth_method" in users.c:
        values["auth_method"] = "LOCAL"
    user_id = connection.execute(users.insert().values(**values).returning(users.c.id)).scalar_one()
    assert isinstance(user_id, int)
    return user_id


def _insert_token(connection: sa.Connection, table_name: str, user_id: int) -> int:
    table = sa.Table(table_name, sa.MetaData(), autoload_with=connection)
    values: dict[str, object] = {
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    if table_name == "api_keys":
        values["name"] = token_hex(8)
    elif table_name == "access_tokens":
        values["refresh_token_id"] = _insert_token(connection, "refresh_tokens", user_id)
    token_id = connection.execute(
        table.insert().values(**values).returning(table.c.id)
    ).scalar_one()
    assert isinstance(token_id, int)
    return token_id


def _assert_autoincrement_preserved(
    connection: sa.Connection,
    table_name: str,
    insert: Callable[[], int],
    previous_id: int = 0,
) -> None:
    table = sa.Table(table_name, sa.MetaData(), autoload_with=connection)
    new_id = insert()
    assert new_id > previous_id, f"{table_name}: {new_id=} must exceed {previous_id=}"
    connection.execute(table.delete().where(table.c.id == new_id))
    next_id = insert()
    assert next_id > new_id, f"{table_name}: {next_id=} must exceed deleted {new_id=}"


@pytest.mark.parametrize(
    "table_name",
    ["users", "password_reset_tokens", "refresh_tokens", "access_tokens", "api_keys"],
)
async def test_auth_tables_autoincrement_at_head(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
    table_name: str,
) -> None:
    await _up(_engine, _alembic_config, "head", _schema)

    def verify(connection: sa.Connection) -> None:
        role_id = _create_user_role(connection)
        user_id = _insert_user(connection, role_id) if table_name != "users" else 0
        _assert_autoincrement_preserved(
            connection,
            table_name,
            lambda: (
                _insert_user(connection, role_id)
                if table_name == "users"
                else _insert_token(connection, table_name, user_id)
            ),
        )
        connection.commit()

    await _run_async(_engine, verify)


async def test_prompt_versions_autoincrement_at_head(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, "head", _schema)

    def verify(connection: sa.Connection) -> None:
        prompt_id = connection.execute(
            sa.insert(models.Prompt)
            .values(name=Identifier.model_validate(token_hex(16)), metadata_={})
            .returning(models.Prompt.id)
        ).scalar_one()

        def insert() -> int:
            version_id = connection.execute(
                sa.insert(models.PromptVersion)
                .values(
                    prompt_id=prompt_id,
                    template=PromptChatTemplate(type="chat", messages=[]),
                    template_type="CHAT",
                    template_format="MUSTACHE",
                    model_provider=ModelProvider.OPENAI,
                    model_name=token_hex(16),
                    metadata_={},
                    invocation_parameters=PromptOpenAIInvocationParameters(
                        type="openai",
                        openai=PromptOpenAIInvocationParametersContent(temperature=0.5),
                    ),
                )
                .returning(models.PromptVersion.id)
            ).scalar_one()
            assert isinstance(version_id, int)
            return version_id

        _assert_autoincrement_preserved(connection, "prompt_versions", insert)
        connection.commit()

    await _run_async(_engine, verify)


@pytest.mark.parametrize(
    "revision,down_revision,table_name",
    [
        ("6a88424799fe", "8a3764fe7f1a", "users"),
        ("a1b2c3d4e5f6", "3f53d82a1b7e", "users"),
        ("132d988c5bef", "eaf1907ae453", "refresh_tokens"),
        ("132d988c5bef", "eaf1907ae453", "access_tokens"),
        ("132d988c5bef", "eaf1907ae453", "api_keys"),
    ],
)
@pytest.mark.parametrize("direction", ["upgrade", "downgrade"])
@pytest.mark.parametrize("rows", ["unused", "deleted_highest", "deleted_all"])
async def test_autoincrement_across_migration(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
    revision: str,
    down_revision: str,
    table_name: str,
    direction: Literal["upgrade", "downgrade"],
    rows: Literal["unused", "deleted_highest", "deleted_all"],
) -> None:
    await _up(
        _engine,
        _alembic_config,
        down_revision if direction == "upgrade" else revision,
        _schema,
    )

    def seed(connection: sa.Connection) -> tuple[int, int, int, list[int]]:
        role_id = _create_user_role(connection)
        user_id = _insert_user(connection, role_id) if table_name != "users" else 0
        previous_id = 0
        surviving_ids = []
        if rows != "unused":
            for _ in range(3):
                previous_id = (
                    _insert_user(connection, role_id)
                    if table_name == "users"
                    else _insert_token(connection, table_name, user_id)
                )
                surviving_ids.append(previous_id)
            table = sa.Table(table_name, sa.MetaData(), autoload_with=connection)
            if rows == "deleted_all":
                connection.execute(table.delete())
                surviving_ids.clear()
            else:
                connection.execute(table.delete().where(table.c.id == previous_id))
                surviving_ids.pop()
        connection.commit()
        return role_id, user_id, previous_id, surviving_ids

    role_id, user_id, previous_id, surviving_ids = await _run_async(_engine, seed)
    if direction == "upgrade":
        await _up(_engine, _alembic_config, revision, _schema)
    else:
        await _down(_engine, _alembic_config, down_revision, _schema)

    def verify(connection: sa.Connection) -> None:
        table = sa.Table(table_name, sa.MetaData(), autoload_with=connection)
        assert list(connection.scalars(sa.select(table.c.id).order_by(table.c.id))) == surviving_ids
        _assert_autoincrement_preserved(
            connection,
            table_name,
            lambda: (
                _insert_user(connection, role_id)
                if table_name == "users"
                else _insert_token(connection, table_name, user_id)
            ),
            previous_id,
        )
        connection.commit()

    await _run_async(_engine, verify)
