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
    op.add_column(
        "span_annotations",
        sa.Column(
            "identifier",
            sa.String,
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "span_annotations",
        sa.Column(
            "source",
            sa.String,
            sa.CheckConstraint(
                "source IN ('API', 'APP')",
                name="valid_source",
            ),
            nullable=False,
        ),
    )
    with op.batch_alter_table("span_annotations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.drop_constraint("uq_span_annotations_name_span_rowid", type_="unique")
        batch_op.create_unique_constraint(
            "uq_span_annotation_identifier_per_span",
            ["span_rowid", "identifier"],
            postgresql_where=sa.column("identifier").isnot(None),
            sqlite_where=sa.column("identifier").isnot(None),
        )
    op.add_column(
        "trace_annotations",
        sa.Column(
            "identifier",
            sa.String,
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "trace_annotations",
        sa.Column(
            "source",
            sa.String,
            sa.CheckConstraint(
                "source IN ('API', 'APP')",
                name="valid_source",
            ),
            nullable=False,
        ),
    )
    with op.batch_alter_table("trace_annotations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.drop_constraint("uq_trace_annotations_name_trace_rowid", type_="unique")
        batch_op.create_unique_constraint(
            "uq_trace_annotation_identifier_per_trace",
            ["trace_rowid", "identifier"],
            postgresql_where=sa.column("identifier").isnot(None),
            sqlite_where=sa.column("identifier").isnot(None),
        )
    op.add_column(
        "document_annotations",
        sa.Column(
            "identifier",
            sa.String,
            nullable=True,
            index=True,
            unique=True,
        ),
    )
    op.add_column(
        "document_annotations",
        sa.Column(
            "source",
            sa.String,
            sa.CheckConstraint(
                "source IN ('API', 'APP')",
                name="valid_source",
            ),
            nullable=False,
        ),
    )
    with op.batch_alter_table("document_annotations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
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
                "annotation_type IN ('CATEGORICAL', 'CONTINUOUS', 'FREEFORM')",
                name="valid_annotation_type",
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
        sa.Column(
            "optimization_direction",
            sa.String,
            sa.CheckConstraint(
                "optimization_direction IN ('MINIMIZE', 'MAXIMIZE')",
                name="valid_optimization_direction",
            ),
            nullable=False,
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
        sa.Column(
            "optimization_direction",
            sa.String,
            sa.CheckConstraint(
                "optimization_direction IN ('MINIMIZE', 'MAXIMIZE')",
                name="valid_optimization_direction",
            ),
            nullable=False,
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
        sa.Column("score", sa.Float, nullable=True),
        sa.UniqueConstraint(
            "categorical_annotation_config_id",
            "label",
        ),
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
        sa.UniqueConstraint(
            "project_id",
            "annotation_config_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("project_annotation_configs")
    op.drop_table("categorical_annotation_values")
    op.drop_table("categorical_annotation_configs")
    op.drop_table("continuous_annotation_configs")
    op.drop_table("annotation_configs")

    with op.batch_alter_table("span_annotations") as batch_op:
        batch_op.drop_constraint("uq_span_annotation_identifier_per_span", type_="unique")
        batch_op.create_unique_constraint(
            "uq_span_annotations_name_span_rowid",
            ["name", "span_rowid"],
        )
        batch_op.drop_column("user_id")
        batch_op.drop_constraint("ck_span_annotations_`valid_source`", type_="check")
    op.drop_column("span_annotations", "source")
    op.drop_index("ix_span_annotations_identifier")
    op.drop_column("span_annotations", "identifier")
    with op.batch_alter_table("trace_annotations") as batch_op:
        batch_op.drop_constraint("uq_trace_annotation_identifier_per_trace", type_="unique")
        batch_op.create_unique_constraint(
            "uq_trace_annotations_name_trace_rowid",
            ["name", "trace_rowid"],
        )
        batch_op.drop_column("user_id")
        batch_op.drop_constraint("ck_trace_annotations_`valid_source`", type_="check")
    op.drop_column("trace_annotations", "source")
    op.drop_index("ix_trace_annotations_identifier")
    op.drop_column("trace_annotations", "identifier")
    with op.batch_alter_table("document_annotations") as batch_op:
        batch_op.create_unique_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            ["name", "span_rowid", "document_position"],
        )
        batch_op.drop_column("user_id")
        batch_op.drop_constraint("ck_document_annotations_`valid_source`", type_="check")
    op.drop_column("document_annotations", "source")
    op.drop_index("ix_document_annotations_identifier")
    op.drop_column("document_annotations", "identifier")
