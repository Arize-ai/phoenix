"""add composite index on project_sessions project_id end_time

Revision ID: eaf1907ae453
Revises: d4e5f6a7b8c9
Create Date: 2026-07-02 18:34:04.568348

Restructures indexes in one migration:

- Creates the composite ``(project_id, end_time DESC)`` index that the sessions
  interval-overlap filter relies on.
- Creates four FK indexes on the experiment log tables whose delete paths
  otherwise run as sequential scans: experiment_logs.experiment_id (the
  runner's bulk DELETE and the cascade from experiment deletion — the existing
  partial ERROR index cannot serve either), experiment_eval_logs
  .experiment_run_id and .dataset_evaluator_id, and experiment_task_logs
  .dataset_example_id (all ON DELETE CASCADE targets that fire once per
  deleted parent row).
- Creates ``user_id`` indexes on seven tables with an unindexed
  ``ON DELETE SET NULL`` FK to users (the four annotation tables, datasets,
  dataset_versions, and experiments), so a user deletion no longer sequential-
  scans each of them.
- Drops seven redundant single-column indexes. Five are served by the leading
  columns of existing unique indexes. ``ix_dataset_examples_external_id`` is
  not (``external_id`` is the second column of the unique ``(dataset_id,
  external_id)`` index); it is dropped because no query filters by
  ``external_id`` without ``dataset_id``, and dataset-scoped lookups are
  served by that unique index. ``ix_project_sessions_end_time`` is superseded
  by the composite created above (creation precedes the drop so there is
  never a window without an end_time index); the one query filtering
  ``end_time`` without ``project_id`` is deliberately non-selective and does
  not benefit from an index.

CONCURRENTLY support (opt-in via PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true):

  CREATE/DROP INDEX CONCURRENTLY cannot run inside a transaction, but Alembic's
  env.py wraps each migration in one. The workaround is to commit the current
  transaction and enable autocommit at the DBAPI level (psycopg) before issuing
  the DDL, then restore transactional mode afterward. See the equivalent handling
  in the spans session.id index migration (f1a6b2f0c9d5) for the rationale and
  tradeoffs. Concurrent builds avoid the write-blocking lock a plain CREATE INDEX
  takes, at the cost of a slower build and a non-transactional migration. Every
  create uses IF NOT EXISTS and every drop IF EXISTS, so an interrupted
  non-transactional run converges on rerun.

  A failed concurrent build leaves an INVALID index behind. On rerun,
  IF NOT EXISTS matches the INVALID leftover by name and skips the create, so
  this migration checks the validity of every index it creates — before
  dropping anything and before stamping itself successful — and fails with
  recovery instructions instead of proceeding with an unusable index.

"""

import os
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "eaf1907ae453"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (index_name, table_name, [columns]) for the FK indexes on the experiment log
# tables, whose delete paths (bulk DELETEs and ON DELETE CASCADEs) otherwise run
# as sequential scans.
_LOG_TABLE_FK_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_experiment_logs_experiment_id", "experiment_logs", ["experiment_id"]),
    ("ix_experiment_eval_logs_experiment_run_id", "experiment_eval_logs", ["experiment_run_id"]),
    (
        "ix_experiment_eval_logs_dataset_evaluator_id",
        "experiment_eval_logs",
        ["dataset_evaluator_id"],
    ),
    ("ix_experiment_task_logs_dataset_example_id", "experiment_task_logs", ["dataset_example_id"]),
]

# (index_name, table_name, [columns]) for the previously unindexed
# ON DELETE SET NULL user_id FKs: a user deletion runs one
# UPDATE ... SET user_id = NULL ... WHERE user_id = :id per table, which is a
# sequential scan without these (the annotation tables can be large).
_USER_ID_FK_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_span_annotations_user_id", "span_annotations", ["user_id"]),
    ("ix_trace_annotations_user_id", "trace_annotations", ["user_id"]),
    ("ix_document_annotations_user_id", "document_annotations", ["user_id"]),
    ("ix_project_session_annotations_user_id", "project_session_annotations", ["user_id"]),
    ("ix_datasets_user_id", "datasets", ["user_id"]),
    ("ix_dataset_versions_user_id", "dataset_versions", ["user_id"]),
    ("ix_experiments_user_id", "experiments", ["user_id"]),
]

# (index_name, table_name, [columns]) for every redundant single-column index
# this migration drops; see the module docstring for the per-index rationale.
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


def _assert_index_is_valid(index_name: str) -> None:
    """Fail loudly if the named index exists but is INVALID (PostgreSQL only).

    A failed CREATE INDEX CONCURRENTLY leaves an INVALID index behind, and a
    build still in progress on another replica is INVALID until it completes.
    In both cases IF NOT EXISTS matches the catalog entry by name and skips the
    create, so without this check the migration could drop a superseded index
    and stamp itself successful while the replacement is unusable — a silent
    perf regression. This check turns that into a loud failure with a fix.
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
        # Create everything first: the composite must exist (and be valid) before
        # the superseded single-column end_time index is dropped below.
        op.execute(
            f"CREATE INDEX {'CONCURRENTLY ' if concurrently else ''}IF NOT EXISTS "
            "ix_project_sessions_project_id_end_time "
            "ON project_sessions (project_id, end_time DESC)"
        )
        for index_name, table_name, columns in _LOG_TABLE_FK_INDEXES + _USER_ID_FK_INDEXES:
            op.create_index(
                index_name,
                table_name,
                columns,
                if_not_exists=True,
                postgresql_concurrently=concurrently,
            )
        # Refuse to drop anything (or stamp this migration successful) while any
        # created index is INVALID — a failed concurrent build satisfies
        # IF NOT EXISTS above.
        _assert_index_is_valid("ix_project_sessions_project_id_end_time")
        for index_name, _, _ in _LOG_TABLE_FK_INDEXES + _USER_ID_FK_INDEXES:
            _assert_index_is_valid(index_name)
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
        # Mirror image: recreate the single-column indexes and verify them before
        # dropping the composite and the log-table FK indexes.
        for index_name, table_name, columns in _REDUNDANT_INDEXES:
            op.create_index(
                index_name,
                table_name,
                columns,
                if_not_exists=True,
                postgresql_concurrently=concurrently,
            )
        for index_name, _, _ in _REDUNDANT_INDEXES:
            _assert_index_is_valid(index_name)
        op.drop_index(
            "ix_project_sessions_project_id_end_time",
            table_name="project_sessions",
            if_exists=True,
            postgresql_concurrently=concurrently,
        )
        for index_name, table_name, _ in _LOG_TABLE_FK_INDEXES + _USER_ID_FK_INDEXES:
            op.drop_index(
                index_name,
                table_name=table_name,
                if_exists=True,
                postgresql_concurrently=concurrently,
            )
    finally:
        if concurrently:
            _disable_autocommit()
