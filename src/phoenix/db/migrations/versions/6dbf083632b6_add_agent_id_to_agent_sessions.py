"""add agent id to agent sessions

Revision ID: 6dbf083632b6
Revises: e767d3c57f32
Create Date: 2026-07-16 20:12:22.231027

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6dbf083632b6"
down_revision: Union[str, None] = "e767d3c57f32"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("agent_sessions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "agent_id",
                sa.String(),
                nullable=False,
                server_default="assistant",
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("agent_sessions") as batch_op:
        batch_op.drop_column("agent_id")
