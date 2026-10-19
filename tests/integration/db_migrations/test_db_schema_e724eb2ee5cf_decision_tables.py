"""
Schema test for the decision tables migration.

It adds decisions, their versions, and tags whose foreign key to a version is composite,
(decision_id, decision_version_id), so a tag can never point at another decision's
version. Decision experiment tasks gain the version they were copied from.
"""

from datetime import datetime, timezone
from typing import Literal

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _verify_clean_state

_DOWN = "f3b8c2d14e70"
_UP = "e724eb2ee5cf"

_VERSION_COLUMNS = (
    "(decision_id, schema_version, inputs, state, questions, model_provider, model_name, "
    "metadata, created_at)"
)


async def test_decision_tables_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)
    await _up(_engine, _alembic_config, _UP, _schema)

    triage = await _run_async(_engine, lambda conn: _insert_decision(conn, "triage"))
    triage_version = await _run_async(_engine, lambda conn: _insert_version(conn, triage))
    other = await _run_async(_engine, lambda conn: _insert_decision(conn, "other"))
    other_version = await _run_async(_engine, lambda conn: _insert_version(conn, other))

    await _run_async(_engine, lambda conn: _insert_tag(conn, "production", triage, triage_version))
    # A tag name is unique within a decision, not across decisions.
    await _run_async(_engine, lambda conn: _insert_tag(conn, "production", other, other_version))
    with pytest.raises(Exception, match="(?i)unique"):
        await _run_async(
            _engine, lambda conn: _insert_tag(conn, "production", triage, triage_version)
        )
    if _db_backend == "postgresql":
        # The composite foreign key: a tag can't point at another decision's version. (The
        # test connection does not enforce SQLite foreign keys.)
        with pytest.raises(Exception, match="(?i)foreign key"):
            await _run_async(
                _engine, lambda conn: _insert_tag(conn, "staging", triage, other_version)
            )

    assert await _run_async(
        _engine,
        lambda conn: (
            "decision_version_id"
            in {
                column["name"]
                for column in sa.inspect(conn).get_columns("experiment_decision_tasks")
            }
        ),
    )

    await _down(_engine, _alembic_config, _DOWN, _schema)
    for table in ("decisions", "decision_versions", "decision_version_tags"):
        assert not await _run_async(_engine, lambda conn: sa.inspect(conn).has_table(table))
    assert not await _run_async(
        _engine, lambda conn: sa.inspect(conn).has_table("experiment_decision_tasks")
    )


def _insert_decision(conn: Connection, name: str) -> int:
    now = datetime.now(timezone.utc)
    decision_id = conn.execute(
        text(
            "INSERT INTO decisions (name, metadata, created_at, updated_at) "
            "VALUES (:name, '{}', :now, :now) RETURNING id"
        ),
        {"name": name, "now": now},
    ).scalar()
    conn.commit()
    assert isinstance(decision_id, int)
    return decision_id


def _insert_version(conn: Connection, decision_id: int) -> int:
    version_id = conn.execute(
        text(
            f"INSERT INTO decision_versions {_VERSION_COLUMNS} VALUES (:decision_id, 1, "
            "'[]', '{\"type\": \"object\"}', '[]', 'OLLAMA', 'tev1', '{}', :now) RETURNING id"
        ),
        {"decision_id": decision_id, "now": datetime.now(timezone.utc)},
    ).scalar()
    conn.commit()
    assert isinstance(version_id, int)
    return version_id


def _insert_tag(conn: Connection, name: str, decision_id: int, version_id: int) -> None:
    try:
        conn.execute(
            text(
                "INSERT INTO decision_version_tags (name, decision_id, decision_version_id) "
                "VALUES (:name, :decision_id, :version_id)"
            ),
            {"name": name, "decision_id": decision_id, "version_id": version_id},
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
