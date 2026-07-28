"""add turn lock columns to agent sessions

Revision ID: b50cc49c3e96
Revises: e767d3c57f32
Create Date: 2026-07-28 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b50cc49c3e96"
down_revision: Union[str, None] = "e767d3c57f32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("agent_sessions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "turn_lock_acquired_at",
                sa.TIMESTAMP(timezone=True),
                nullable=True,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "turn_lock_heartbeat_at",
                sa.TIMESTAMP(timezone=True),
                nullable=True,
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("agent_sessions") as batch_op:
        batch_op.drop_column("turn_lock_heartbeat_at")
        batch_op.drop_column("turn_lock_acquired_at")
