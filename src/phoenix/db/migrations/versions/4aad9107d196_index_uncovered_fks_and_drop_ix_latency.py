"""index uncovered FK columns and drop ix_latency

Revision ID: 4aad9107d196
Revises: e767d3c57f32
Create Date: 2026-08-06 12:00:00.000000

- Creates covering indexes for FK columns with a cascading or nulling
  ondelete whose parent rows actually get deleted (custom providers, prompt
  versions, users), so the delete no longer sequential-scans the child table.
  FKs on tables where the scan is trivially cheap or never fires are
  deliberately left unindexed: enum-like parents that never see deletes
  (evaluator kinds, log categories, task types), the short-lived
  oauth2_authorization_codes rows, and system_settings (one row per setting
  key).
- Drops ix_latency on spans: it indexes (end_time - start_time), an
  expression no query emits (the application computes latency via
  EXTRACT/unixepoch), and on SQLite string subtraction collapses every row to
  a single key.

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. The workaround is to commit the current
  transaction and enable autocommit at the DBAPI level (psycopg) before issuing
  the DDL, then restore transactional mode afterward. See the spans session.id
  index migration (f1a6b2f0c9d5) for the rationale and tradeoffs. Creates use
  IF NOT EXISTS and drops IF EXISTS, so an interrupted non-transactional run
  converges on rerun.

  A failed concurrent build leaves an INVALID index behind, which IF NOT EXISTS
  matches by name on rerun, so every created index is checked for validity
  before anything is dropped and before the migration stamps itself successful.
"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4aad9107d196"
down_revision: Union[str, None] = "e767d3c57f32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (index_name, table_name, [columns]) for the previously uncovered FK columns:
# the parent-side delete runs one UPDATE ... SET <col> = NULL (or a cascade
# probe) per deleted row, which is a sequential scan without these.
_FK_INDEXES: list[tuple[str, str, list[str]]] = [
    (
        "ix_experiment_prompt_tasks_custom_provider_id",
        "experiment_prompt_tasks",
        ["custom_provider_id"],
    ),
    (
        "ix_experiment_prompt_tasks_prompt_version_id",
        "experiment_prompt_tasks",
        ["prompt_version_id"],
    ),
    ("ix_dataset_evaluators_user_id", "dataset_evaluators", ["user_id"]),
    (
        "ix_generative_model_custom_providers_user_id",
        "generative_model_custom_providers",
        ["user_id"],
    ),
    ("ix_secrets_user_id", "secrets", ["user_id"]),
]


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
    itself successful while an index is unusable.
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
        for index_name, table_name, columns in _FK_INDEXES:
            op.create_index(
                index_name,
                table_name,
                columns,
                if_not_exists=True,
                postgresql_concurrently=concurrently,
            )
        for index_name, _, _ in _FK_INDEXES:
            _assert_index_is_valid(index_name)
        op.drop_index(
            "ix_latency",
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
            "ix_latency",
            "spans",
            [sa.text("(end_time - start_time)")],
            if_not_exists=True,
            postgresql_concurrently=concurrently,
        )
        _assert_index_is_valid("ix_latency")
        for index_name, table_name, _ in _FK_INDEXES:
            op.drop_index(
                index_name,
                table_name=table_name,
                if_exists=True,
                postgresql_concurrently=concurrently,
            )
    finally:
        if concurrently:
            _disable_autocommit()
