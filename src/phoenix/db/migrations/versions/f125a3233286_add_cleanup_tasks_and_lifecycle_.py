"""add cleanup tasks and lifecycle tombstones

Revision ID: f125a3233286
Revises: e724eb2ee5cf
Create Date: 2026-11-16 00:24:34.041181

"""

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

_CLEANUP_TASK_KIND_CHECK = (
    "kind IN ('DELETE_PROJECT', 'DELETE_PROJECT_EVALUATOR', 'DELETE_DATASET_EVALUATOR')"
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


def _upgrade_projects() -> None:
    # A tombstoned project's id stays referenced by its cleanup task, so SQLite
    # must never hand that id to a new project.
    with op.batch_alter_table("projects", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        batch_op.add_column(sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
        batch_op.drop_constraint("uq_projects_name", type_="unique")

    op.create_index(
        "ix_projects_live_name",
        "projects",
        ["name"],
        unique=True,
        postgresql_where=sa.text(_LIVE_PREDICATE),
        sqlite_where=sa.text(_LIVE_PREDICATE),
    )


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
    _upgrade_evaluator_bindings()
    _backfill_code_evaluator_task_snapshots()
    _create_cleanup_task_tables()


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

    op.drop_table("dataset_evaluator_cleanup_tasks")
    op.drop_table("project_evaluator_cleanup_tasks")
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

    op.drop_index("ix_projects_live_name", table_name="projects")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.create_unique_constraint("uq_projects_name", ["name"])
