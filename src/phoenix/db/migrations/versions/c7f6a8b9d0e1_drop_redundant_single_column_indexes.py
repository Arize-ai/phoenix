"""drop redundant single-column indexes

Revision ID: c7f6a8b9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-07-06 13:08:00.000000

Drops single-column indexes that are covered by leading columns of existing
unique indexes, the standalone dataset_examples.external_id index whose
observed lookups are scoped by dataset_id and covered by the unique
``(dataset_id, external_id)`` index, and the unused project_sessions.end_time
index (superseded by the composite index added in the next migration).

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  A plain DROP INDEX is instant once it holds its ACCESS EXCLUSIVE lock, but it
  must wait for in-flight readers and blocks all new queries on the table while
  waiting. DROP INDEX CONCURRENTLY avoids that, at the cost of running outside
  a transaction — see the spans session.id index migration (f1a6b2f0c9d5) for
  the autocommit workaround and tradeoffs. Every drop uses IF EXISTS and every
  downgrade create uses IF NOT EXISTS, so a failed non-transactional run
  converges on rerun.

"""

import os
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7f6a8b9d0e1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (index_name, table_name, [columns]) for every redundant index this migration drops.
_REDUNDANT_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_project_annotation_configs_project_id", "project_annotation_configs", ["project_id"]),
    ("ix_prompts_prompt_labels_prompt_label_id", "prompts_prompt_labels", ["prompt_label_id"]),
    ("ix_token_prices_model_id", "token_prices", ["model_id"]),
    ("ix_dataset_examples_dataset_id", "dataset_examples", ["dataset_id"]),
    ("ix_dataset_examples_external_id", "dataset_examples", ["external_id"]),
    ("ix_dataset_evaluators_dataset_id", "dataset_evaluators", ["dataset_id"]),
    ("ix_project_sessions_end_time", "project_sessions", ["end_time"]),
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


def upgrade() -> None:
    concurrently = _use_concurrently()
    if concurrently:
        _enable_autocommit()
    try:
        for index_name, table_name, _ in _REDUNDANT_INDEXES:
            op.drop_index(
                index_name,
                table_name=table_name,
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
        for index_name, table_name, columns in _REDUNDANT_INDEXES:
            op.create_index(
                index_name,
                table_name,
                columns,
                if_not_exists=True,
                postgresql_concurrently=concurrently,
            )
    finally:
        if concurrently:
            _disable_autocommit()
