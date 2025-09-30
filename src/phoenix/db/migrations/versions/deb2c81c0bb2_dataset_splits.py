"""dataset_splits

Revision ID: deb2c81c0bb2
Revises: 58228d933c91
Create Date: 2025-09-08 15:50:12.066217

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

_Integer = sa.Integer().with_variant(
    sa.BigInteger(),
    "postgresql",
)


# revision identifiers, used by Alembic.
revision: str = "deb2c81c0bb2"
down_revision: Union[str, None] = "e76cbd66ffc3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create dataset_splits table
    op.create_table(
        "dataset_splits",
        sa.Column("id", _Integer, primary_key=True),
        sa.Column(
            "user_id",
            _Integer,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("color", sa.String, nullable=False),
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
        sa.Column(
            "dataset_split_id",
            _Integer,
            sa.ForeignKey("dataset_splits.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dataset_example_id",
            _Integer,
            sa.ForeignKey("dataset_examples.id", ondelete="CASCADE"),
            nullable=False,
            # index on the second element of the composite primary key
            index=True,
        ),
        sa.PrimaryKeyConstraint(
            "dataset_split_id",
            "dataset_example_id",
        ),
    )

    # Create experiments_dataset_splits table The rational of this table is to
    # gather examples for a specific dataset split for a specific experiment.
    # Select all dataset examples where examples belong to a dataset split and
    # examples belong to a experiment.

    op.create_table(
        "experiments_dataset_splits",
        sa.Column(
            "experiment_id",
            _Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dataset_split_id",
            _Integer,
            sa.ForeignKey("dataset_splits.id", ondelete="CASCADE"),
            nullable=False,
            # index on the second element of the composite primary key
            index=True,
        ),
        sa.PrimaryKeyConstraint(
            "experiment_id",
            "dataset_split_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("experiments_dataset_splits")
    op.drop_table("dataset_splits_dataset_examples")
    op.drop_table("dataset_splits")
