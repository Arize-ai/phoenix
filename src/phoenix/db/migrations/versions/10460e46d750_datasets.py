"""datasets

Revision ID: 10460e46d750
Revises: cf03bd6bae1d
Create Date: 2024-05-10 11:24:23.985834

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from phoenix.db.migrations.types import JSON_

# revision identifiers, used by Alembic.
revision: str = "10460e46d750"
down_revision: Union[str, None] = "cf03bd6bae1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
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
    op.create_table(
        "dataset_versions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_rowid",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "dataset_examples",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_rowid",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "span_rowid",
            sa.Integer,
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "dataset_example_revisions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_example_id",
            sa.Integer,
            sa.ForeignKey("dataset_examples.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "dataset_version_id",
            sa.Integer,
            sa.ForeignKey("dataset_versions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("input", JSON_, nullable=False),
        sa.Column("output", JSON_, nullable=False),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column(
            "revision_kind",
            sa.String,
            sa.CheckConstraint(
                "revision_kind IN ('CREATE', 'PATCH', 'DELETE')",
                name="valid_revision_kind",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "dataset_example_id",
            "dataset_version_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("datasets")
    op.drop_table("dataset_versions")
    op.drop_table("dataset_examples")
    op.drop_table("dataset_example_revisions")
