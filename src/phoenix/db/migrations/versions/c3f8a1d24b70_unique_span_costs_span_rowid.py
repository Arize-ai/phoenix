"""enforce one span_costs row per span

Revision ID: c3f8a1d24b70
Revises: 4aad9107d196
Create Date: 2026-09-03 00:00:00.000000

Makes ix_span_costs_span_rowid unique, since Span.span_cost is a scalar
relationship. Existing duplicates are collapsed first, keeping the highest id
for each span. Their span_cost_details rows are deleted explicitly because
SQLite does not enforce ON DELETE CASCADE on the migration connection.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f8a1d24b70"
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX_NAME = "ix_span_costs_span_rowid"


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM span_cost_details
        WHERE span_cost_id IN (
            SELECT id FROM span_costs
            WHERE id NOT IN (
                SELECT MAX(id) FROM span_costs GROUP BY span_rowid
            )
        )
        """
    )
    op.execute(
        """
        DELETE FROM span_costs
        WHERE id NOT IN (
            SELECT MAX(id) FROM span_costs GROUP BY span_rowid
        )
        """
    )
    op.drop_index(_INDEX_NAME, table_name="span_costs")
    op.create_index(_INDEX_NAME, "span_costs", ["span_rowid"], unique=True)


def downgrade() -> None:
    op.drop_index(_INDEX_NAME, table_name="span_costs")
    op.create_index(_INDEX_NAME, "span_costs", ["span_rowid"], unique=False)
