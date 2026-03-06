"""add external_id to dataset_examples and content_hash to dataset_example_revisions

Revision ID: 3a9e2f1b4c87
Revises: f1a6b2f0c9d5
Create Date: 2026-03-06 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3a9e2f1b4c87"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.add_column(sa.Column("external_id", sa.String(), nullable=True))
        batch_op.create_unique_constraint(
            "uq_dataset_examples_dataset_id_external_id",
            ["dataset_id", "external_id"],
        )

    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.drop_column("content_hash")

    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.drop_constraint("uq_dataset_examples_dataset_id_external_id", type_="unique")
        batch_op.drop_column("external_id")
