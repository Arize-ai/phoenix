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
    with op.batch_alter_table("span_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint("uq_span_annotations_name_span_rowid", type_="unique")
    with op.batch_alter_table("trace_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint("uq_trace_annotations_name_trace_rowid", type_="unique")
    with op.batch_alter_table("document_annotations", recreate="auto") as batch_op:
        batch_op.drop_constraint(
            "uq_document_annotations_name_span_rowid_document_position",
            type_="unique",
        )


def downgrade() -> None:
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
