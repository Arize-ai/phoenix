"""Annotation config migrations

Revision ID: 2f9d1a65945f
Revises: bc8fea3c2bc8
Create Date: 2025-02-06 10:17:15.726197

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f9d1a65945f"
down_revision: Union[str, None] = "bc8fea3c2bc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("span_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint("uq_span_annotations_name_span_rowid", type_="unique")
    with op.batch_alter_table("trace_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint("uq_trace_annotations_name_trace_rowid", type_="unique")
    with op.batch_alter_table("document_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            type_="unique",
        )

    op.create_table(
        "annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column(
            "annotation_type",
            sa.String,
            sa.CheckConstraint(
                "annotation_type IN ('CATEGORICAL', 'CONTINUOUS', 'FREEFORM', 'BINARY')",
                name="annotation_type",
            ),
            nullable=False,
        ),
        sa.Column(
            "optimization_direction",
            sa.String,
            sa.CheckConstraint(
                "optimization_direction IN ('MINIMIZE', 'MAXIMIZE')",
                name="valid_optimization_direction",
            ),
            nullable=False,
        ),
        sa.Column("description", sa.String, nullable=True),
    )

    op.create_table(
        "continuous_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("lower_bound", sa.Float, nullable=True),
        sa.Column("upper_bound", sa.Float, nullable=True),
    )

    op.create_table(
        "categorical_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )

    op.create_table(
        "categorical_annotation_values",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "categorical_annotation_config_id",
            sa.Integer,
            sa.ForeignKey("categorical_annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("label", sa.String, nullable=False),
        sa.Column("numeric_score", sa.Float, nullable=True),
    )

    op.create_table(
        "project_annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "annotation_config_id",
            sa.Integer,
            sa.ForeignKey("annotation_configs.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("categorical_annotation_values")
    op.drop_table("categorical_annotation_configs")
    op.drop_table("continuous_annotation_configs")
    op.drop_table("annotation_configs")
    op.drop_table("project_annotation_configs")

    with op.batch_alter_table("span_annotations", recreate="auto") as batch_op:
        batch_op.create_unique_constraint(
            "uq_span_annotations_name_span_rowid",
            ["name", "span_rowid"],
        )
    with op.batch_alter_table("trace_annotations", recreate="auto") as batch_op:
        batch_op.create_unique_constraint(
            "uq_trace_annotations_name_trace_rowid",
            ["name", "trace_rowid"],
        )
    with op.batch_alter_table("document_annotations", recreate="auto") as batch_op:
        batch_op.create_unique_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            ["name", "span_rowid", "document_position"],
        )
