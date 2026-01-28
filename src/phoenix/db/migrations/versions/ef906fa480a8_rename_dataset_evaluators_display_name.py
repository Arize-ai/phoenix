"""Rename dataset_evaluators display_name column to name

Revision ID: ef906fa480a8
Revises: a1b2c3d4e5f6
Create Date: 2026-01-27

This migration renames the `display_name` column to `name` in the dataset_evaluators
table for existing databases. Fresh databases created after commit 1e9b94cda already
have the column named `name`, so this migration checks for the old column name first.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "ef906fa480a8"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if the old column name exists before attempting rename
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        # PostgreSQL: Check if column exists
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'dataset_evaluators' AND column_name = 'display_name'
                """
            )
        )
        has_old_column = result.fetchone() is not None
    else:
        # SQLite: Check pragma for column info
        result = conn.execute(text("PRAGMA table_info(dataset_evaluators)"))
        columns = [row[1] for row in result.fetchall()]
        has_old_column = "display_name" in columns

    if has_old_column:
        # Rename the column
        with op.batch_alter_table("dataset_evaluators") as batch_op:
            batch_op.alter_column("display_name", new_column_name="name")


def downgrade() -> None:
    # Check if the new column name exists before attempting rename back
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        result = conn.execute(
            text(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'dataset_evaluators' AND column_name = 'name'
                """
            )
        )
        has_new_column = result.fetchone() is not None
    else:
        result = conn.execute(text("PRAGMA table_info(dataset_evaluators)"))
        columns = [row[1] for row in result.fetchall()]
        has_new_column = "name" in columns

    if has_new_column:
        with op.batch_alter_table("dataset_evaluators") as batch_op:
            batch_op.alter_column("name", new_column_name="display_name")
