"""add cleanup tasks and lifecycle tombstones

Revision ID: f125a3233286
Revises: e724eb2ee5cf
Create Date: 2026-11-16 00:24:34.041181

"""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f125a3233286"
down_revision: Union[str, None] = "e724eb2ee5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

_PROJECT_KIND_CHECK = "kind IN ('STANDARD', 'PLAYGROUND', 'EXPERIMENT', 'EVALUATOR')"
_CLEANUP_TASK_KIND_CHECK = (
    "kind IN ("
    "'DELETE_PROJECT', 'CLEAR_PROJECT_TRACES', "
    "'DELETE_PROJECT_EVALUATOR', 'DELETE_DATASET_EVALUATOR'"
    ")"
)
_LIVE_PREDICATE = "deleted_at IS NULL"
_UNCLAIMED_PREDICATE = "claimed_at IS NULL"
_CLAIMED_PREDICATE = "claimed_at IS NOT NULL"
_PROJECT_EVALUATOR_LIFECYCLE_CHECK = (
    "(deleted_at IS NULL AND evaluator_id IS NOT NULL) "
    "OR (deleted_at IS NOT NULL AND evaluator_id IS NULL)"
)
_DATASET_EVALUATOR_LIFECYCLE_CHECK = (
    "(deleted_at IS NULL AND dataset_id IS NOT NULL AND evaluator_id IS NOT NULL) "
    "OR (deleted_at IS NOT NULL AND evaluator_id IS NULL)"
)
_CLAIM_CHECK = (
    "(claimed_at IS NULL AND claimed_by IS NULL) "
    "OR (claimed_at IS NOT NULL AND claimed_by IS NOT NULL)"
)
_CLEAR_RANGE_CHECK = "start_time IS NULL OR end_time IS NULL OR start_time < end_time"
_SQLITE_TRACE_ROWID_STATE_KEY = "traces.sqlite_max_rowid"


@contextmanager
def _preserve_sqlite_sequence(table_name: str) -> Iterator[None]:
    """Keep the AUTOINCREMENT high-water mark across a SQLite table rebuild."""
    connection = op.get_bind()
    if connection.dialect.name != "sqlite":
        yield
        return
    sequence = connection.execute(
        sa.text("SELECT seq FROM sqlite_sequence WHERE name = :name"),
        {"name": table_name},
    ).scalar()
    yield
    if sequence is None:
        return
    parameters = {"name": table_name, "sequence": sequence}
    result = connection.execute(
        sa.text(
            "UPDATE sqlite_sequence SET seq = MAX(COALESCE(seq, 0), :sequence) WHERE name = :name"
        ),
        parameters,
    )
    if not result.rowcount:
        connection.execute(
            sa.text("INSERT INTO sqlite_sequence (name, seq) VALUES (:name, :sequence)"),
            parameters,
        )


def _upgrade_projects() -> None:
    # A tombstoned project's id stays referenced by its cleanup task, so SQLite
    # must never hand that id to a new project.
    with op.batch_alter_table("projects", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        batch_op.add_column(
            sa.Column(
                "kind",
                sa.String(),
                nullable=False,
                server_default="STANDARD",
            )
        )
        batch_op.add_column(sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
        batch_op.create_check_constraint("valid_project_kind", _PROJECT_KIND_CHECK)
        batch_op.drop_constraint("uq_projects_name", type_="unique")

    op.execute("UPDATE projects SET kind = 'PLAYGROUND' WHERE name = 'playground'")
    op.execute(
        "UPDATE projects SET kind = 'EVALUATOR' "
        "WHERE id IN ("
        "SELECT project_id FROM dataset_evaluators "
        "UNION "
        "SELECT trace_project_id FROM project_evaluators"
        ")"
    )
    is_sqlite = op.get_bind().dialect.name == "sqlite"
    generated_experiment_name_pred = (
        "(LENGTH(projects.name) = 35 "
        "AND SUBSTR(projects.name, 1, 11) = 'Experiment-' "
        "AND NOT SUBSTR(projects.name, 12) GLOB '*[^0-9a-f]*')"
        if is_sqlite
        else "projects.name ~ '^Experiment-[0-9a-f]{24}$'"
    )
    op.execute(
        "UPDATE projects SET kind = 'EXPERIMENT' "
        "WHERE kind = 'STANDARD' "
        "AND name NOT IN ('default', 'playground') "
        "AND EXISTS ("
        "SELECT 1 FROM experiments "
        "WHERE experiments.project_name = projects.name "
        "AND ("
        f"{generated_experiment_name_pred} "
        "OR EXISTS ("
        "SELECT 1 FROM experiment_runs er "
        "JOIN traces t ON t.trace_id = er.trace_id "
        "WHERE er.experiment_id = experiments.id AND t.project_rowid = projects.id"
        ")"
        ")"
        ") "
        "AND NOT EXISTS ("
        "SELECT 1 FROM project_evaluators WHERE project_evaluators.project_id = projects.id"
        ") "
        "AND NOT EXISTS ("
        "SELECT 1 FROM traces t "
        "LEFT JOIN experiment_runs er ON er.trace_id = t.trace_id "
        "WHERE t.project_rowid = projects.id AND er.id IS NULL"
        ")"
    )

    op.create_index(
        "ix_projects_live_name",
        "projects",
        ["name"],
        unique=True,
        postgresql_where=sa.text(_LIVE_PREDICATE),
        sqlite_where=sa.text(_LIVE_PREDICATE),
    )
    op.create_index(
        "ix_projects_active_kind_id",
        "projects",
        ["kind", "id"],
        postgresql_where=sa.text(_LIVE_PREDICATE),
        sqlite_where=sa.text(_LIVE_PREDICATE),
    )


def _upgrade_historical_project_references() -> None:
    is_sqlite = op.get_bind().dialect.name == "sqlite"
    experiment_time_pred = (
        "julianday(p.created_at) <= julianday(experiments.created_at)"
        if is_sqlite
        else "p.created_at <= experiments.created_at"
    )
    agent_session_time_pred = (
        "julianday(p.created_at) <= julianday(agent_sessions.updated_at) + (5.0 / 86400.0)"
        if is_sqlite
        else "p.created_at <= agent_sessions.updated_at + INTERVAL '5 seconds'"
    )

    op.drop_index("ix_experiments_ephemeral_updated_at", table_name="experiments")
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.add_column(
            sa.Column(
                "project_id",
                _Integer,
                sa.ForeignKey("projects.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
    op.create_index(
        "ix_experiments_ephemeral_updated_at",
        "experiments",
        ["updated_at"],
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )
    op.create_index("ix_experiments_project_id", "experiments", ["project_id"])
    op.execute(
        "UPDATE experiments "
        "SET project_id = ("
        "SELECT p.id FROM projects p "
        "WHERE p.name = experiments.project_name "
        "AND ("
        "p.name = 'playground' "
        f"OR {experiment_time_pred} "
        "OR EXISTS ("
        "SELECT 1 FROM experiment_runs er "
        "JOIN traces t ON t.trace_id = er.trace_id "
        "WHERE er.experiment_id = experiments.id AND t.project_rowid = p.id"
        ")"
        ")"
        ") "
        "WHERE project_name IS NOT NULL"
    )

    op.drop_index("ix_agent_sessions_user_id_updated_at", table_name="agent_sessions")
    op.drop_index("ix_agent_sessions_ephemeral_updated_at", table_name="agent_sessions")
    with (
        _preserve_sqlite_sequence("agent_sessions"),
        op.batch_alter_table(
            "agent_sessions", table_kwargs={"sqlite_autoincrement": True}
        ) as batch_op,
    ):
        batch_op.add_column(
            sa.Column(
                "project_id",
                _Integer,
                sa.ForeignKey("projects.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.add_column(
            sa.Column(
                "project_was_bound",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
    op.create_index(
        "ix_agent_sessions_user_id_updated_at",
        "agent_sessions",
        ["user_id", sa.column("updated_at").desc()],
    )
    op.create_index(
        "ix_agent_sessions_ephemeral_updated_at",
        "agent_sessions",
        ["updated_at"],
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )
    op.create_index("ix_agent_sessions_project_id", "agent_sessions", ["project_id"])
    op.execute(
        "UPDATE agent_sessions "
        "SET project_id = ("
        "SELECT p.id FROM projects p "
        "WHERE p.name = agent_sessions.project_name "
        f"AND {agent_session_time_pred}"
        ")"
    )
    op.execute("UPDATE agent_sessions SET project_was_bound = TRUE WHERE project_id IS NOT NULL")


def _upgrade_evaluator_bindings() -> None:
    with op.batch_alter_table(
        "project_evaluators", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
        batch_op.alter_column("evaluator_id", existing_type=_Integer, nullable=True)
        batch_op.drop_constraint(
            "fk_project_evaluators_evaluator_id_evaluators", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_project_evaluators_evaluator_id_evaluators",
            "evaluators",
            ["evaluator_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_constraint("uq_project_evaluators_project_id_name", type_="unique")
        batch_op.create_check_constraint("valid_lifecycle", _PROJECT_EVALUATOR_LIFECYCLE_CHECK)
    op.create_index(
        "ix_project_evaluators_live_name",
        "project_evaluators",
        ["project_id", "name"],
        unique=True,
        postgresql_where=sa.text(_LIVE_PREDICATE),
        sqlite_where=sa.text(_LIVE_PREDICATE),
    )

    with op.batch_alter_table(
        "dataset_evaluators", table_kwargs={"sqlite_autoincrement": True}
    ) as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
        batch_op.alter_column("dataset_id", existing_type=_Integer, nullable=True)
        batch_op.alter_column("evaluator_id", existing_type=_Integer, nullable=True)
        batch_op.drop_constraint("fk_dataset_evaluators_dataset_id_datasets", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_dataset_evaluators_dataset_id_datasets",
            "datasets",
            ["dataset_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_constraint(
            "fk_dataset_evaluators_evaluator_id_evaluators", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_dataset_evaluators_evaluator_id_evaluators",
            "evaluators",
            ["evaluator_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_constraint("uq_dataset_evaluators_dataset_id_name", type_="unique")
        batch_op.create_check_constraint("valid_lifecycle", _DATASET_EVALUATOR_LIFECYCLE_CHECK)
    op.create_index(
        "ix_dataset_evaluators_dataset_id",
        "dataset_evaluators",
        ["dataset_id"],
    )
    op.create_index(
        "ix_dataset_evaluators_live_name",
        "dataset_evaluators",
        ["dataset_id", "name"],
        unique=True,
        postgresql_where=sa.text(_LIVE_PREDICATE),
        sqlite_where=sa.text(_LIVE_PREDICATE),
    )


def _create_cleanup_task_tables() -> None:
    op.create_table(
        "cleanup_tasks",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint(_CLEANUP_TASK_KIND_CHECK, name="valid_cleanup_task_kind"),
            nullable=False,
        ),
        sa.Column("claimed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("claimed_by", sa.String(), nullable=True),
        sa.Column("available_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("failure_count", _Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.UniqueConstraint("kind", "id"),
        sa.CheckConstraint(_CLAIM_CHECK, name="valid_claim"),
        sqlite_autoincrement=True,
    )
    op.create_index(
        "ix_cleanup_tasks_eligible",
        "cleanup_tasks",
        ["available_at", "id"],
        postgresql_where=sa.text(_UNCLAIMED_PREDICATE),
        sqlite_where=sa.text(_UNCLAIMED_PREDICATE),
    )
    op.create_index(
        "ix_cleanup_tasks_claimed",
        "cleanup_tasks",
        ["claimed_at", "id"],
        postgresql_where=sa.text(_CLAIMED_PREDICATE),
        sqlite_where=sa.text(_CLAIMED_PREDICATE),
    )

    op.create_table(
        "project_delete_cleanup_tasks",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint("kind = 'DELETE_PROJECT'", name="valid_cleanup_task_kind"),
            server_default="DELETE_PROJECT",
            nullable=False,
        ),
        sa.Column(
            "project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["cleanup_tasks.kind", "cleanup_tasks.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "project_clear_cleanup_tasks",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint("kind = 'CLEAR_PROJECT_TRACES'", name="valid_cleanup_task_kind"),
            server_default="CLEAR_PROJECT_TRACES",
            nullable=False,
        ),
        sa.Column(
            "project_id",
            _Integer,
            sa.ForeignKey("projects.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "max_trace_rowid",
            _Integer,
            sa.CheckConstraint("max_trace_rowid >= 0", name="nonnegative_max_trace_rowid"),
            nullable=False,
        ),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.CheckConstraint(_CLEAR_RANGE_CHECK, name="valid_range"),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["cleanup_tasks.kind", "cleanup_tasks.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "project_evaluator_cleanup_tasks",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint("kind = 'DELETE_PROJECT_EVALUATOR'", name="valid_cleanup_task_kind"),
            server_default="DELETE_PROJECT_EVALUATOR",
            nullable=False,
        ),
        sa.Column(
            "project_evaluator_id",
            _Integer,
            sa.ForeignKey("project_evaluators.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["cleanup_tasks.kind", "cleanup_tasks.id"],
            ondelete="CASCADE",
        ),
    )

    op.create_table(
        "dataset_evaluator_cleanup_tasks",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "kind",
            sa.String(),
            sa.CheckConstraint("kind = 'DELETE_DATASET_EVALUATOR'", name="valid_cleanup_task_kind"),
            server_default="DELETE_DATASET_EVALUATOR",
            nullable=False,
        ),
        sa.Column(
            "dataset_evaluator_id",
            _Integer,
            sa.ForeignKey("dataset_evaluators.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.ForeignKeyConstraint(
            ["kind", "id"],
            ["cleanup_tasks.kind", "cleanup_tasks.id"],
            ondelete="CASCADE",
        ),
    )


def _backfill_code_evaluator_task_snapshots() -> None:
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            """
            WITH resolved AS (
                SELECT
                    t.id AS task_id,
                    v.id AS version_id,
                    ce.sandbox_config_id AS sandbox_config_id,
                    ce.language AS language,
                    e.name AS name,
                    e.description AS description,
                    v.source_code AS source_code,
                    (
                        SELECT json_group_array(json(elem.value))
                        FROM json_each(ce.output_configs) AS elem
                        WHERE json_extract(elem.value, '$.name') IS NOT NULL
                    ) AS output_configs_json
                FROM experiment_evaluator_tasks t
                JOIN code_evaluators ce
                    ON ce.id = CAST(json_extract(t.definition, '$.code_evaluator_id') AS INTEGER)
                JOIN evaluators e ON e.id = ce.id
                JOIN code_evaluator_code_versions v
                    ON v.code_evaluator_id = ce.id
                    AND v.id = COALESCE(
                        (
                            SELECT v1.id
                            FROM code_evaluator_code_versions v1
                            WHERE v1.code_evaluator_id = ce.id
                              AND v1.id = CAST(
                                  json_extract(t.definition, '$.code_evaluator_version_id')
                                  AS INTEGER
                              )
                        ),
                        (
                            SELECT v2.id
                            FROM code_evaluator_code_versions v2
                            WHERE v2.code_evaluator_id = ce.id
                            ORDER BY v2.id DESC
                            LIMIT 1
                        )
                    )
                WHERE json_extract(t.definition, '$.type') = 'code_evaluator'
            )
            UPDATE experiment_evaluator_tasks
            SET definition = (
                SELECT json_set(
                    experiment_evaluator_tasks.definition,
                    '$.code_evaluator_version_id',
                    COALESCE(
                        CAST(
                            json_extract(
                                experiment_evaluator_tasks.definition,
                                '$.code_evaluator_version_id'
                            ) AS INTEGER
                        ),
                        r.version_id
                    ),
                    '$.sandbox_config_id',
                    COALESCE(
                        CAST(
                            json_extract(
                                experiment_evaluator_tasks.definition,
                                '$.sandbox_config_id'
                            ) AS INTEGER
                        ),
                        r.sandbox_config_id
                    ),
                    '$.language',
                    COALESCE(
                        json_extract(experiment_evaluator_tasks.definition, '$.language'),
                        r.language
                    ),
                    '$.name',
                    COALESCE(
                        json_extract(experiment_evaluator_tasks.definition, '$.name'),
                        r.name
                    ),
                    '$.description',
                    COALESCE(
                        json_extract(experiment_evaluator_tasks.definition, '$.description'),
                        r.description
                    ),
                    '$.source_code',
                    COALESCE(
                        json_extract(experiment_evaluator_tasks.definition, '$.source_code'),
                        r.source_code
                    ),
                    '$.output_configs',
                    json(
                        CASE
                            WHEN json_type(
                                experiment_evaluator_tasks.definition, '$.output_configs'
                            ) IS NOT NULL
                            AND json_type(
                                experiment_evaluator_tasks.definition, '$.output_configs'
                            ) <> 'null'
                            THEN json_extract(
                                experiment_evaluator_tasks.definition, '$.output_configs'
                            )
                            ELSE r.output_configs_json
                        END
                    )
                )
                FROM resolved r
                WHERE r.task_id = experiment_evaluator_tasks.id
            )
            WHERE id IN (SELECT task_id FROM resolved)
            """
        )
    else:
        op.execute(
            """
            WITH resolved AS (
                SELECT
                    t.id AS task_id,
                    v.id AS version_id,
                    ce.sandbox_config_id AS sandbox_config_id,
                    ce.language AS language,
                    e.name AS name,
                    e.description AS description,
                    v.source_code AS source_code,
                    COALESCE(
                        (
                            SELECT jsonb_agg(elem)
                            FROM jsonb_array_elements(ce.output_configs) AS elem
                            WHERE elem->>'name' IS NOT NULL
                        ),
                        '[]'::jsonb
                    ) AS output_configs_json
                FROM experiment_evaluator_tasks t
                JOIN code_evaluators ce
                    ON ce.id = NULLIF(t.definition->>'code_evaluator_id', '')::bigint
                JOIN evaluators e ON e.id = ce.id
                JOIN code_evaluator_code_versions v
                    ON v.code_evaluator_id = ce.id
                    AND v.id = COALESCE(
                        (
                            SELECT v1.id
                            FROM code_evaluator_code_versions v1
                            WHERE v1.code_evaluator_id = ce.id
                              AND v1.id = NULLIF(
                                  t.definition->>'code_evaluator_version_id', ''
                              )::bigint
                        ),
                        (
                            SELECT v2.id
                            FROM code_evaluator_code_versions v2
                            WHERE v2.code_evaluator_id = ce.id
                            ORDER BY v2.id DESC
                            LIMIT 1
                        )
                    )
                WHERE t.definition->>'type' = 'code_evaluator'
            )
            UPDATE experiment_evaluator_tasks t
            SET definition = t.definition || jsonb_build_object(
                'code_evaluator_version_id',
                COALESCE(
                    NULLIF(t.definition->>'code_evaluator_version_id', '')::bigint,
                    r.version_id
                ),
                'sandbox_config_id',
                COALESCE(
                    NULLIF(t.definition->>'sandbox_config_id', '')::bigint,
                    r.sandbox_config_id
                ),
                'language',
                COALESCE(t.definition->>'language', r.language),
                'name',
                COALESCE(t.definition->>'name', r.name),
                'description',
                COALESCE(t.definition->>'description', r.description),
                'source_code',
                COALESCE(t.definition->>'source_code', r.source_code),
                'output_configs',
                CASE
                    WHEN t.definition->'output_configs' IS NOT NULL
                         AND jsonb_typeof(t.definition->'output_configs') <> 'null'
                    THEN t.definition->'output_configs'
                    ELSE r.output_configs_json
                END
            )
            FROM resolved r
            WHERE t.id = r.task_id
            """
        )


def _strip_code_evaluator_task_snapshots() -> None:
    if op.get_bind().dialect.name == "sqlite":
        op.execute(
            "UPDATE experiment_evaluator_tasks "
            "SET definition = json_remove("
            "definition, '$.name', '$.description', '$.source_code', '$.output_configs'"
            ") "
            "WHERE json_extract(definition, '$.type') = 'code_evaluator'"
        )
    else:
        op.execute(
            "UPDATE experiment_evaluator_tasks "
            "SET definition = definition "
            "- 'name' - 'description' - 'source_code' - 'output_configs' "
            "WHERE definition->>'type' = 'code_evaluator'"
        )


def upgrade() -> None:
    _upgrade_projects()
    _upgrade_historical_project_references()
    _upgrade_evaluator_bindings()
    _backfill_code_evaluator_task_snapshots()
    _create_cleanup_task_tables()
    connection = op.get_bind()
    if connection.dialect.name == "sqlite":
        max_trace_id = int(
            connection.scalar(sa.text("SELECT COALESCE(MAX(id), 0) FROM traces")) or 0
        )
        if max_trace_id > 0:
            connection.execute(
                sa.text(
                    "INSERT INTO system_state (key, value) "
                    "VALUES (:key, json_object('max_id', :max_id)) "
                    "ON CONFLICT (key) DO UPDATE SET value = json_object('max_id', :max_id)"
                ),
                {"key": _SQLITE_TRACE_ROWID_STATE_KEY, "max_id": max_trace_id},
            )


def downgrade() -> None:
    connection = op.get_bind()
    for table in ("projects", "project_evaluators", "dataset_evaluators"):
        if connection.scalar(sa.text(f"SELECT COUNT(*) FROM {table} WHERE deleted_at IS NOT NULL")):
            raise ValueError(
                f"Cannot downgrade while {table} has deleted rows awaiting background cleanup; "
                "run the server until cleanup tasks drain first."
            )
    if connection.scalar(sa.text("SELECT COUNT(*) FROM cleanup_tasks")):
        raise ValueError(
            "Cannot downgrade while cleanup_tasks has pending rows; "
            "run the server until cleanup tasks drain first."
        )
    missing_code_evaluator_sql = (
        "SELECT COUNT(*) "
        "FROM experiment_evaluator_tasks t "
        "LEFT JOIN code_evaluators ce "
        "ON ce.id = CAST(json_extract(t.definition, '$.code_evaluator_id') AS INTEGER) "
        "WHERE json_extract(t.definition, '$.type') = 'code_evaluator' AND ce.id IS NULL"
        if connection.dialect.name == "sqlite"
        else "SELECT COUNT(*) "
        "FROM experiment_evaluator_tasks t "
        "LEFT JOIN code_evaluators ce "
        "ON ce.id = NULLIF(t.definition->>'code_evaluator_id', '')::bigint "
        "WHERE t.definition->>'type' = 'code_evaluator' AND ce.id IS NULL"
    )
    if connection.scalar(sa.text(missing_code_evaluator_sql)):
        raise ValueError(
            "Cannot downgrade because experiment_evaluator_tasks references a "
            "code_evaluators definition that was already garbage-collected."
        )
    _strip_code_evaluator_task_snapshots()
    if connection.dialect.name == "sqlite":
        connection.execute(
            sa.text("DELETE FROM system_state WHERE key = :key"),
            {"key": _SQLITE_TRACE_ROWID_STATE_KEY},
        )

    op.drop_table("dataset_evaluator_cleanup_tasks")
    op.drop_table("project_evaluator_cleanup_tasks")
    op.drop_table("project_clear_cleanup_tasks")
    op.drop_table("project_delete_cleanup_tasks")
    op.drop_index("ix_cleanup_tasks_claimed", table_name="cleanup_tasks")
    op.drop_index("ix_cleanup_tasks_eligible", table_name="cleanup_tasks")
    op.drop_table("cleanup_tasks")

    op.drop_index("ix_dataset_evaluators_live_name", table_name="dataset_evaluators")
    op.drop_index("ix_dataset_evaluators_dataset_id", table_name="dataset_evaluators")
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.drop_constraint("valid_lifecycle", type_="check")
        batch_op.drop_constraint(
            "fk_dataset_evaluators_evaluator_id_evaluators", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_dataset_evaluators_evaluator_id_evaluators",
            "evaluators",
            ["evaluator_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.drop_constraint("fk_dataset_evaluators_dataset_id_datasets", type_="foreignkey")
        batch_op.create_foreign_key(
            "fk_dataset_evaluators_dataset_id_datasets",
            "datasets",
            ["dataset_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.alter_column("evaluator_id", existing_type=_Integer, nullable=False)
        batch_op.alter_column("dataset_id", existing_type=_Integer, nullable=False)
        batch_op.drop_column("deleted_at")
        batch_op.create_unique_constraint(
            "uq_dataset_evaluators_dataset_id_name", ["dataset_id", "name"]
        )

    op.drop_index("ix_project_evaluators_live_name", table_name="project_evaluators")
    with op.batch_alter_table("project_evaluators") as batch_op:
        batch_op.drop_constraint("valid_lifecycle", type_="check")
        batch_op.drop_constraint(
            "fk_project_evaluators_evaluator_id_evaluators", type_="foreignkey"
        )
        batch_op.create_foreign_key(
            "fk_project_evaluators_evaluator_id_evaluators",
            "evaluators",
            ["evaluator_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.alter_column("evaluator_id", existing_type=_Integer, nullable=False)
        batch_op.drop_column("deleted_at")
        batch_op.create_unique_constraint(
            "uq_project_evaluators_project_id_name", ["project_id", "name"]
        )

    op.drop_index("ix_agent_sessions_project_id", table_name="agent_sessions")
    op.drop_index("ix_agent_sessions_user_id_updated_at", table_name="agent_sessions")
    op.drop_index("ix_agent_sessions_ephemeral_updated_at", table_name="agent_sessions")
    with (
        _preserve_sqlite_sequence("agent_sessions"),
        op.batch_alter_table(
            "agent_sessions", table_kwargs={"sqlite_autoincrement": True}
        ) as batch_op,
    ):
        batch_op.drop_column("project_was_bound")
        batch_op.drop_column("project_id")
    op.create_index(
        "ix_agent_sessions_user_id_updated_at",
        "agent_sessions",
        ["user_id", sa.column("updated_at").desc()],
    )
    op.create_index(
        "ix_agent_sessions_ephemeral_updated_at",
        "agent_sessions",
        ["updated_at"],
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )

    op.drop_index("ix_experiments_project_id", table_name="experiments")
    op.drop_index("ix_experiments_ephemeral_updated_at", table_name="experiments")
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.drop_column("project_id")
    op.create_index(
        "ix_experiments_ephemeral_updated_at",
        "experiments",
        ["updated_at"],
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )

    op.drop_index("ix_projects_active_kind_id", table_name="projects")
    op.drop_index("ix_projects_live_name", table_name="projects")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_constraint("valid_project_kind", type_="check")
        batch_op.drop_column("deleted_at")
        batch_op.drop_column("kind")
        batch_op.create_unique_constraint("uq_projects_name", ["name"])
