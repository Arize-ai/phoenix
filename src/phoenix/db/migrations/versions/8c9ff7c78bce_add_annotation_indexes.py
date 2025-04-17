"""Add annotation indexes

Revision ID: 8c9ff7c78bce
Revises: 2f9d1a65945f
Create Date: 2025-04-17 10:38:27.593661

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8c9ff7c78bce"
down_revision: Union[str, None] = "2f9d1a65945f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_span_annotations_identifier", "span_annotations", ["identifier"], unique=False
    )
    op.create_index(
        "uq_span_annotations_span_rowid_name_null_identifier",
        "span_annotations",
        ["span_rowid", "name"],
        unique=True,
        postgresql_where=sa.column("identifier").is_(None),
        sqlite_where=sa.column("identifier").is_(None),
    )
    op.create_index(
        "uq_span_annotations_span_rowid_name_identifier_not_null",
        "span_annotations",
        ["span_rowid", "name", "identifier"],
        unique=True,
        postgresql_where=sa.column("identifier").isnot(None),
        sqlite_where=sa.column("identifier").isnot(None),
    )

    op.create_index(
        "ix_trace_annotations_identifier", "trace_annotations", ["identifier"], unique=False
    )
    op.create_index(
        "uq_trace_annotations_trace_rowid_name_null_identifier",
        "trace_annotations",
        ["trace_rowid", "name"],
        unique=True,
        postgresql_where=sa.column("identifier").is_(None),
        sqlite_where=sa.column("identifier").is_(None),
    )
    op.create_index(
        "uq_trace_annotations_trace_rowid_name_identifier_not_null",
        "trace_annotations",
        ["trace_rowid", "name", "identifier"],
        unique=True,
        postgresql_where=sa.column("identifier").isnot(None),
        sqlite_where=sa.column("identifier").isnot(None),
    )

    op.create_index(
        "ix_document_annotations_identifier",
        "document_annotations",
        ["identifier"],
    )


def downgrade() -> None:
    op.drop_index("ix_document_annotations_identifier", table_name="document_annotations")

    op.drop_index(
        "uq_trace_annotations_trace_rowid_name_identifier_not_null", table_name="trace_annotations"
    )
    op.drop_index(
        "uq_trace_annotations_trace_rowid_name_null_identifier", table_name="trace_annotations"
    )
    op.drop_index("ix_trace_annotations_identifier", table_name="trace_annotations")

    op.drop_index(
        "uq_span_annotations_span_rowid_name_identifier_not_null", table_name="span_annotations"
    )
    op.drop_index(
        "uq_span_annotations_span_rowid_name_null_identifier", table_name="span_annotations"
    )
    op.drop_index("ix_span_annotations_identifier", table_name="span_annotations")
