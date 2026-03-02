import json
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from alembic.config import Config
from sqlalchemy import Engine, text

from . import _DBBackend, _down, _get_table_schema_info, _up, _verify_clean_state

_DOWN = "f1a6b2f0c9d5"
_UP = "4f7c9f1e2b3a"


def _compute_expected_hash(
    input: dict[str, Any],
    output: dict[str, Any],
    metadata: dict[str, Any],
) -> str:
    canonical_payload = json.dumps(
        {"input": input, "output": output, "metadata": metadata},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return sha256(canonical_payload.encode("utf-8")).hexdigest()


def test_schema_after_migration(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    _verify_clean_state(_engine, _schema)

    _up(_engine, _alembic_config, _DOWN, _schema)
    with _engine.connect() as conn:
        rev_before = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
        ex_before = _get_table_schema_info(conn, "dataset_examples", _db_backend, _schema)
    assert rev_before is not None
    assert "content_hash" not in rev_before["column_names"]
    assert ex_before is not None
    assert "external_id" not in ex_before["column_names"]

    _up(_engine, _alembic_config, _UP, _schema)
    with _engine.connect() as conn:
        rev_after = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
        ex_after = _get_table_schema_info(conn, "dataset_examples", _db_backend, _schema)
    assert rev_after is not None
    assert "content_hash" in rev_after["column_names"]
    assert "content_hash" not in rev_after["nullable_column_names"]
    assert "ix_dataset_example_revisions_content_hash" in rev_after["index_names"]
    assert any("valid_content_hash_length" in name for name in rev_after["constraint_names"])

    assert ex_after is not None
    assert "external_id" in ex_after["column_names"]
    assert "external_id" not in ex_after["nullable_column_names"]
    assert any("uq_dataset_examples_external_id" in name for name in ex_after["constraint_names"])

    _down(_engine, _alembic_config, _DOWN, _schema)
    with _engine.connect() as conn:
        rev_down = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
        ex_down = _get_table_schema_info(conn, "dataset_examples", _db_backend, _schema)
    assert rev_down is not None
    assert "content_hash" not in rev_down["column_names"]
    assert ex_down is not None
    assert "external_id" not in ex_down["column_names"]


def test_backfill_content_hash_and_external_id(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    _verify_clean_state(_engine, _schema)
    _up(_engine, _alembic_config, _DOWN, _schema)

    now = datetime.now(timezone.utc).isoformat()
    input_data = {"question": "What is AI?"}
    output_data = {"answer": "Artificial intelligence"}
    metadata_data = {"source": "test"}
    expected_hash = _compute_expected_hash(input_data, output_data, metadata_data)

    with _engine.connect() as conn:
        dataset_id = conn.execute(
            text(
                "INSERT INTO datasets (name, description, metadata, created_at, updated_at)"
                " VALUES ('ds', 'desc', '{}', :now, :now)"
                " RETURNING id"
            ),
            {"now": now},
        ).scalar()
        version_id = conn.execute(
            text(
                "INSERT INTO dataset_versions (dataset_id, description, metadata, created_at)"
                " VALUES (:did, 'v1', '{}', :now)"
                " RETURNING id"
            ),
            {"did": dataset_id, "now": now},
        ).scalar()
        ex1_id = conn.execute(
            text(
                "INSERT INTO dataset_examples (dataset_id, created_at)"
                " VALUES (:did, :now)"
                " RETURNING id"
            ),
            {"did": dataset_id, "now": now},
        ).scalar()
        conn.execute(
            text("INSERT INTO dataset_examples (dataset_id, created_at) VALUES (:did, :now)"),
            {"did": dataset_id, "now": now},
        )
        rev_id = conn.execute(
            text(
                "INSERT INTO dataset_example_revisions"
                " (dataset_example_id, dataset_version_id, input, output, metadata,"
                "  revision_kind, created_at)"
                " VALUES (:eid, :vid, :inp, :out, :meta, 'CREATE', :now)"
                " RETURNING id"
            ),
            {
                "eid": ex1_id,
                "vid": version_id,
                "inp": json.dumps(input_data),
                "out": json.dumps(output_data),
                "meta": json.dumps(metadata_data),
                "now": now,
            },
        ).scalar()
        conn.commit()

    _up(_engine, _alembic_config, _UP, _schema)

    with _engine.connect() as conn:
        row = conn.execute(
            text("SELECT content_hash FROM dataset_example_revisions WHERE id = :id"),
            {"id": rev_id},
        ).one()
        assert row[0] == expected_hash

        external_ids = conn.execute(
            text("SELECT external_id FROM dataset_examples ORDER BY id")
        ).fetchall()
        assert len(external_ids) == 2
        eid1, eid2 = external_ids[0][0], external_ids[1][0]
        assert eid1 != eid2
        assert len(eid1) == 36
        assert len(eid2) == 36
