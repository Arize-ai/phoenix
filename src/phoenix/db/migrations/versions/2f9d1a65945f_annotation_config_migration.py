"""Annotation config migrations

Revision ID: 2f9d1a65945f
Revises: bc8fea3c2bc8
Create Date: 2025-02-06 10:17:15.726197

"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "2f9d1a65945f"
down_revision: Union[str, None] = "bc8fea3c2bc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


def upgrade() -> None:
    with op.batch_alter_table("span_annotations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "identifier",
                sa.String,
                nullable=True,
            ),
        )
        batch_op.add_column(
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
        batch_op.drop_constraint(
            constraint_name="valid_annotator_kind",
            type_="check",
        )
        batch_op.create_check_constraint(
            constraint_name="valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
        )
        batch_op.drop_constraint("uq_span_annotations_name_span_rowid", type_="unique")

    with op.batch_alter_table("trace_annotations") as batch_op:
        batch_op.add_column(
            sa.Column(
                "user_id",
                sa.Integer,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        batch_op.add_column(
            sa.Column(
                "identifier",
                sa.String,
                nullable=True,
            ),
        )
        batch_op.add_column(
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
        batch_op.drop_constraint(
            constraint_name="valid_annotator_kind",
            type_="check",
        )
        batch_op.create_check_constraint(
            constraint_name="valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
        )
        batch_op.drop_constraint("uq_trace_annotations_name_trace_rowid", type_="unique")

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
        batch_op.add_column(
            sa.Column(
                "identifier",
                sa.String,
                nullable=True,
            ),
        )
        batch_op.add_column(
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
        batch_op.drop_constraint(
            constraint_name="valid_annotator_kind",
            type_="check",
        )
        batch_op.create_check_constraint(
            constraint_name="valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'CODE', 'HUMAN')",
        )

    op.create_table(
        "annotation_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String, nullable=False, unique=True),
        sa.Column("config", JSON_, nullable=False),
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
    op.drop_table("annotation_configs")

    with op.batch_alter_table("span_annotations") as batch_op:
        batch_op.drop_constraint("valid_source", type_="check")
        batch_op.drop_constraint("valid_annotator_kind", type_="check")
        batch_op.drop_column("user_id")
        batch_op.drop_column("source")
        batch_op.drop_column("identifier")
        batch_op.create_unique_constraint(
            "uq_span_annotations_name_span_rowid", ["name", "span_rowid"]
        )
        batch_op.create_check_constraint(
            "valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'HUMAN')",
        )

    with op.batch_alter_table("trace_annotations") as batch_op:
        batch_op.drop_constraint("valid_source", type_="check")
        batch_op.drop_constraint("valid_annotator_kind", type_="check")
        batch_op.drop_column("user_id")
        batch_op.drop_column("source")
        batch_op.drop_column("identifier")
        batch_op.create_unique_constraint(
            "uq_trace_annotations_name_trace_rowid", ["name", "trace_rowid"]
        )
        batch_op.create_check_constraint(
            "valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'HUMAN')",
        )

    with op.batch_alter_table("document_annotations") as batch_op:
        batch_op.drop_constraint("valid_source", type_="check")
        batch_op.drop_constraint("valid_annotator_kind", type_="check")
        batch_op.drop_column("user_id")
        batch_op.drop_column("source")
        batch_op.drop_column("identifier")
        batch_op.create_unique_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            ["name", "span_rowid", "document_position"],
        )
        batch_op.create_check_constraint(
            "valid_annotator_kind",
            condition="annotator_kind IN ('LLM', 'HUMAN')",
        )
