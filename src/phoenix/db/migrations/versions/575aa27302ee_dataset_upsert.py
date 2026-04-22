"""dataset_upsert

Revision ID: 575aa27302ee
Revises: f1a6b2f0c9d5
Create Date: 2026-03-05 10:31:37.488514

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from phoenix.utilities.content_hashing import compute_example_content_hash

# revision identifiers, used by Alembic.
revision: str = "575aa27302ee"
down_revision: Union[str, None] = "aba52fffe1a1"
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
        batch_op.add_column(sa.Column("content_hash", sa.LargeBinary(), nullable=True))

    revisions = sa.Table(
        "dataset_example_revisions",
        sa.MetaData(),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("input", sa.JSON),
        sa.Column("output", sa.JSON),
        sa.Column("metadata", sa.JSON),
        sa.Column("content_hash", sa.LargeBinary),
    )

    bind = op.get_bind()
    rows = bind.execute(
        sa.select(revisions.c.id, revisions.c.input, revisions.c.output, revisions.c["metadata"])
    ).fetchall()
    updates = [
        {
            "row_id": row.id,
            "content_hash": compute_example_content_hash(
                input=row.input, output=row.output, metadata=row.metadata
            ),
        }
        for row in rows
    ]
    if updates:
        bind.execute(
            revisions.update()
            .where(revisions.c.id == sa.bindparam("row_id"))
            .values(content_hash=sa.bindparam("content_hash")),
            updates,
        )

    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.alter_column("content_hash", existing_type=sa.LargeBinary(), nullable=False)
        batch_op.create_index("ix_dataset_example_revisions_content_hash", ["content_hash"])


def downgrade() -> None:
    with op.batch_alter_table("dataset_example_revisions") as batch_op:
        batch_op.drop_index("ix_dataset_example_revisions_content_hash")
        batch_op.drop_column("content_hash")

    with op.batch_alter_table("dataset_examples") as batch_op:
        batch_op.drop_index("ix_dataset_examples_external_id")
        batch_op.drop_constraint("uq_dataset_examples_dataset_id_external_id", type_="unique")
        batch_op.drop_column("external_id")
