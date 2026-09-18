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
- Bindings of LLM evaluators are reset to inherit. Before this revision an LLM
  evaluator had exactly one binding, created with it, and every mutation that
  wrote the evaluator's description and output configs wrote the same input
  onto that binding, so the values these bindings hold are copies of their
  evaluator's settings, never overrides a user chose.
- Bindings that store an empty output config list are reset to inherit. An
  override needs at least one config, and the experiment runner already reads
  an empty list as inherit, so SQL NULL becomes the only encoding of inherit.
- Bindings of code evaluators are reset to inherit each setting that equals
  their evaluator's: the description where it equals evaluators.description,
  and the output configs where they equal code_evaluators.output_configs. The
  dataset evaluator dialog wrote the same description and output configs onto
  the code evaluator and its binding, so an equal value is a copy; a value that
  differs is an override and stays.
- llm_evaluators.prompt_version_tag_id becomes ON DELETE RESTRICT, so the
  database refuses to delete a prompt version tag an LLM evaluator runs
  through. Without its tag the evaluator would run the prompt's latest version,
  whatever is saved there next.

The downgrade first restores ON DELETE SET NULL on
llm_evaluators.prompt_version_tag_id. It then copies each LLM evaluator's
settings back onto its inheriting bindings, stores JSON null for the remaining
inheriting bindings, and restores NOT NULL. Code bindings stay inheriting:
before this revision the resolvers and the experiment runner already read a
NULL description and JSON null output configs as inherit.
"""

import json
from typing import Any, Sequence, Union

from alembic import op
from sqlalchemy import JSON, text
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

_LLM_BINDINGS = "evaluator_id IN (SELECT id FROM evaluators WHERE kind = 'LLM')"

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
        f"UPDATE dataset_evaluators SET output_configs = NULL, description = NULL "
        f"WHERE {_LLM_BINDINGS}"
    )
    op.execute(
        "UPDATE dataset_evaluators SET output_configs = NULL "
        f"WHERE {_is_empty_json_array('output_configs')}"
    )
    _reset_code_binding_copies()
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


def _load_json(value: Any) -> Any:
    return json.loads(value) if isinstance(value, (str, bytes)) else value


def _reset_code_binding_copies() -> None:
    # Output configs are compared as parsed JSON values, because the stored text of
    # equal values can differ in key order, spacing, and number formatting on SQLite.
    conn = op.get_bind()
    rows = conn.execute(
        text(
            "SELECT dataset_evaluators.id, dataset_evaluators.description, "
            "evaluators.description, dataset_evaluators.output_configs, "
            "code_evaluators.output_configs "
            "FROM dataset_evaluators "
            "JOIN evaluators ON evaluators.id = dataset_evaluators.evaluator_id "
            "LEFT JOIN code_evaluators ON code_evaluators.id = evaluators.id "
            "WHERE evaluators.kind = 'CODE' AND ("
            "dataset_evaluators.description IS NOT NULL "
            "OR dataset_evaluators.output_configs IS NOT NULL)"
        )
    ).all()
    description_copies: list[dict[str, int]] = []
    output_config_copies: list[dict[str, int]] = []
    for id_, description, evaluator_description, output_configs, evaluator_output_configs in rows:
        if description is not None and description == evaluator_description:
            description_copies.append({"id": id_})
        if (
            output_configs is not None
            and evaluator_output_configs is not None
            and _load_json(output_configs) == _load_json(evaluator_output_configs)
        ):
            output_config_copies.append({"id": id_})
    if description_copies:
        conn.execute(
            text("UPDATE dataset_evaluators SET description = NULL WHERE id = :id"),
            description_copies,
        )
    if output_config_copies:
        conn.execute(
            text("UPDATE dataset_evaluators SET output_configs = NULL WHERE id = :id"),
            output_config_copies,
        )


def downgrade() -> None:
    _set_prompt_version_tag_ondelete("SET NULL")
    op.execute(
        "UPDATE dataset_evaluators SET output_configs = ("
        "SELECT llm_evaluators.output_configs FROM llm_evaluators "
        "WHERE llm_evaluators.id = dataset_evaluators.evaluator_id"
        f") WHERE output_configs IS NULL AND {_LLM_BINDINGS}"
    )
    op.execute(
        "UPDATE dataset_evaluators SET description = ("
        "SELECT evaluators.description FROM evaluators "
        "WHERE evaluators.id = dataset_evaluators.evaluator_id"
        f") WHERE description IS NULL AND {_LLM_BINDINGS}"
    )
    op.execute("UPDATE dataset_evaluators SET output_configs = 'null' WHERE output_configs IS NULL")
    with op.batch_alter_table("dataset_evaluators") as batch_op:
        batch_op.alter_column("output_configs", existing_type=JSON_, nullable=False)
