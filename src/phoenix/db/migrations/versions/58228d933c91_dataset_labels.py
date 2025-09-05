"""dataset_labels

Revision ID: 58228d933c91
Revises: 699f655af132
Create Date: 2025-09-05 17:47:34.637329

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "58228d933c91"
down_revision: Union[str, None] = "699f655af132"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dataset_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.String, nullable=True),
    )

    op.create_table(
        "dataset_dataset_labels",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_id",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dataset_label_id",
            sa.Integer,
            sa.ForeignKey("dataset_labels.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("description", sa.String, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("dataset_dataset_labels")
    op.drop_table("dataset_labels")
