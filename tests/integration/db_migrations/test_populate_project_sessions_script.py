import pytest

from phoenix.db.migrations.data_migration_scripts.populate_project_sessions import (
    _statements_for_dialect,
)


def _sql_for_dialect(dialect: str) -> tuple[str, str]:
    insert_stmt, update_stmt = _statements_for_dialect(dialect)
    return str(insert_stmt), str(update_stmt)


def test_mysql_project_session_population_uses_mysql_json_sql() -> None:
    insert_sql, update_sql = _sql_for_dialect("mysql")

    assert "JSON_UNQUOTE(JSON_EXTRACT" in insert_sql
    assert "JSON_UNQUOTE(JSON_EXTRACT" in update_sql
    assert "UPDATE traces\n    JOIN" in update_sql
    assert "CAST(JSON_EXTRACT" not in insert_sql
    assert "CAST(JSON_EXTRACT" not in update_sql


def test_sqlite_project_session_population_keeps_sqlite_json_sql() -> None:
    insert_sql, update_sql = _sql_for_dialect("sqlite")

    assert "CAST(JSON_EXTRACT" in insert_sql
    assert "CAST(JSON_EXTRACT" in update_sql
    assert "JSON_UNQUOTE" not in insert_sql
    assert "JSON_UNQUOTE" not in update_sql


def test_unknown_project_session_population_dialect_fails() -> None:
    with pytest.raises(ValueError, match="Unsupported database backend"):
        _statements_for_dialect("oracle")
