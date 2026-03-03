"""add is_ephemeral to experiments

Revision ID: 9c5c1f6bd0d2
Revises: f1a6b2f0c9d5
Create Date: 2026-03-02 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c5c1f6bd0d2"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_ephemeral",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            ),
        )
    op.create_index(
        "ix_experiments_ephemeral_created_at",
        "experiments",
        ["created_at"],
        unique=False,
        if_not_exists=True,
        postgresql_where=sa.text("is_ephemeral IS TRUE"),
        sqlite_where=sa.text("is_ephemeral IS TRUE"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_experiments_ephemeral_created_at",
        table_name="experiments",
        if_exists=True,
    )
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.drop_column("is_ephemeral")
