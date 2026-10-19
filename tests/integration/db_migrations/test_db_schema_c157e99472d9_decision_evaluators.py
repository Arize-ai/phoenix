"""Decision evaluators migrate independently and preserve existing evaluator rows."""

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection, text
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _verify_clean_state
from .test_db_schema_e724eb2ee5cf_decision_tables import (
    _insert_decision,
    _insert_tag,
    _insert_version,
)


async def test_decision_evaluator_schema(
    _engine: AsyncEngine, _alembic_config: Config, _schema: str
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, "e724eb2ee5cf", _schema)

    def create_existing(conn: Connection) -> int:
        row_id = conn.execute(
            text(
                "INSERT INTO evaluators (name, kind, metadata) VALUES ('existing', 'LLM', '{}') RETURNING id"
            )
        ).scalar_one()
        conn.commit()
        assert isinstance(row_id, int)
        return row_id

    existing_id = await _run_async(_engine, create_existing)
    await _up(_engine, _alembic_config, "c157e99472d9", _schema)
    decision_id = await _run_async(_engine, lambda conn: _insert_decision(conn, "judge"))
    version_id = await _run_async(_engine, lambda conn: _insert_version(conn, decision_id))
    await _run_async(_engine, lambda conn: _insert_tag(conn, "evaluator", decision_id, version_id))

    def create_judge(conn: Connection) -> int:
        tag_id = conn.execute(
            text("SELECT id FROM decision_version_tags WHERE decision_id = :decision"),
            {"decision": decision_id},
        ).scalar_one()
        row_id = conn.execute(
            text(
                "INSERT INTO evaluators (name, kind, metadata) VALUES ('judge', 'DECISION', '{}') RETURNING id"
            )
        ).scalar_one()
        conn.execute(
            text(
                "INSERT INTO decision_evaluators (id, decision_id, decision_version_tag_id, projection_policy) VALUES (:id, :decision, :tag, '{}')"
            ),
            {"id": row_id, "decision": decision_id, "tag": tag_id},
        )
        conn.commit()
        assert isinstance(row_id, int)
        return row_id

    evaluator_id = await _run_async(_engine, create_judge)
    assert await _run_async(
        _engine,
        lambda conn: (
            "decision_projection_policy"
            in {column["name"] for column in sa.inspect(conn).get_columns("dataset_evaluators")}
        ),
    )
    with pytest.raises(ValueError, match="decision evaluators exist"):
        await _down(_engine, _alembic_config, "e724eb2ee5cf", _schema)

    def delete_judge(conn: Connection) -> None:
        conn.execute(text("DELETE FROM decision_evaluators WHERE id = :id"), {"id": evaluator_id})
        conn.execute(text("DELETE FROM evaluators WHERE id = :id"), {"id": evaluator_id})
        conn.commit()

    await _run_async(_engine, delete_judge)
    await _down(_engine, _alembic_config, "e724eb2ee5cf", _schema)
    assert not await _run_async(
        _engine, lambda conn: sa.inspect(conn).has_table("decision_evaluators")
    )
    assert (
        await _run_async(
            _engine,
            lambda conn: conn.execute(
                text("SELECT name FROM evaluators WHERE id = :id"), {"id": existing_id}
            ).scalar_one(),
        )
        == "existing"
    )
