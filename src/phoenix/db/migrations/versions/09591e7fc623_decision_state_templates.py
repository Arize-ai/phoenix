"""decision state templates

A decision's state becomes a text or JSON template whose variable tags are its
variables, as a prompt's template is. The version gains ``template_format`` (one per
version, covering the state and the question fields) and loses its declared ``inputs``.
Every stored copy of a definition is converted the same way: decision versions, decision
experiment task configs, inline decision evaluator definitions frozen on evaluator tasks,
and the decision evaluator snapshots on experiment jobs.

- ``{type: object}`` with inputs ``[a, b]`` becomes MUSTACHE
  ``{type: json, template: {"a": "{{a}}", "b": "{{b}}"}}``
- ``{type: input, name: x}`` becomes MUSTACHE ``{type: json, template: "{{x}}"}``
- ``{type: text, template, template_format}`` moves ``template_format`` up to the
  definition and keeps ``{type: text, template}``

A task config's ``input_values_path`` is renamed ``template_variables_path``. The columns
holding state templates become JSON rather than JSONB on PostgreSQL, so a JSON template's
object keys keep their order (as prompt tools do).

The downgrade is best-effort: a JSON template that is exactly each name mapped to its own
tag becomes an object state, a template that is one whole tag becomes an input state, and
anything else becomes a text template (JSON rendered as text) whose inputs are the
variables it uses.

Revision ID: 09591e7fc623
Revises: e724eb2ee5cf
Create Date: 2026-10-29 13:43:50.673988

"""

import json
import re
from string import Formatter
from typing import Any, Callable, Optional, Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import JSON
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles

# revision identifiers, used by Alembic.
revision: str = "09591e7fc623"
down_revision: Union[str, None] = "e724eb2ee5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


class JSONB(JSON):
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
def _(*args: Any, **kwargs: Any) -> str:
    return "JSONB"


JSON_ = JSON().with_variant(postgresql.JSONB(), "postgresql").with_variant(JSONB(), "sqlite")

_TEMPLATE_FORMATS = "template_format IN ('F_STRING', 'MUSTACHE', 'NONE')"

Definition = dict[str, Any]


# Upgrade conversions ------------------------------------------------------------------


def _upgrade_definition(
    definition: Definition, inputs: Optional[list[dict[str, Any]]] = None
) -> Definition:
    """Convert a definition holding ``inputs`` and ``state`` (and maybe more) in place.

    A definition already in the new shape is returned unchanged.
    """
    if inputs is None:
        inputs = definition.pop("inputs", None) or []
    state = definition.get("state") or {}
    kind = state.get("type")
    if kind == "object":
        definition["template_format"] = "MUSTACHE"
        definition["state"] = {
            "type": "json",
            "template": {input["name"]: "{{" + input["name"] + "}}" for input in inputs},
        }
    elif kind == "input":
        definition["template_format"] = "MUSTACHE"
        definition["state"] = {"type": "json", "template": "{{" + state["name"] + "}}"}
    elif kind == "text" and "template_format" in state:
        definition["template_format"] = state["template_format"]
        definition["state"] = {"type": "text", "template": state["template"]}
    definition.setdefault("template_format", "MUSTACHE")
    return definition


def _upgrade_task_config(config: Definition) -> Definition:
    _upgrade_definition(config)
    if "input_values_path" in config:
        config["template_variables_path"] = config.pop("input_values_path")
    return config


def _upgrade_evaluator_definition(definition: Definition) -> Definition:
    if definition.get("type") == "inline_decision_evaluator":
        _upgrade_definition(definition)
    return definition


def _upgrade_snapshots(snapshots: list[Definition]) -> list[Definition]:
    for snapshot in snapshots:
        if isinstance(snapshot.get("definition"), dict):
            _upgrade_evaluator_definition(snapshot["definition"])
    return snapshots


# Downgrade conversions ----------------------------------------------------------------

_MUSTACHE_TAG = re.compile(r"\{\{\{?\s*[#^&]?\s*([^\s{}#^/!>&=.][^\s{}]*)\s*\}?\}\}")
_MUSTACHE_WHOLE_TAG = re.compile(r"\{\{\s*([^\s{}#^/!>&=.][^\s{}]*)\s*\}\}")


def _variables(template_format: str, text: str) -> list[str]:
    """Root variable names in a template, approximately, for rebuilding inputs."""
    names: list[str] = []
    if template_format == "MUSTACHE":
        names = [match.group(1).split(".")[0] for match in _MUSTACHE_TAG.finditer(text)]
    elif template_format == "F_STRING":
        try:
            fields = [field for _, field, _, _ in Formatter().parse(text) if field]
        except ValueError:
            fields = []
        names = [re.split(r"[.\[]", field)[0] for field in fields]
    return list(dict.fromkeys(name for name in names if name))


def _leaves(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [leaf for item in value.values() for leaf in _leaves(item)]
    if isinstance(value, list):
        return [leaf for item in value for leaf in _leaves(item)]
    return []


def _downgrade_definition(definition: Definition) -> tuple[Definition, list[dict[str, Any]]]:
    """Convert a definition back in place; return it with the inputs to declare."""
    template_format = definition.pop("template_format", "MUSTACHE")
    state = definition.get("state") or {}
    kind = state.get("type")
    if kind not in ("text", "json"):
        # Already in the old shape.
        return definition, []
    template = state.get("template")
    if kind == "json" and template_format == "MUSTACHE":
        if (
            isinstance(template, dict)
            and template
            and all(value == "{{" + key + "}}" for key, value in template.items())
        ):
            definition["state"] = {"type": "object"}
            return definition, [_input(name) for name in template]
        if isinstance(template, str) and (match := _MUSTACHE_WHOLE_TAG.fullmatch(template)):
            name = match.group(1)
            if "." not in name:
                definition["state"] = {"type": "input", "name": name}
                return definition, [_input(name)]
    text = template if isinstance(template, str) else json.dumps(template, ensure_ascii=False)
    # The old text state had no literal format; NONE text is read as Mustache.
    old_format = template_format if template_format in ("MUSTACHE", "F_STRING") else "MUSTACHE"
    definition["state"] = {"type": "text", "template": text, "template_format": old_format}
    texts = _leaves(template) if kind == "json" else [text]
    for question in definition.get("questions") or []:
        texts.append(question.get("instructions") or "")
    names: list[str] = []
    if template_format != "NONE":
        for item in texts:
            names.extend(_variables(template_format, item))
    return definition, [_input(name) for name in dict.fromkeys(names)]


def _input(name: str) -> dict[str, Any]:
    return {"name": name, "description": None, "json_schema": None}


def _downgrade_embedded(definition: Definition) -> Definition:
    """Convert a definition that carries its own inputs (a task config or evaluator)."""
    if definition.get("state", {}).get("type") in ("text", "json"):
        definition, inputs = _downgrade_definition(definition)
        definition["inputs"] = inputs
    return definition


def _downgrade_task_config(config: Definition) -> Definition:
    _downgrade_embedded(config)
    if "template_variables_path" in config:
        config["input_values_path"] = config.pop("template_variables_path")
    return config


def _downgrade_evaluator_definition(definition: Definition) -> Definition:
    if definition.get("type") == "inline_decision_evaluator":
        _downgrade_embedded(definition)
    return definition


def _downgrade_snapshots(snapshots: list[Definition]) -> list[Definition]:
    for snapshot in snapshots:
        if isinstance(snapshot.get("definition"), dict):
            _downgrade_evaluator_definition(snapshot["definition"])
    return snapshots


# Row rewriting ------------------------------------------------------------------------


def _rewrite(
    table_name: str,
    column_name: str,
    convert: Callable[[Any], Any],
    where: Optional[tuple[str, str]] = None,
    column_type: Any = JSON,
) -> None:
    """Rewrite one JSON column row by row with ``convert``, optionally where a string
    column equals a value.

    The template columns are bound as plain JSON: a JSONB bind is cast to JSONB on
    PostgreSQL, which would reorder object keys on the way into a JSON column.
    """
    columns = [sa.column("id", sa.Integer), sa.column(column_name, column_type)]
    if where is not None:
        columns.append(sa.column(where[0], sa.String))
    table = sa.table(table_name, *columns)
    stmt = sa.select(table.c.id, table.c[column_name])
    if where is not None:
        stmt = stmt.where(table.c[where[0]] == where[1])
    connection = op.get_bind()
    for row_id, value in connection.execute(stmt).all():
        if value is None:
            continue
        converted = convert(json.loads(json.dumps(value)))
        if converted != value:
            connection.execute(
                sa.update(table).where(table.c.id == row_id).values({column_name: converted})
            )


# Columns holding state templates. JSON rather than JSONB, so a JSON template's object
# keys keep the order they were written in, as for prompt tools.
_TEMPLATE_COLUMNS = (
    ("decision_versions", "state"),
    ("experiment_decision_tasks", "config"),
    ("experiment_jobs", "decision_evaluator_snapshots"),
)


def _set_template_column_types(*, ordered: bool) -> None:
    for table_name, column_name in _TEMPLATE_COLUMNS:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.alter_column(
                column_name,
                type_=JSON if ordered else JSON_,
                existing_type=JSON_ if ordered else JSON,
                existing_nullable=False,
                postgresql_using=f"{column_name}::{'json' if ordered else 'jsonb'}",
            )


def upgrade() -> None:
    connection = op.get_bind()
    _set_template_column_types(ordered=True)
    with op.batch_alter_table("decision_versions") as batch_op:
        batch_op.add_column(sa.Column("template_format", sa.String, nullable=True))

    versions = sa.table(
        "decision_versions",
        sa.column("id", sa.Integer),
        sa.column("inputs", JSON_),
        sa.column("state", JSON),
        sa.column("template_format", sa.String),
    )
    for row_id, inputs, state in connection.execute(
        sa.select(versions.c.id, versions.c.inputs, versions.c.state)
    ).all():
        definition = _upgrade_definition({"state": state}, inputs or [])
        connection.execute(
            sa.update(versions)
            .where(versions.c.id == row_id)
            .values(template_format=definition["template_format"], state=definition["state"])
        )

    with op.batch_alter_table("decision_versions") as batch_op:
        batch_op.alter_column("template_format", nullable=False, existing_nullable=True)
        batch_op.create_check_constraint(
            constraint_name="template_format", condition=_TEMPLATE_FORMATS
        )
        batch_op.drop_column("inputs")

    _rewrite("experiment_decision_tasks", "config", _upgrade_task_config)
    _rewrite(
        "experiment_evaluator_tasks",
        "definition",
        _upgrade_evaluator_definition,
        where=("evaluator_kind", "DECISION"),
        column_type=JSON_,
    )
    _rewrite("experiment_jobs", "decision_evaluator_snapshots", _upgrade_snapshots)


def downgrade() -> None:
    connection = op.get_bind()
    with op.batch_alter_table("decision_versions") as batch_op:
        batch_op.add_column(sa.Column("inputs", JSON_, nullable=True))

    versions = sa.table(
        "decision_versions",
        sa.column("id", sa.Integer),
        sa.column("inputs", JSON_),
        sa.column("state", JSON),
        sa.column("questions", JSON_),
        sa.column("template_format", sa.String),
    )
    for row_id, state, questions, template_format in connection.execute(
        sa.select(versions.c.id, versions.c.state, versions.c.questions, versions.c.template_format)
    ).all():
        definition, inputs = _downgrade_definition(
            {"template_format": template_format, "state": state, "questions": questions}
        )
        connection.execute(
            sa.update(versions)
            .where(versions.c.id == row_id)
            .values(inputs=inputs, state=definition["state"])
        )

    with op.batch_alter_table("decision_versions") as batch_op:
        batch_op.alter_column("inputs", nullable=False, existing_nullable=True)
        batch_op.drop_constraint(constraint_name="template_format", type_="check")
        batch_op.drop_column("template_format")

    _rewrite("experiment_decision_tasks", "config", _downgrade_task_config)
    _rewrite(
        "experiment_evaluator_tasks",
        "definition",
        _downgrade_evaluator_definition,
        where=("evaluator_kind", "DECISION"),
        column_type=JSON_,
    )
    _rewrite("experiment_jobs", "decision_evaluator_snapshots", _downgrade_snapshots)
    _set_template_column_types(ordered=False)
