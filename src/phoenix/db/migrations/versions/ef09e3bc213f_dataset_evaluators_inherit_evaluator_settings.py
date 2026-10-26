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
- Every LLM evaluator runs the prompt version its tag points at. An evaluator
  whose tag was deleted, which ON DELETE SET NULL allowed, ran its prompt's
  newest version instead. Each such evaluator gets a new tag on that version,
  named "{evaluator name}-evaluator-{8 hex digits}" like the tags evaluators
  are created with, so it keeps running the same version.
- llm_evaluators.prompt_version_tag_id becomes NOT NULL and ON DELETE RESTRICT,
  so the database refuses to delete a prompt version tag an LLM evaluator runs
  through.

The downgrade first makes llm_evaluators.prompt_version_tag_id nullable and
ON DELETE SET NULL again; the generated tags are kept. It stores JSON null for
bindings whose output configs are SQL NULL and restores NOT NULL. Binding
descriptions and non-null output configs are left as stored.
"""

from secrets import token_hex
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
    _tag_untagged_llm_evaluators()
    _set_prompt_version_tag_id(nullable=False, ondelete="RESTRICT")


def _tag_untagged_llm_evaluators() -> None:
    bind = op.get_bind()
    untagged = bind.execute(
        sa.text(
            "SELECT llm_evaluators.id, evaluators.name, llm_evaluators.prompt_id, "
            "(SELECT MAX(prompt_versions.id) FROM prompt_versions "
            "WHERE prompt_versions.prompt_id = llm_evaluators.prompt_id) "
            "FROM llm_evaluators JOIN evaluators ON evaluators.id = llm_evaluators.id "
            "WHERE llm_evaluators.prompt_version_tag_id IS NULL"
        )
    ).all()
    for evaluator_id, evaluator_name, prompt_id, prompt_version_id in untagged:
        taken = set(
            bind.execute(
                sa.text("SELECT name FROM prompt_version_tags WHERE prompt_id = :prompt_id"),
                {"prompt_id": prompt_id},
            ).scalars()
        )
        name = f"{evaluator_name}-evaluator-{token_hex(4)}"
        while name in taken:
            name = f"{evaluator_name}-evaluator-{token_hex(4)}"
        tag_id = bind.execute(
            sa.text(
                "INSERT INTO prompt_version_tags (name, prompt_id, prompt_version_id) "
                "VALUES (:name, :prompt_id, :prompt_version_id) RETURNING id"
            ),
            {"name": name, "prompt_id": prompt_id, "prompt_version_id": prompt_version_id},
        ).scalar_one()
        bind.execute(
            sa.text("UPDATE llm_evaluators SET prompt_version_tag_id = :tag_id WHERE id = :id"),
            {"tag_id": tag_id, "id": evaluator_id},
        )


def _set_prompt_version_tag_id(*, nullable: bool, ondelete: str) -> None:
    # SQLite cannot alter a foreign key, so batch mode rebuilds the table there.
    with op.batch_alter_table("llm_evaluators") as batch_op:
        batch_op.alter_column(
            "prompt_version_tag_id", existing_type=sa.Integer(), nullable=nullable
        )
        batch_op.drop_constraint(_PROMPT_VERSION_TAG_FK, type_="foreignkey")
        batch_op.create_foreign_key(
            _PROMPT_VERSION_TAG_FK,
            "prompt_version_tags",
            ["prompt_version_tag_id"],
            ["id"],
            ondelete=ondelete,
        )


def downgrade() -> None:
    _set_prompt_version_tag_id(nullable=True, ondelete="SET NULL")
    op.execute("UPDATE dataset_evaluators SET output_configs = 'null' WHERE output_configs IS NULL")
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.alter_column("output_configs", existing_type=JSON_, nullable=False)
