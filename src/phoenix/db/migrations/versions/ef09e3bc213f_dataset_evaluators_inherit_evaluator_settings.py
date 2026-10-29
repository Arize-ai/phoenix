"""dataset evaluators inherit evaluator settings

Revision ID: ef09e3bc213f
Revises: a7f1c3e9d2b4
Create Date: 2026-09-18 00:00:00.000000

A dataset evaluator overrides its evaluator's description and output configs
only where it stores them; NULL means the binding inherits the evaluator's
value.

- dataset_evaluators.output_configs becomes nullable, and a binding that
  inherits stores SQL NULL instead of the JSON value null, so `IS NULL`
  identifies inheriting bindings on both dialects.
- Bindings that store an empty output config list are reset to inherit. An
  override needs at least one config, and the experiment runner already reads
  an empty list as inherit, so SQL NULL becomes the only encoding of inherit.
- Existing description and output config values stay as stored, including
  values equal to their evaluator's settings. They may be intentional dataset
  settings, and this migration cannot distinguish them from copied values.
- llm_evaluators and code_evaluators gain a nullable input_schema column: the
  evaluator's inputs with a description on each the author described. NULL
  means none were described, and the inputs are inferred from the prompt or
  the code alone, so existing rows need no backfill.

The downgrade drops the input_schema columns. It stores JSON null for bindings
whose output configs are SQL NULL and restores NOT NULL. Binding descriptions
and non-null output configs are left as stored.
"""

from typing import Any, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = JSON().with_variant(postgresql.JSONB(), "postgresql").with_variant(JSONB(), "sqlite")

# revision identifiers, used by Alembic.
revision: str = "ef09e3bc213f"
down_revision: Union[str, None] = "a7f1c3e9d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_json_null(column: str) -> str:
    if op.get_bind().dialect.name == "postgresql":
        return f"jsonb_typeof({column}) = 'null'"
    return f"json_type({column}) = 'null'"


def _is_empty_json_array(column: str) -> str:
    if op.get_bind().dialect.name == "postgresql":
        # JSONB equality, because PostgreSQL may evaluate jsonb_array_length, which
        # rejects non-arrays, before a jsonb_typeof guard in the same conjunction.
        return f"{column} = '[]'::jsonb"
    return f"json_type({column}) = 'array' AND json_array_length({column}) = 0"


def upgrade() -> None:
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.alter_column("output_configs", existing_type=JSON_, nullable=True)
    op.execute(
        "UPDATE dataset_evaluators SET output_configs = NULL "
        f"WHERE {_is_json_null('output_configs')}"
    )
    op.execute(
        "UPDATE dataset_evaluators SET output_configs = NULL "
        f"WHERE {_is_empty_json_array('output_configs')}"
    )
    op.add_column("llm_evaluators", sa.Column("input_schema", JSON_, nullable=True))
    op.add_column("code_evaluators", sa.Column("input_schema", JSON_, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("code_evaluators") as batch_op:
        batch_op.drop_column("input_schema")
    with op.batch_alter_table("llm_evaluators") as batch_op:
        batch_op.drop_column("input_schema")
    op.execute("UPDATE dataset_evaluators SET output_configs = 'null' WHERE output_configs IS NULL")
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.alter_column("output_configs", existing_type=JSON_, nullable=False)
