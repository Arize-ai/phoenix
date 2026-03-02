"""dataset_example_revision_content_hash_and_external_id

Revision ID: 4f7c9f1e2b3a
Revises: f1a6b2f0c9d5
Create Date: 2026-02-26 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4f7c9f1e2b3a"
down_revision: Union[str, None] = "f1a6b2f0c9d5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.add_column(sa.Column("content_hash", sa.String(), nullable=True))
        batch_op.create_check_constraint(
            "valid_content_hash_length",
            "content_hash IS NULL OR length(content_hash) = 64",
        )
        batch_op.create_index(
            "ix_dataset_example_revisions_content_hash",
            ["content_hash"],
            unique=False,
        )
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
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.drop_index("ix_dataset_example_revisions_content_hash")
        batch_op.drop_constraint("valid_content_hash_length", type_="check")
        batch_op.drop_column("content_hash")
