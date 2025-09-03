"""add dataset splits and crosswalk table

Revision ID: 0d25cd7dee22
Revises: d0690a79ea51
Create Date: 2025-08-31 18:10:50.962341

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)

# revision identifiers, used by Alembic.
revision: str = "0d25cd7dee22"
down_revision: Union[str, None] = "d0690a79ea51"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create dataset_splits table
    op.create_table(
        "dataset_splits",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True, index=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Create crosswalk table: dataset_splits_dataset_examples
    op.create_table(
        "dataset_splits_dataset_examples",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_split_id",
            sa.Integer,
            sa.ForeignKey("dataset_splits.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dataset_example_id",
            sa.Integer,
            sa.ForeignKey("dataset_examples.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.UniqueConstraint(
            "dataset_split_id",
            "dataset_example_id",
        ),
    )

    with op.batch_alter_table("experiments") as batch_op:
        batch_op.add_column(
            sa.Column(
                "dataset_split_id",
                sa.Integer,
                sa.ForeignKey("dataset_splits.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    with op.batch_alter_table("experiments") as batch_op:
        batch_op.drop_column(
            "dataset_split_id",
        )
    op.drop_table("dataset_splits_dataset_examples")
    op.drop_table("dataset_splits")
