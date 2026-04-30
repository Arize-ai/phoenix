"""increase sandbox_configs timeout server_default from 30 to 300

Revision ID: 9a7a47b0dc5c
Revises: 0ff41b5b118f
Create Date: 2026-04-23 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9a7a47b0dc5c"
down_revision: Union[str, None] = "0ff41b5b118f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("sandbox_configs") as batch_op:
        batch_op.alter_column(
            "timeout",
            server_default=sa.text("300"),
            existing_type=sa.Integer(),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("sandbox_configs") as batch_op:
        batch_op.alter_column(
            "timeout",
            server_default=sa.text("30"),
            existing_type=sa.Integer(),
            existing_nullable=False,
        )
