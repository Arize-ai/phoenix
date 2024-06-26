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
            "dataset_id",
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
            "dataset_id",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "span_rowid",
            sa.Integer,
            sa.ForeignKey("spans.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
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
    op.create_table(
        "experiments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "dataset_id",
            sa.Integer,
            sa.ForeignKey("datasets.id", ondelete="CASCADE"),
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
        sa.Column(
            "name",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.String,
            nullable=True,
        ),
        sa.Column(
            "repetitions",
            sa.Integer,
            nullable=False,
        ),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column("project_name", sa.String, index=True),
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
        "experiment_runs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "experiment_id",
            sa.Integer,
            sa.ForeignKey("experiments.id", ondelete="CASCADE"),
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
        sa.Column(
            "repetition_number",
            sa.Integer,
            nullable=False,
        ),
        sa.Column(
            "trace_id",
            sa.String,
            nullable=True,
        ),
        sa.Column("output", JSON_, nullable=False),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column(
            "prompt_token_count",
            sa.Integer,
            nullable=True,
        ),
        sa.Column(
            "completion_token_count",
            sa.Integer,
            nullable=True,
        ),
        sa.Column(
            "error",
            sa.String,
            nullable=True,
        ),
        sa.UniqueConstraint(
            "experiment_id",
            "dataset_example_id",
            "repetition_number",
        ),
    )
    op.create_table(
        "experiment_run_annotations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "experiment_run_id",
            sa.Integer,
            sa.ForeignKey("experiment_runs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "name",
            sa.String,
            nullable=False,
        ),
        sa.Column(
            "annotator_kind",
            sa.String,
            sa.CheckConstraint(
                "annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
                name="valid_annotator_kind",
            ),
            nullable=False,
        ),
        sa.Column(
            "label",
            sa.String,
            nullable=True,
        ),
        sa.Column(
            "score",
            sa.Float,
            nullable=True,
        ),
        sa.Column(
            "explanation",
            sa.String,
            nullable=True,
        ),
        sa.Column(
            "trace_id",
            sa.String,
            nullable=True,
        ),
        sa.Column(
            "error",
            sa.String,
            nullable=True,
        ),
        sa.Column("metadata", JSON_, nullable=False),
        sa.Column("start_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("end_time", sa.TIMESTAMP(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "experiment_run_id",
            "name",
        ),
    )


def downgrade() -> None:
    op.drop_table("experiment_run_annotations")
    op.drop_table("experiment_runs")
    op.drop_table("experiments")
    op.drop_table("dataset_example_revisions")
    op.drop_table("dataset_examples")
    op.drop_table("dataset_versions")
    op.drop_table("datasets")
