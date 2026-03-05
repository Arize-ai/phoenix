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
    op.add_column(
        "dataset_examples", sa.Column("external_id", sa.String(), nullable=True, index=True)
    )
    op.create_unique_constraint(
        "uq_dataset_examples_dataset_id_external_id",
        "dataset_examples",
        ["dataset_id", "external_id"],
    )
    op.add_column(
        "dataset_example_revisions",
        sa.Column("content_hash", sa.String(), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_column("dataset_example_revisions", "content_hash")
    op.drop_constraint(
        "uq_dataset_examples_dataset_id_external_id", "dataset_examples", type_="unique"
    )
    op.drop_column("dataset_examples", "external_id")
