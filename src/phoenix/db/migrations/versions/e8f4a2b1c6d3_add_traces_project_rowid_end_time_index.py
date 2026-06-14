"""add composite index on traces(project_rowid, end_time)

Revision ID: e8f4a2b1c6d3
Revises: d4e5f6a7b8c9
Create Date: 2026-06-14 00:00:00.000000

Creates a composite index to speed up ProjectsPageQuery sorting by max trace
end_time per project. Uses IF NOT EXISTS so the migration is a no-op if the
index already exists (e.g., pre-created manually).

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. Alembic's autocommit_block() doesn't
  work here because env.py manages transactions explicitly via
  connection.begin(). The workaround is to commit the current transaction
  and enable autocommit at the DBAPI level (psycopg) before issuing the DDL,
  then restore transactional mode afterward.

  Tradeoffs:
  - CONCURRENTLY avoids table locks during the build, which matters for
    rolling deployments where an existing instance is still ingesting traces.
  - CONCURRENTLY is ~2-3x slower (two heap passes) and breaks transactional
    migration guarantees (if the build fails, a partial INVALID index is left
    behind and must be dropped manually).
  - For very large tables, operators can pre-create the index before upgrading:

    CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_traces_project_rowid_end_time
    ON traces (project_rowid, end_time DESC);
"""

import os
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e8f4a2b1c6d3"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _use_concurrently() -> bool:
    """Check if CONCURRENTLY should be used based on dialect and env var."""
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return False
    return os.environ.get("PHOENIX_MIGRATE_INDEX_CONCURRENTLY", "").lower() == "true"


def _enable_autocommit() -> None:
    """Exit the current transaction and enable autocommit at the DBAPI level."""
    dbapi_conn = op.get_bind().connection.dbapi_connection
    assert dbapi_conn is not None
    dbapi_conn.commit()
    dbapi_conn.autocommit = True


def _disable_autocommit() -> None:
    """Restore transactional mode at the DBAPI level."""
    dbapi_conn = op.get_bind().connection.dbapi_connection
    assert dbapi_conn is not None
    dbapi_conn.autocommit = False


def upgrade() -> None:
    concurrently = _use_concurrently()
    connection = op.get_bind()
    if concurrently:
        _enable_autocommit()
    try:
        if connection.dialect.name == "postgresql":
            op.create_index(
                "ix_traces_project_rowid_end_time",
                "traces",
                ["project_rowid", "end_time"],
                unique=False,
                if_not_exists=True,
                postgresql_concurrently=concurrently,
                postgresql_ops={"end_time": "DESC"},
            )
        else:
            op.create_index(
                "ix_traces_project_rowid_end_time",
                "traces",
                ["project_rowid", "end_time"],
                unique=False,
                if_not_exists=True,
            )
    finally:
        if concurrently:
            _disable_autocommit()


def downgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.drop_index(
            "ix_traces_project_rowid_end_time",
            table_name="traces",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
    finally:
        if concurrently:
            _disable_autocommit()
