"""unique constraint on span_costs.span_rowid

Revision ID: 08a89b1ca1f6
Revises: 4aad9107d196
Create Date: 2026-09-11 00:00:00.000000

`Span.span_cost` is modeled and consumed as a one-to-one relationship, but
`span_costs.span_rowid` has only a regular index, not a unique constraint --
nothing at the database level stops a second cost row for the same span, and
current writers only avoid that by convention (computing cost once, after a
successful unique span insertion). If duplicates ever land -- a retry, a
future writer, a direct write -- joins against `span_costs` can return a
span multiple times and inflate cost/token aggregates.

Resolves any existing duplicates before adding the constraint: for each
`span_rowid` with more than one cost row, keeps the row with the greatest
`id` (the most recently written one) and deletes the rest, along with their
`span_cost_details`, so no orphans are left behind. This should be a no-op on
every database that doesn't already have duplicates -- which is expected to
be all of them, since nothing has shipped that could create one -- but the
issue this closes is precisely that nothing enforces it.

The dedup step is irreversible: `downgrade()` restores the index and drops
the constraint, but does not resurrect deleted rows.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "08a89b1ca1f6"
down_revision: Union[str, None] = "4aad9107d196"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CHUNK_SIZE = 500  # bound the size of any single IN-list


def _dedup_span_costs() -> None:
    connection = op.get_bind()
    span_costs = sa.table(
        "span_costs",
        sa.column("id", sa.Integer),
        sa.column("span_rowid", sa.Integer),
    )
    span_cost_details = sa.table(
        "span_cost_details",
        sa.column("id", sa.Integer),
        sa.column("span_cost_id", sa.Integer),
    )
    # The row to keep for each span_rowid: the one with the greatest id.
    keep_ids = sa.select(sa.func.max(span_costs.c.id)).group_by(span_costs.c.span_rowid)
    duplicate_ids = [
        row[0]
        for row in connection.execute(
            sa.select(span_costs.c.id).where(span_costs.c.id.notin_(keep_ids))
        )
    ]
    for i in range(0, len(duplicate_ids), _CHUNK_SIZE):
        chunk = duplicate_ids[i : i + _CHUNK_SIZE]
        connection.execute(
            span_cost_details.delete().where(span_cost_details.c.span_cost_id.in_(chunk))
        )
        connection.execute(span_costs.delete().where(span_costs.c.id.in_(chunk)))


def upgrade() -> None:
    _dedup_span_costs()
    with op.batch_alter_table("span_costs") as batch_op:
        batch_op.drop_index("ix_span_costs_span_rowid")
        batch_op.create_unique_constraint("uq_span_costs_span_rowid", ["span_rowid"])


def downgrade() -> None:
    with op.batch_alter_table("span_costs") as batch_op:
        batch_op.drop_constraint("uq_span_costs_span_rowid", type_="unique")
        batch_op.create_index("ix_span_costs_span_rowid", ["span_rowid"])
