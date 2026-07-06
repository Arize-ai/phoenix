"""add composite index on project_sessions project_id end_time

Revision ID: eaf1907ae453
Revises: c7f6a8b9d0e1
Create Date: 2026-07-02 18:34:04.568348

Adds the composite ``(project_id, end_time DESC)`` index that the sessions
interval-overlap filter relies on. The superseded single-column
``ix_project_sessions_end_time`` index is dropped by the preceding cleanup
migration.

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. The workaround is to commit the current
  transaction and enable autocommit at the DBAPI level (psycopg) before issuing
  the DDL, then restore transactional mode afterward. See the equivalent handling
  in the spans session.id index migration (f1a6b2f0c9d5) for the rationale and
  tradeoffs. Concurrent builds avoid the write-blocking lock a plain CREATE INDEX
  takes, at the cost of a slower build and a non-transactional migration.

  A failed concurrent build leaves an INVALID index behind. On rerun,
  IF NOT EXISTS matches the INVALID leftover by name and skips the create, so
  this migration checks validity and fails with recovery instructions instead
  of stamping itself successful with an unusable index.

"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "eaf1907ae453"
down_revision: Union[str, None] = "c7f6a8b9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _use_concurrently() -> bool:
    """CONCURRENTLY is opt-in (PostgreSQL only) via PHOENIX_MIGRATE_INDEX_CONCURRENTLY."""
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


def _assert_index_is_valid(index_name: str) -> None:
    """Fail loudly if the named index exists but is INVALID (PostgreSQL only).

    A failed CREATE INDEX CONCURRENTLY leaves an INVALID index behind, and a
    build still in progress on another replica is INVALID until it completes.
    In both cases IF NOT EXISTS matches the catalog entry by name and skips the
    create, so without this check the migration could stamp itself successful
    while the replacement is unusable — a silent perf regression. This check
    turns that into a loud failure with a fix.
    """
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return
    is_valid = connection.execute(
        sa.text("SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass(:name)"),
        {"name": index_name},
    ).scalar()
    if is_valid is False:
        raise RuntimeError(
            f"Index {index_name} exists but is INVALID: a previous CONCURRENTLY build "
            "failed, or another replica is still building it. If no build is in "
            f"progress, run DROP INDEX CONCURRENTLY IF EXISTS {index_name} and rerun "
            "the migration."
        )


def upgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.execute(
            f"CREATE INDEX {'CONCURRENTLY ' if concurrently else ''}IF NOT EXISTS "
            "ix_project_sessions_project_id_end_time "
            "ON project_sessions (project_id, end_time DESC)"
        )
        # Refuse to stamp this migration successful while the index is INVALID — a
        # failed concurrent build satisfies IF NOT EXISTS above.
        _assert_index_is_valid("ix_project_sessions_project_id_end_time")
    finally:
        if concurrently:
            _disable_autocommit()


def downgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.drop_index(
            "ix_project_sessions_project_id_end_time",
            table_name="project_sessions",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
    finally:
        if concurrently:
            _disable_autocommit()
