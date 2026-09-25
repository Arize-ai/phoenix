"""enforce one span_costs row per span

Revision ID: c3f8a1d24b70
Revises: 4aad9107d196
Create Date: 2026-09-03 00:00:00.000000

`Span.span_cost` is a scalar relationship, so at most one `span_costs` row may
exist per span, but `span_costs.span_rowid` carried a plain index rather than a
unique one. Duplicates therefore multiply any join against `span_costs`, which
inflates cost and token aggregates and can skew span counts and pagination.

Any duplicates already present are collapsed before the unique index is created,
keeping the highest `id` for each span -- the most recently written row, which
reflects the latest cost calculation. Dependent `span_cost_details` rows are
removed by the existing ON DELETE CASCADE.
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
    # Collapse duplicates before the unique index is built, otherwise creating
    # it would fail on any database that already has them.
    #
    # The child rows are removed explicitly rather than leaning on the
    # ON DELETE CASCADE: SQLite only enforces foreign keys when
    # PRAGMA foreign_keys is ON, and it is off by default on the connection
    # Alembic migrates with, which would otherwise leave orphaned
    # span_cost_details behind.
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
