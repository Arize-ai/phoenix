"""Add account lockout fields and password history table.

Adds failed_login_attempts and locked_until columns to the users table
for account lockout after repeated failed login attempts, and creates
a password_history table to prevent password reuse.

Revision ID: b187e4724ede
Revises: f1a6b2f0c9d5
Create Date: 2026-02-25 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b187e4724ede"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add account lockout columns to users table
    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        batch_op.add_column(
            sa.Column(
                "failed_login_attempts",
                sa.Integer(),
                nullable=False,
                server_default="0",
            )
        )
        batch_op.add_column(
            sa.Column(
                "locked_until",
                sa.TIMESTAMP(timezone=True),
                nullable=True,
            )
        )

    # Create password_history table
    op.create_table(
        "password_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("password_hash", sa.LargeBinary(), nullable=False),
        sa.Column("password_salt", sa.LargeBinary(), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sqlite_autoincrement=True,
    )
    op.create_index("ix_password_history_user_id", "password_history", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_password_history_user_id", "password_history")
    op.drop_table("password_history")

    with op.batch_alter_table("users", table_kwargs={"sqlite_autoincrement": True}) as batch_op:
        batch_op.drop_column("locked_until")
        batch_op.drop_column("failed_login_attempts")
