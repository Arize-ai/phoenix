from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Callable, Literal, NamedTuple, Optional

import pytest
from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from . import _down, _get_table_schema_info, _run_async, _TableSchemaInfo, _up

_DOWN = "ef09e3bc213f"
_UP = "52e79887a7e3"

_TABLES = ("api_keys", "password_reset_tokens")
_INTEGRITY_ERRORS = (SQLAlchemyIntegrityError, SQLiteIntegrityError)

_Check = Callable[[Connection], None]


class _Seed(NamedTuple):
    users: tuple[int, int, int]
    orphans: dict[str, int]


class _Table(NamedTuple):
    schema_info: _TableSchemaInfo
    indexes: dict[str, tuple[tuple[str, ...], bool]]
    rows: list[tuple[Any, ...]]


def _insert(conn: Connection, sql: str, **params: Any) -> int:
    rowid = conn.execute(text(sql + " RETURNING id"), params).scalar()
    assert isinstance(rowid, int)
    return rowid


def _add_api_key(conn: Connection, user_id: Optional[int]) -> int:
    return _insert(
        conn,
        "INSERT INTO api_keys (user_id, name) VALUES (:user_id, :name)",
        user_id=user_id,
        name=token_hex(4),
    )


def _add_password_reset_token(conn: Connection, user_id: Optional[int]) -> int:
    return _insert(
        conn,
        "INSERT INTO password_reset_tokens (user_id, expires_at) VALUES (:user_id, :expires_at)",
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


def _seed(conn: Connection) -> _Seed:
    role = _insert(conn, "INSERT INTO user_roles (name) VALUES ('MEMBER')")

    def user() -> int:
        return _insert(
            conn,
            "INSERT INTO users (user_role_id, username, email, password_hash, password_salt, "
            "reset_password, auth_method) VALUES (:role, :name, :email, :hash, :salt, FALSE, "
            "'LOCAL')",
            role=role,
            name=token_hex(4),
            email=f"{token_hex(4)}@example.com",
            hash=b"hash",
            salt=b"salt",
        )

    owner, spare, other = user(), user(), user()
    _add_api_key(conn, owner)
    _add_api_key(conn, owner)
    _add_password_reset_token(conn, owner)
    # Rows a user delete left without an owner. Each holds its table's highest id, so a
    # rebuild that resets the AUTOINCREMENT counter to the surviving maximum would reuse it.
    orphans = {
        "api_keys": _add_api_key(conn, None),
        "password_reset_tokens": _add_password_reset_token(conn, None),
    }
    conn.commit()
    return _Seed(users=(owner, spare, other), orphans=orphans)


def _table(
    conn: Connection, name: str, db_backend: Literal["sqlite", "postgresql"], schema: str
) -> _Table:
    schema_info = _get_table_schema_info(conn, name, db_backend, schema)
    assert schema_info is not None
    indexes = {
        ix["name"]: (tuple(c for c in ix["column_names"] if c), bool(ix["unique"]))
        for ix in inspect(conn).get_indexes(name, schema=schema or None)
        if ix["name"]
    }
    rows = conn.execute(text(f"SELECT * FROM {name} ORDER BY id")).all()
    return _Table(schema_info=schema_info, indexes=indexes, rows=[tuple(row) for row in rows])


def _tables(
    conn: Connection, db_backend: Literal["sqlite", "postgresql"], schema: str
) -> dict[str, _Table]:
    return {name: _table(conn, name, db_backend, schema) for name in _TABLES}


def _assert_sqlite_autoincrement(
    conn: Connection, db_backend: Literal["sqlite", "postgresql"]
) -> None:
    if db_backend != "sqlite":
        return
    for name in _TABLES:
        ddl = conn.execute(
            text("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = :name"),
            {"name": name},
        ).scalar_one()
        assert "AUTOINCREMENT" in ddl, name


def _add_rows(
    conn: Connection, api_key_user: int, password_reset_token_user: int
) -> dict[str, int]:
    ids = {
        "api_keys": _add_api_key(conn, api_key_user),
        "password_reset_tokens": _add_password_reset_token(conn, password_reset_token_user),
    }
    conn.commit()
    return ids


def _null_user_id_is_refused(add: Callable[[Connection, Optional[int]], int]) -> _Check:
    def _check(conn: Connection) -> None:
        # The rollback also undoes the connection's search_path on PostgreSQL, so each check
        # gets a connection of its own.
        try:
            with pytest.raises(_INTEGRITY_ERRORS):
                add(conn, None)
        finally:
            conn.rollback()

    return _check


async def test_require_token_user_ids(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    seed = await _run_async(_engine, _seed)
    owner, spare, other = seed.users

    def _snapshot(conn: Connection) -> dict[str, _Table]:
        return _tables(conn, _db_backend, _schema)

    before = await _run_async(_engine, _snapshot)
    await _run_async(_engine, lambda conn: _assert_sqlite_autoincrement(conn, _db_backend))
    for name in _TABLES:
        assert "user_id" in before[name].schema_info["nullable_column_names"]
        assert before[name].rows[-1][0] == seed.orphans[name]
    assert before["api_keys"].indexes == {
        "ix_api_keys_user_id": (("user_id",), False),
        "ix_api_keys_expires_at": (("expires_at",), False),
    }
    assert before["password_reset_tokens"].indexes == {
        "ix_password_reset_tokens_user_id": (("user_id",), True),
        "ix_password_reset_tokens_expires_at": (("expires_at",), False),
    }

    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify_upgraded(conn: Connection) -> dict[str, int]:
        after = _tables(conn, _db_backend, _schema)
        for name in _TABLES:
            info_before, info_after = before[name].schema_info, after[name].schema_info
            assert info_after["column_names"] == info_before["column_names"]
            assert info_after["index_names"] == info_before["index_names"]
            assert info_after["constraint_names"] == info_before["constraint_names"]
            assert info_after["nullable_column_names"] == (
                info_before["nullable_column_names"] - {"user_id"}
            )
            assert after[name].indexes == before[name].indexes
            # The orphan is gone; the owned rows are untouched.
            assert after[name].rows == before[name].rows[:-1]
            assert all(row[1] == owner for row in after[name].rows)
        _assert_sqlite_autoincrement(conn, _db_backend)
        # A new row's id stays above the deleted orphan's, which held the highest id.
        new_ids = _add_rows(conn, owner, spare)
        for name in _TABLES:
            assert new_ids[name] > seed.orphans[name], name
        return new_ids

    upgraded_ids = await _run_async(_engine, _verify_upgraded)
    for add in (_add_api_key, _add_password_reset_token):
        await _run_async(_engine, _null_user_id_is_refused(add))

    def _delete_newest_rows(conn: Connection) -> None:
        for name in _TABLES:
            conn.execute(text(f"DELETE FROM {name} WHERE id = :id"), {"id": upgraded_ids[name]})
        conn.commit()

    # The downgrade rebuilds the tables too, after their highest ids were deleted.
    await _run_async(_engine, _delete_newest_rows)
    await _down(_engine, _alembic_config, _DOWN, _schema)

    def _verify_downgraded(conn: Connection) -> None:
        after = _tables(conn, _db_backend, _schema)
        for name in _TABLES:
            assert after[name].schema_info == before[name].schema_info
            assert after[name].indexes == before[name].indexes
            assert after[name].rows == before[name].rows[:-1]
        _assert_sqlite_autoincrement(conn, _db_backend)
        new_ids = _add_rows(conn, owner, other)
        for name in _TABLES:
            assert new_ids[name] > upgraded_ids[name], name

    await _run_async(_engine, _verify_downgraded)
