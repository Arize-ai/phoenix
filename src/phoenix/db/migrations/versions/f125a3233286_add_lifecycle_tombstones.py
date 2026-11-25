"""add lifecycle tombstones and cleanup failures

Revision ID: f125a3233286
Revises: a7f1c3e9d2b4
Create Date: 2026-11-16 00:24:34.041181

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f125a3233286"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)

_CLEANUP_TARGET_KIND_CHECK = "target_kind IN ('PROJECT', 'PROJECT_EVALUATOR', 'DATASET_EVALUATOR')"
_LIVE_PREDICATE = "deleted_at IS NULL"
_TOMBSTONED_PREDICATE = "deleted_at IS NOT NULL"
_DATASET_EVALUATOR_LIFECYCLE_CHECK = (
    "(deleted_at IS NULL AND dataset_id IS NOT NULL AND evaluator_id IS NOT NULL) "
    "OR (deleted_at IS NOT NULL AND evaluator_id IS NULL)"
)


def _upgrade_projects() -> None:
    # A tombstoned project's id stays referenced by its cleanup state, so SQLite
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
            ondelete="RESTRICT",
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


def _create_tombstone_indexes_and_cleanup_failures() -> None:
    for table in ("projects", "dataset_evaluators"):
        op.create_index(
            f"ix_{table}_tombstoned",
            table,
            ["deleted_at", "id"],
            postgresql_where=sa.text(_TOMBSTONED_PREDICATE),
            sqlite_where=sa.text(_TOMBSTONED_PREDICATE),
        )

    op.create_table(
        "cleanup_failures",
        sa.Column(
            "target_kind",
            sa.String(),
            sa.CheckConstraint(_CLEANUP_TARGET_KIND_CHECK, name="valid_cleanup_target_kind"),
            primary_key=True,
        ),
        sa.Column("target_id", _Integer, primary_key=True, autoincrement=False),
        sa.Column("failure_count", _Integer, nullable=False, server_default="0"),
        sa.Column("retry_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )


def upgrade() -> None:
    _upgrade_projects()
    _upgrade_evaluator_bindings()
    _create_tombstone_indexes_and_cleanup_failures()


def downgrade() -> None:
    if not op.get_context().as_sql:
        connection = op.get_bind()
        for table in ("projects", "dataset_evaluators"):
            if connection.scalar(
                sa.text(f"SELECT COUNT(*) FROM {table} WHERE deleted_at IS NOT NULL")
            ):
                raise ValueError(
                    f"Cannot downgrade while {table} has deleted rows awaiting background "
                    "cleanup; run the server until background cleanup drains first."
                )

    op.drop_table("cleanup_failures")
    for table in ("dataset_evaluators", "projects"):
        op.drop_index(f"ix_{table}_tombstoned", table_name=table)

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

    op.drop_index("ix_projects_live_name", table_name="projects")
    with op.batch_alter_table("projects") as batch_op:
        batch_op.drop_column("deleted_at")
        batch_op.create_unique_constraint("uq_projects_name", ["name"])
