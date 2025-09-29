"""add user_id on dataset_versions

Revision ID: ab513d89518b
Revises: 01a8342c9cdf
Create Date: 2025-09-26 11:00:06.961920

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ab513d89518b"
down_revision: Union[str, None] = "01a8342c9cdf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)


def upgrade() -> None:
    with op.batch_alter_table("dataset_versions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                _Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("dataset_versions") as batch_op:
        batch_op.drop_column("user_id")
