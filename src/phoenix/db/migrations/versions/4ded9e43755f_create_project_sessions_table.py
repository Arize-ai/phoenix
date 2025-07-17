"""create project_session table

Revision ID: 4ded9e43755f
Revises: cd164e83824f
Create Date: 2024-10-08 22:53:24.539786

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4ded9e43755f"
down_revision: Union[str, None] = "cd164e83824f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("session_id", sa.String, unique=True, nullable=False),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "start_time",
            sa.TIMESTAMP(timezone=True),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "end_time",
            sa.TIMESTAMP(timezone=True),
            index=True,
            nullable=False,
        ),
    )
    with op.batch_alter_table("traces") as batch_op:
        batch_op.add_column(
            sa.Column(
                "project_session_rowid",
                sa.Integer,
                sa.ForeignKey("project_sessions.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
    op.create_index(
        "ix_traces_project_session_rowid",
        "traces",
        ["project_session_rowid"],
    )


def downgrade() -> None:
    op.drop_index("ix_traces_project_session_rowid")
    with op.batch_alter_table("traces") as batch_op:
        batch_op.drop_column("project_session_rowid")
    op.drop_table("project_sessions")
