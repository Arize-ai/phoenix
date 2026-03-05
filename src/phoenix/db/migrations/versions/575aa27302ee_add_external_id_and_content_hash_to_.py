"""add_external_id_and_content_hash_to_dataset_tables

Revision ID: 575aa27302ee
Revises: f1a6b2f0c9d5
Create Date: 2026-03-05 10:31:37.488514

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "575aa27302ee"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.add_column(sa.Column("external_id", sa.String(), nullable=True))
        batch_op.create_index("ix_dataset_examples_external_id", ["external_id"])
        batch_op.create_unique_constraint(
            "uq_dataset_examples_dataset_id_external_id",
            ["dataset_id", "external_id"],
        )

    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(), nullable=True))
        batch_op.create_index("ix_dataset_example_revisions_content_hash", ["content_hash"])


def downgrade() -> None:
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.drop_index("ix_dataset_example_revisions_content_hash")
        batch_op.drop_column("content_hash")

    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.drop_constraint("uq_dataset_examples_dataset_id_external_id", type_="unique")
        batch_op.drop_index("ix_dataset_examples_external_id")
        batch_op.drop_column("external_id")
