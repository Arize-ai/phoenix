"""add span session.id index

Revision ID: f1a6b2f0c9d5
Revises: a1b2c3d4e5f6
Create Date: 2026-01-19 12:00:00.000000

Creates a partial index on spans.attributes for session.id lookups. Uses
IF NOT EXISTS so the migration is a no-op if the index already exists (e.g.,
pre-created manually).

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. Alembic's autocommit_block() doesn't
  work here because env.py manages transactions explicitly via
  connection.begin(). The workaround is to commit the current transaction
  and enable autocommit at the DBAPI level (psycopg) before issuing the DDL,
  then restore transactional mode afterward.

  Tradeoffs:
  - CONCURRENTLY avoids table locks during the build, which matters for
    rolling deployments where an existing instance is still ingesting spans.
  - CONCURRENTLY is ~2-3x slower (two heap passes) and breaks transactional
    migration guarantees (if the build fails, a partial INVALID index is left
    behind and must be dropped manually).
  - For very large tables, operators can pre-create a no-op index before
    upgrading so the migration is instant:

    1. While the old version is still running:
       CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spans_session_id
       ON spans ((attributes #>> '{session,id}')) WHERE false;
    2. Upgrade Phoenix (migration sees the name, skips).
    3. Backfill the real index at leisure:
       DROP INDEX CONCURRENTLY IF EXISTS ix_spans_session_id;
       CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spans_session_id
       ON spans (((attributes #>> '{session,id}')::varchar))
       WHERE ((attributes #>> '{session,id}')::varchar) IS NOT NULL;
"""

import os
from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

# revision identifiers, used by Alembic.
revision: str = "f1a6b2f0c9d5"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
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
    session_id = sa.column("attributes", JSON_)[["session", "id"]].as_string()
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.create_index(
            "ix_spans_session_id",
            "spans",
            [session_id],
            unique=False,
            if_not_exists=True,
            postgresql_concurrently=concurrently,
            postgresql_where=session_id.is_not(None),
            sqlite_where=session_id.is_not(None),
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
            "ix_spans_session_id",
            table_name="spans",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
    finally:
        if concurrently:
            _disable_autocommit()
