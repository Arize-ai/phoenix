from alembic.config import Config
from sqlalchemy import Engine

from . import _DBBackend, _down, _get_table_schema_info, _up, _verify_clean_state

_DOWN = "f1a6b2f0c9d5"
_UP = "4f7c9f1e2b3a"


def test_dataset_example_revisions_content_hash_schema(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    _verify_clean_state(_engine, _schema)

    _up(_engine, _alembic_config, _DOWN, _schema)
    with _engine.connect() as conn:
        before = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
    assert before is not None
    assert "content_hash" not in before["column_names"]
    assert "ix_dataset_example_revisions_content_hash" not in before["index_names"]
    assert not any("valid_content_hash_length" in name for name in before["constraint_names"])

    _up(_engine, _alembic_config, _UP, _schema)
    with _engine.connect() as conn:
        after = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
    assert after is not None
    assert "content_hash" in after["column_names"]
    assert "ix_dataset_example_revisions_content_hash" in after["index_names"]
    assert any("valid_content_hash_length" in name for name in after["constraint_names"])
    assert "content_hash" in after["nullable_column_names"]

    _down(_engine, _alembic_config, _DOWN, _schema)
    with _engine.connect() as conn:
        downgraded = _get_table_schema_info(conn, "dataset_example_revisions", _db_backend, _schema)
    assert downgraded is not None
    assert "content_hash" not in downgraded["column_names"]
    assert "ix_dataset_example_revisions_content_hash" not in downgraded["index_names"]
    assert not any("valid_content_hash_length" in name for name in downgraded["constraint_names"])
