"""change int to bigint for id columns

Revision ID: 7a8b9c0d1e2f
Revises: 8a3764fe7f1a
Create Date: 2025-04-28 07:04:26.102957

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7a8b9c0d1e2f"
down_revision: Union[str, None] = "8a3764fe7f1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Exit early if using SQLite since it doesn't distinguish between INTEGER and BIGINT
    if conn.dialect.name == "sqlite":
        return

    # First, drop ALL foreign key constraints that depend on either spans.id or traces.id
    op.drop_constraint(
        constraint_name="fk_document_annotations_span_rowid_spans",
        table_name="document_annotations",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_dataset_examples_span_rowid_spans",
        table_name="dataset_examples",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_span_annotations_span_rowid_spans",
        table_name="span_annotations",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_spans_trace_rowid_traces",
        table_name="spans",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_trace_annotations_trace_rowid_traces",
        table_name="trace_annotations",
        type_="foreignkey",
    )

    # Drop primary key constraints
    op.drop_constraint(
        constraint_name="pk_spans",
        table_name="spans",
        type_="primary",
    )
    op.drop_constraint(
        constraint_name="pk_traces",
        table_name="traces",
        type_="primary",
    )

    # Note: Using raw SQL instead of batch_alter_table because even with batch_alter_table,
    # multiple alter_column operations appear to generate separate ALTER TABLE statements,
    # making the migration slower. Raw SQL allows us to combine multiple ALTER COLUMN
    # statements under a single ALTER TABLE, improving performance.

    # Alter spans table - combine both column changes into one statement
    conn.execute(
        sa.text(
            """
            ALTER TABLE spans
            ALTER COLUMN id TYPE BIGINT,
            ALTER COLUMN trace_rowid TYPE BIGINT
            """
        )
    )

    # Alter traces table
    conn.execute(
        sa.text(
            """
            ALTER TABLE traces
            ALTER COLUMN id TYPE BIGINT
            """
        )
    )

    # Alter trace_annotations table
    conn.execute(
        sa.text(
            """
            ALTER TABLE trace_annotations
            ALTER COLUMN trace_rowid TYPE BIGINT
            """
        )
    )

    # Recreate primary key constraints
    op.create_primary_key(
        constraint_name="pk_spans",
        table_name="spans",
        columns=["id"],
    )
    op.create_primary_key(
        constraint_name="pk_traces",
        table_name="traces",
        columns=["id"],
    )

    # Recreate foreign key constraints
    op.create_foreign_key(
        constraint_name="fk_document_annotations_span_rowid_spans",
        source_table="document_annotations",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_dataset_examples_span_rowid_spans",
        source_table="dataset_examples",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        constraint_name="fk_span_annotations_span_rowid_spans",
        source_table="span_annotations",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_spans_trace_rowid_traces",
        source_table="spans",
        referent_table="traces",
        local_cols=["trace_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_trace_annotations_trace_rowid_traces",
        source_table="trace_annotations",
        referent_table="traces",
        local_cols=["trace_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    conn = op.get_bind()
    # Exit early if using SQLite since it doesn't distinguish between INTEGER and BIGINT
    if conn.dialect.name == "sqlite":
        return

    # First, drop ALL foreign key constraints that depend on either spans.id or traces.id
    op.drop_constraint(
        constraint_name="fk_document_annotations_span_rowid_spans",
        table_name="document_annotations",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_dataset_examples_span_rowid_spans",
        table_name="dataset_examples",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_span_annotations_span_rowid_spans",
        table_name="span_annotations",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_spans_trace_rowid_traces",
        table_name="spans",
        type_="foreignkey",
    )
    op.drop_constraint(
        constraint_name="fk_trace_annotations_trace_rowid_traces",
        table_name="trace_annotations",
        type_="foreignkey",
    )

    # Drop primary key constraints
    op.drop_constraint(
        constraint_name="pk_spans",
        table_name="spans",
        type_="primary",
    )
    op.drop_constraint(
        constraint_name="pk_traces",
        table_name="traces",
        type_="primary",
    )

    # Note: Using raw SQL instead of batch_alter_table because even with batch_alter_table,
    # multiple alter_column operations appear to generate separate ALTER TABLE statements,
    # making the migration slower. Raw SQL allows us to combine multiple ALTER COLUMN
    # statements under a single ALTER TABLE, improving performance.

    # Alter spans table - combine both column changes into one statement
    conn.execute(
        sa.text(
            """
            ALTER TABLE spans
            ALTER COLUMN id TYPE INTEGER,
            ALTER COLUMN trace_rowid TYPE INTEGER
            """
        )
    )

    # Alter traces table
    conn.execute(
        sa.text(
            """
            ALTER TABLE traces
            ALTER COLUMN id TYPE INTEGER
            """
        )
    )

    # Alter trace_annotations table
    conn.execute(
        sa.text(
            """
            ALTER TABLE trace_annotations
            ALTER COLUMN trace_rowid TYPE INTEGER
            """
        )
    )

    # Recreate primary key constraints
    op.create_primary_key(
        constraint_name="pk_spans",
        table_name="spans",
        columns=["id"],
    )
    op.create_primary_key(
        constraint_name="pk_traces",
        table_name="traces",
        columns=["id"],
    )

    # Recreate foreign key constraints
    op.create_foreign_key(
        constraint_name="fk_document_annotations_span_rowid_spans",
        source_table="document_annotations",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_dataset_examples_span_rowid_spans",
        source_table="dataset_examples",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        constraint_name="fk_span_annotations_span_rowid_spans",
        source_table="span_annotations",
        referent_table="spans",
        local_cols=["span_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_spans_trace_rowid_traces",
        source_table="spans",
        referent_table="traces",
        local_cols=["trace_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        constraint_name="fk_trace_annotations_trace_rowid_traces",
        source_table="trace_annotations",
        referent_table="traces",
        local_cols=["trace_rowid"],
        remote_cols=["id"],
        ondelete="CASCADE",
    )
