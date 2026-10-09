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
- llm_evaluators.prompt_version_tag_id becomes ON DELETE RESTRICT, so the
  database refuses to delete a prompt version tag an LLM evaluator runs
  through. Without its tag the evaluator would run the prompt's latest version,
  whatever is saved there next.

The downgrade first restores ON DELETE SET NULL on
llm_evaluators.prompt_version_tag_id. It stores JSON null for bindings whose
output configs are SQL NULL and restores NOT NULL. Binding descriptions and
non-null output configs are left as stored.
"""

from typing import Any, Sequence, Union

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

_PROMPT_VERSION_TAG_FK = "fk_llm_evaluators_prompt_version_tag_id_prompt_version_tags"


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
    _set_prompt_version_tag_ondelete("RESTRICT")


def _set_prompt_version_tag_ondelete(ondelete: str) -> None:
    # SQLite cannot alter a foreign key, so batch mode rebuilds the table there.
    with op.batch_alter_table("llm_evaluators") as batch_op:
        batch_op.drop_constraint(_PROMPT_VERSION_TAG_FK, type_="foreignkey")
        batch_op.create_foreign_key(
            _PROMPT_VERSION_TAG_FK,
            "prompt_version_tags",
            ["prompt_version_tag_id"],
            ["id"],
            ondelete=ondelete,
        )


def downgrade() -> None:
    _set_prompt_version_tag_ondelete("SET NULL")
    op.execute("UPDATE dataset_evaluators SET output_configs = 'null' WHERE output_configs IS NULL")
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.alter_column("output_configs", existing_type=JSON_, nullable=False)
