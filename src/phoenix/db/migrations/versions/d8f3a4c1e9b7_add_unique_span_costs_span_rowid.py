"""add unique constraint on span_costs.span_rowid

Revision ID: d8f3a4c1e9b7
Revises: 4aad9107d196
Create Date: 2026-08-31 12:00:00.000000

Span.span_cost is modeled and consumed as a one-to-one relationship, but
span_costs.span_rowid only ever had a regular (non-unique) index, so nothing
in the database enforced that invariant. A duplicate row for one span lets
joins against span_costs fan a span out into multiple rows, which corrupts
span pagination/counts and inflates aggregated cost/token totals for any
caller that already joins span_costs.

Current writers avoid duplicates by only computing a span's cost after its
(unique) span insert succeeds, so this is not expected to find anything to
clean up in practice, but the invariant was never enforced against retries,
future writers, imports, or direct database writes. Any pre-existing
duplicates are pruned first, keeping the highest id per span_rowid (the most
recently written row), before the plain index is replaced with a unique one
of the same name.

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction, but
  Alembic's env.py wraps each migration in one. The workaround is to commit
  the current transaction and enable autocommit at the DBAPI level (psycopg)
  before issuing the DDL, then restore transactional mode afterward. See the
  spans session.id index migration (f1a6b2f0c9d5) for the rationale and
  tradeoffs.

  A plain index can't be upgraded to unique in place, so the concurrent path
  builds the unique replacement under a temporary name, drops the old index,
  and renames the replacement into the canonical name — span_costs is never
  left without an index on span_rowid, and writers are never blocked on an
  ACCESS EXCLUSIVE lock. A failed concurrent build leaves an INVALID index
  behind under the temporary name, which IF NOT EXISTS matches on rerun, so
  the index is checked for validity before anything else happens.
"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d8f3a4c1e9b7"
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_NAME = "ix_span_costs_span_rowid"
_TEMP_INDEX_NAME = "ix_span_costs_span_rowid_unique_tmp"


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

    A failed CREATE INDEX CONCURRENTLY leaves an INVALID index that IF NOT
    EXISTS matches by name, so without this check the migration could stamp
    itself successful while the replacement index is unusable.
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


def _dedupe_span_costs() -> None:
    """Keep only the highest-id span_costs row per span_rowid.

    Runs inside the migration's ambient transaction (before any switch to
    autocommit for CONCURRENTLY), so it either fully applies or not at all.

    Deletes the doomed rows' span_cost_details explicitly rather than relying
    on the span_cost_details.span_cost_id FK's ON DELETE CASCADE: SQLite
    migrations run with foreign key enforcement off (see
    set_sqlite_migration_pragma in phoenix.db.engines), so on SQLite that
    cascade never fires and would otherwise leave orphaned detail rows behind.
    """
    connection = op.get_bind()
    duplicate_span_cost_ids = (
        "SELECT id FROM span_costs WHERE id NOT IN "
        "(SELECT MAX(id) FROM span_costs GROUP BY span_rowid)"
    )
    connection.execute(
        sa.text(f"DELETE FROM span_cost_details WHERE span_cost_id IN ({duplicate_span_cost_ids})")
    )
    connection.execute(sa.text(f"DELETE FROM span_costs WHERE id IN ({duplicate_span_cost_ids})"))


def upgrade() -> None:
    _dedupe_span_costs()
    concurrently = _use_concurrently()
    if not concurrently:
        op.drop_index(_INDEX_NAME, table_name="span_costs", if_exists=True)
        op.create_index(
            _INDEX_NAME,
            "span_costs",
            ["span_rowid"],
            unique=True,
            if_not_exists=True,
        )
        return
    _enable_autocommit()
    try:
        op.create_index(
            _TEMP_INDEX_NAME,
            "span_costs",
            ["span_rowid"],
            unique=True,
            if_not_exists=True,
            postgresql_concurrently=True,
        )
        _assert_index_is_valid(_TEMP_INDEX_NAME)
        op.drop_index(
            _INDEX_NAME,
            table_name="span_costs",
            if_exists=True,
            postgresql_concurrently=True,
        )
        op.execute(f"ALTER INDEX {_TEMP_INDEX_NAME} RENAME TO {_INDEX_NAME}")
    finally:
        _disable_autocommit()


def downgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.drop_index(
            _INDEX_NAME,
            table_name="span_costs",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
        op.create_index(
            _INDEX_NAME,
            "span_costs",
            ["span_rowid"],
            unique=False,
            if_not_exists=True,
            postgresql_concurrently=concurrently,
        )
        if concurrently:
            _assert_index_is_valid(_INDEX_NAME)
    finally:
        if concurrently:
            _disable_autocommit()
