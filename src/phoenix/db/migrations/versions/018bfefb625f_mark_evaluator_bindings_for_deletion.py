"""mark evaluator bindings for deletion

Deleting a dataset or project evaluator now sets ``deleted_at`` on its binding, and a
background purger removes the binding and everything it owns later. A flagged binding
gives up its name at once, so the per-dataset and per-project name constraints become
unique indexes over unflagged rows only.

Revision ID: 018bfefb625f
Revises: 00eb0d0a5db9
Create Date: 2026-11-09 16:44:15.181128

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018bfefb625f"
down_revision: Union[str, None] = "00eb0d0a5db9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_BINDINGS = (
    ("dataset_evaluators", "dataset_id", "project_id"),
    ("project_evaluators", "project_id", "trace_project_id"),
)


def upgrade() -> None:
    for table, scope_column, _ in _BINDINGS:
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True))
            batch_op.add_column(
                sa.Column(
                    "delete_unused_evaluator",
                    sa.Boolean,
                    nullable=False,
                    server_default=sa.false(),
                )
            )
            batch_op.add_column(
                sa.Column(
                    "delete_associated_prompt",
                    sa.Boolean,
                    nullable=False,
                    server_default=sa.false(),
                )
            )
            batch_op.drop_constraint(f"uq_{table}_{scope_column}_name", type_="unique")
            batch_op.create_index(
                f"ix_{table}_{scope_column}_name",
                [scope_column, "name"],
                unique=True,
                postgresql_where=sa.text("deleted_at IS NULL"),
                sqlite_where=sa.text("deleted_at IS NULL"),
            )
            batch_op.create_index(
                f"ix_{table}_deleted_at",
                ["deleted_at"],
                postgresql_where=sa.text("deleted_at IS NOT NULL"),
                sqlite_where=sa.text("deleted_at IS NOT NULL"),
            )


def downgrade() -> None:
    connection = op.get_bind()
    # Flagged bindings would collide with the restored name constraints, so drop them
    # along with the trace projects they own.
    for table, _, trace_project_column in _BINDINGS:
        trace_project_ids = list(
            connection.execute(
                sa.text(f"SELECT {trace_project_column} FROM {table} WHERE deleted_at IS NOT NULL")
            ).scalars()
        )
        connection.execute(sa.text(f"DELETE FROM {table} WHERE deleted_at IS NOT NULL"))
        if trace_project_ids:
            connection.execute(
                sa.text("DELETE FROM projects WHERE id IN :ids").bindparams(
                    sa.bindparam("ids", expanding=True)
                ),
                {"ids": trace_project_ids},
            )
    for table, scope_column, _ in _BINDINGS:
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f"ix_{table}_deleted_at")
            batch_op.drop_index(f"ix_{table}_{scope_column}_name")
            batch_op.create_unique_constraint(
                f"uq_{table}_{scope_column}_name", [scope_column, "name"]
            )
            batch_op.drop_column("delete_associated_prompt")
            batch_op.drop_column("delete_unused_evaluator")
            batch_op.drop_column("deleted_at")
