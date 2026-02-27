"""dataset_example_external_id

Revision ID: 5a8d3b1e4c2f
Revises: 4f7c9f1e2b3a
Create Date: 2026-02-27 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5a8d3b1e4c2f"
down_revision: Union[str, None] = "4f7c9f1e2b3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.add_column(sa.Column("external_id", sa.String(), nullable=True))
        batch_op.create_index(
            "ix_dataset_examples_external_id",
            ["external_id"],
            unique=False,
        )
        batch_op.create_unique_constraint(
            "uq_dataset_examples_dataset_id_external_id",
            ["dataset_id", "external_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.drop_constraint("uq_dataset_examples_dataset_id_external_id", type_="unique")
        batch_op.drop_index("ix_dataset_examples_external_id")
        batch_op.drop_column("external_id")
