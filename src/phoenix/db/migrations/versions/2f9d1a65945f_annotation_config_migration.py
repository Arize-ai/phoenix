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
    op.drop_constraint("uq_span_annotations_name_span_rowid", "span_annotations", type_="unique")
    op.drop_constraint("uq_trace_annotations_name_trace_rowid", "trace_annotations", type_="unique")
    op.drop_constraint(
        "uq_document_annotations_name_span_rowid_document_position",
        "document_annotations",
        type_="unique",
    )


def downgrade() -> None:
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
