"""Annotation config migrations

Revision ID: 2f9d1a65945f
Revises: bc8fea3c2bc8
Create Date: 2025-02-06 10:17:15.726197

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f9d1a65945f"
down_revision: Union[str, None] = "bc8fea3c2bc8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    dialect = op.get_bind().dialect.name
    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("span_annotations", recreate="always") as batch_op:
            batch_op.drop_constraint("uq_span_annotations_name_span_rowid", type_="unique")
        with op.batch_alter_table("trace_annotations", recreate="always") as batch_op:
            batch_op.drop_constraint("uq_trace_annotations_name_trace_rowid", type_="unique")
        with op.batch_alter_table("document_annotations", recreate="always") as batch_op:
            batch_op.drop_constraint(
                "uq_document_annotations_name_span_rowid_document_position",
                type_="unique",
            )
    elif op.get_bind().dialect.name == "postgresql":
        op.drop_constraint("uq_span_annotations_name_span_rowid", "span_annotations", type_="unique")
        op.drop_constraint("uq_trace_annotations_name_trace_rowid", "trace_annotations", type_="unique")
        op.drop_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            "document_annotations",
            type_="unique",
        )
    else:
        raise ValueError(f"Unsupported dialect: {dialect}")


def downgrade() -> None:
    dialect = op.get_bind().dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("span_annotations", recreate="always") as batch_op:
            batch_op.create_unique_constraint(
                "uq_span_annotations_name_span_rowid",
                ["name", "span_rowid"],
            )
        with op.batch_alter_table("trace_annotations", recreate="always") as batch_op:
            batch_op.create_unique_constraint(
                "uq_trace_annotations_name_trace_rowid",
                ["name", "trace_rowid"],
            )
        with op.batch_alter_table("document_annotations", recreate="always") as batch_op:
            batch_op.create_unique_constraint(
                "uq_document_annotations_name_span_rowid_document_position",
                ["name", "span_rowid", "document_position"],
            )
    elif dialect == "postgresql":
        op.create_unique_constraint(
            "uq_span_annotations_name_span_rowid",
            "span_annotations",
            ["name", "span_rowid"],
        )
        op.create_unique_constraint(
            "uq_trace_annotations_name_trace_rowid",
            "trace_annotations",
            ["name", "trace_rowid"],
        )
        op.create_unique_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            "document_annotations",
            ["name", "span_rowid", "document_position"],
        )
    else:
        raise ValueError(f"Unsupported dialect: {dialect}")
