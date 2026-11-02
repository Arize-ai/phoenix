from typing import Any, Callable

import pytest
from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from . import _down, _run_async, _up

_DOWN = "7c2bc8452d60"
_UP = "b109a51ab9b6"

_INTEGRITY_ERRORS = (SQLAlchemyIntegrityError, SQLiteIntegrityError)


def _model(**values: Any) -> dict[str, Any]:
    return {
        "name": "gpt-6-luna",
        "provider": "openai",
        "name_pattern": "^gpt-6-luna$",
        "is_built_in": True,
        **values,
    }


def _insert_model(conn: Connection, values: dict[str, Any]) -> int:
    columns = ", ".join(values)
    params = ", ".join(f":{name}" for name in values)
    stmt = text(f"INSERT INTO generative_models ({columns}) VALUES ({params}) RETURNING id")
    rowid = conn.execute(stmt, values).scalar()
    assert isinstance(rowid, int)
    return rowid


def _commit_model(values: dict[str, Any]) -> Callable[[Connection], int]:
    def _do(conn: Connection) -> int:
        rowid = _insert_model(conn, values)
        conn.commit()
        return rowid

    return _do


def _refused(values: dict[str, Any], match: str) -> Callable[[Connection], None]:
    def _check(conn: Connection) -> None:
        # The rollback also undoes the connection's search_path on PostgreSQL, so each check
        # gets a connection of its own.
        try:
            with pytest.raises(_INTEGRITY_ERRORS, match=match):
                _insert_model(conn, values)
        finally:
            conn.rollback()

    return _check


def _columns(conn: Connection, schema: str) -> set[str]:
    columns = inspect(conn).get_columns("generative_models", schema=schema or None)
    return {column["name"] for column in columns}


async def test_add_type_to_generative_models(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    model_id = await _run_async(_engine, _commit_model(_model()))

    await _up(_engine, _alembic_config, _UP, _schema)

    def _type_of(conn: Connection) -> Any:
        stmt = text("SELECT type FROM generative_models WHERE id = :id")
        return conn.execute(stmt, {"id": model_id}).scalar()

    assert await _run_async(_engine, _type_of) == "LLM"
    # The same model can be priced once per type, but only once within a type.
    decision_model_id = await _run_async(_engine, _commit_model(_model(type="DECISION")))
    await _run_async(_engine, _refused(_model(type="DECISION"), "generative_models"))
    await _run_async(_engine, _refused(_model(name="other", type="CHAT"), "valid_type"))

    def _delete_decision_model(conn: Connection) -> None:
        # The downgraded indexes can't hold two models with the same name.
        stmt = text("DELETE FROM generative_models WHERE id = :id")
        conn.execute(stmt, {"id": decision_model_id})
        conn.commit()

    await _run_async(_engine, _delete_decision_model)
    await _down(_engine, _alembic_config, _DOWN, _schema)

    assert "type" not in await _run_async(_engine, lambda conn: _columns(conn, _schema))
    await _run_async(_engine, _refused(_model(), "generative_models"))
