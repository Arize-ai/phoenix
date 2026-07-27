"""create agent session runs

Revision ID: 2961f19cccd8
Revises: e767d3c57f32
Create Date: 2026-07-27 12:04:55.895420

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2961f19cccd8"
down_revision: Union[str, None] = "e767d3c57f32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    agent_session_id_type = sa.Integer().with_variant(sa.BigInteger(), "postgresql")
    op.create_table(
        "agent_session_runs",
        sa.Column(
            "agent_session_id",
            agent_session_id_type,
            sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("turn_id", sa.String(), nullable=False),
        sa.Column("state", sa.String(), nullable=False),
        sa.Column("assistant_message_id", sa.String(), nullable=True),
        sa.Column("origin_client_id", sa.String(), nullable=True),
        sa.Column("instance_id", sa.String(), nullable=False),
        sa.Column("stop_requested_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("heartbeat_at", sa.TIMESTAMP(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_agent_session_runs_heartbeat_at",
        "agent_session_runs",
        ["heartbeat_at"],
    )


def downgrade() -> None:
    op.drop_table("agent_session_runs")
