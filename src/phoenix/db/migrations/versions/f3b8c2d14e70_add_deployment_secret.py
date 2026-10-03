"""add deployment secret

Revision ID: f3b8c2d14e70
Revises: ac59da3e4035
Create Date: 2026-10-01 20:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f3b8c2d14e70"
down_revision: Union[str, None] = "ac59da3e4035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deployment_secret",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("seed", sa.LargeBinary(), nullable=False),
        sa.CheckConstraint("id = 1", name="singleton"),
    )


def downgrade() -> None:
    op.drop_table("deployment_secret")
