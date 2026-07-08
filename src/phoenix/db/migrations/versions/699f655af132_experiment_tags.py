"""experiment_tags

Revision ID: 699f655af132
Revises: d0690a79ea51
Create Date: 2025-09-05 13:14:22.676233

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "699f655af132"
down_revision: Union[str, None] = "d0690a79ea51"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)


def upgrade() -> None:
    op.create_table(
        "experiment_tags",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "experiment_id",
            _Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dataset_id",
            _Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.UniqueConstraint("dataset_id", "name"),
    )


def downgrade() -> None:
    op.drop_table("experiment_tags")
