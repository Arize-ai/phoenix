"""drop ix_cumulative_llm_token_count_total

Revision ID: 5d472ea4b4be
Revises: b109a51ab9b6
Create Date: 2026-11-17 15:25:35.046028

Drops ix_cumulative_llm_token_count_total on spans. PostgreSQL DESC sorts via
SpanSort cannot use the expression index due to NULLS LAST and SQLite
project-scoped queries ignore it, while every span insert and ancestor
propagation update pays to maintain it.

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. Commit the current transaction and enable
  autocommit at the DBAPI level (psycopg) before issuing the DDL, then restore
  transactional mode afterward.
"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5d472ea4b4be"
down_revision: Union[str, None] = "b109a51ab9b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_NAME = "ix_cumulative_llm_token_count_total"


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
    """Fail loudly if the named index exists but is INVALID (PostgreSQL only)."""
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
        op.drop_index(
            _INDEX_NAME,
            table_name="spans",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
    finally:
        if concurrently:
            _disable_autocommit()


def downgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        op.create_index(
            _INDEX_NAME,
            "spans",
            [
                sa.text(
                    "(cumulative_llm_token_count_prompt + cumulative_llm_token_count_completion)"
                )
            ],
            if_not_exists=True,
            postgresql_concurrently=concurrently,
        )
        _assert_index_is_valid(_INDEX_NAME)
    finally:
        if concurrently:
            _disable_autocommit()
