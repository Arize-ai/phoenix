"""rename span_costs prompt/completion columns to input/output

Revision ID: 31ec4c6dcfd4
Revises: b109a51ab9b6
Create Date: 2026-11-03 12:00:00.000000

`span_costs` named its token and cost columns after chat prompts and completions. DECISION and
EMBEDDING spans also have costs, so the columns get kind-neutral names: `prompt_*` becomes
`input_*` and `completion_*` becomes `output_*`. The `total_*` columns are unchanged.

`op.alter_column` with `new_column_name`, outside a batch, emits an in-place rename on both
dialects (`ALTER TABLE ... RENAME <old> TO <new>` on PostgreSQL, `RENAME COLUMN` on SQLite), so
`span_costs` is not copied. No index or constraint names
include these columns.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "31ec4c6dcfd4"
down_revision: Union[str, None] = "b109a51ab9b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RENAMES = (
    ("prompt_cost", "input_cost"),
    ("prompt_tokens", "input_tokens"),
    ("completion_cost", "output_cost"),
    ("completion_tokens", "output_tokens"),
)


def upgrade() -> None:
    for old, new in _RENAMES:
        op.alter_column("span_costs", old, new_column_name=new)


def downgrade() -> None:
    for old, new in _RENAMES:
        op.alter_column("span_costs", new, new_column_name=old)
