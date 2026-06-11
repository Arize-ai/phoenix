from sqlalchemy.dialects import mysql, postgresql

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.dataloaders.span_descendants import _descendants_stmt


def test_descendants_stmt_uses_values_for_postgresql() -> None:
    sql = str(
        _descendants_stmt([(1, 3), (2, None)], SupportedSQLDialect.POSTGRESQL).compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "FROM (VALUES " in sql


def test_descendants_stmt_uses_union_all_for_mysql() -> None:
    sql = str(
        _descendants_stmt([(1, 3), (2, None)], SupportedSQLDialect.MYSQL).compile(
            dialect=mysql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )

    assert "FROM (VALUES " not in sql
    assert "UNION ALL" in sql
    assert "SELECT 1 AS root_rowid, 3 AS max_depth" in sql
    assert "SELECT 2 AS root_rowid, NULL AS max_depth" in sql
