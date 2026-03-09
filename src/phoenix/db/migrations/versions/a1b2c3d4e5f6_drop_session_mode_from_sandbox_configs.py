"""drop session_mode from sandbox_configs

Revision ID: a1b2c3d4e5f6
Revises: 0ff41b5b118f
Create Date: 2026-03-09 00:00:00.000000

"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "0ff41b5b118f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sandbox_configs") as batch_op:
        batch_op.drop_column("session_mode")


def downgrade() -> None:
    with op.batch_alter_table("sandbox_configs") as batch_op:
        batch_op.add_column(
            sa.Column("session_mode", sa.Boolean, nullable=False, server_default=sa.text("0")),
        )
