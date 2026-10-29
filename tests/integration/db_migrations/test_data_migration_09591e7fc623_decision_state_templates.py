"""
Data migration test for decision state templates.

The migration replaces a version's declared ``inputs`` and its ``object`` / ``input`` /
``text`` state kinds with a version-level ``template_format`` and a text or JSON state
template, in every stored copy of a definition: decision versions, decision experiment
task configs (whose ``input_values_path`` becomes ``template_variables_path``), inline
decision evaluator definitions on evaluator tasks, and decision evaluator snapshots on
experiment jobs. Its downgrade restores the old shapes where it can and falls back to a
text template whose inputs are the variables it uses.
"""

from datetime import datetime, timezone
from typing import Any, Literal

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncEngine

from . import _down, _run_async, _up, _verify_clean_state

_DOWN = "e724eb2ee5cf"
_UP = "09591e7fc623"

_JSON = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
# The columns that hold state templates are JSON after the upgrade, so a JSON template's
# keys keep their order; a JSONB bind would be cast, and reordered, on PostgreSQL.
_ORDERED_JSON = sa.JSON()

_QUESTIONS = [{"type": "predicate", "name": "ok", "instructions": "Is it ok?"}]


def _input(name: str, description: str | None = None) -> dict[str, Any]:
    return {"name": name, "description": description, "json_schema": None}


_OLD_OBJECT = {
    "inputs": [_input("reference", "The answer"), _input("output")],
    "state": {"type": "object"},
}
_OLD_INPUT = {"inputs": [_input("state")], "state": {"type": "input", "name": "state"}}
_OLD_TEXT = {
    "inputs": [_input("ticket")],
    "state": {"type": "text", "template": "Ticket: {ticket}", "template_format": "F_STRING"},
}

_NEW_OBJECT = {
    "template_format": "MUSTACHE",
    "state": {"type": "json", "template": {"reference": "{{reference}}", "output": "{{output}}"}},
}
_NEW_INPUT = {"template_format": "MUSTACHE", "state": {"type": "json", "template": "{{state}}"}}
_NEW_TEXT = {
    "template_format": "F_STRING",
    "state": {"type": "text", "template": "Ticket: {ticket}"},
}

_versions = sa.table(
    "decision_versions",
    sa.column("id", sa.Integer),
    sa.column("decision_id", sa.Integer),
    sa.column("inputs", _JSON),
    sa.column("state", _ORDERED_JSON),
    sa.column("questions", _JSON),
    sa.column("template_format", sa.String),
    sa.column("model_provider", sa.String),
    sa.column("model_name", sa.String),
    sa.column("metadata", _JSON),
    sa.column("created_at", sa.TIMESTAMP(timezone=True)),
)
_decision_tasks = sa.table(
    "experiment_decision_tasks",
    sa.column("id", sa.Integer),
    sa.column("type", sa.String),
    sa.column("model_provider", sa.String),
    sa.column("model_name", sa.String),
    sa.column("config", _ORDERED_JSON),
)
_evaluator_tasks = sa.table(
    "experiment_evaluator_tasks",
    sa.column("id", sa.Integer),
    sa.column("type", sa.String),
    sa.column("name", sa.String),
    sa.column("evaluator_kind", sa.String),
    sa.column("definition", _JSON),
    sa.column("input_mapping", _JSON),
    sa.column("output_configs", _JSON),
)
_jobs = sa.table(
    "experiment_jobs",
    sa.column("id", sa.Integer),
    sa.column("type", sa.String),
    sa.column("decision_evaluator_snapshots", _ORDERED_JSON),
)


def _inline_evaluator(definition: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "inline_decision_evaluator",
        "name": "accuracy",
        "description": None,
        **definition,
        "questions": _QUESTIONS,
        "model_provider": "TYPESAFE",
        "model_name": "jev-latest",
        "custom_provider_id": None,
    }


async def test_decision_state_templates_migration(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)

    def seed(conn: Connection) -> dict[str, int]:
        now = datetime.now(timezone.utc)
        decision_id = conn.execute(
            sa.text(
                "INSERT INTO decisions (name, metadata, created_at, updated_at) "
                "VALUES ('triage', '{}', :now, :now) RETURNING id"
            ),
            {"now": now},
        ).scalar_one()
        ids = {}
        for key, definition in (
            ("object", _OLD_OBJECT),
            ("input", _OLD_INPUT),
            ("text", _OLD_TEXT),
        ):
            ids[key] = conn.execute(
                sa.insert(_versions)
                .values(
                    decision_id=decision_id,
                    inputs=definition["inputs"],
                    state=definition["state"],
                    questions=_QUESTIONS,
                    model_provider="TYPESAFE",
                    model_name="jev-latest",
                    metadata={},
                    created_at=now,
                )
                .returning(_versions.c.id)
            ).scalar_one()
        experiment_ids = []
        for name in ("decision", "evaluator"):
            dataset_id = conn.execute(
                sa.text(
                    "INSERT INTO datasets (name, metadata, created_at, updated_at) "
                    "VALUES (:name, '{}', :now, :now) RETURNING id"
                ),
                {"name": name, "now": now},
            ).scalar_one()
            dataset_version_id = conn.execute(
                sa.text(
                    "INSERT INTO dataset_versions (dataset_id, metadata, created_at) "
                    "VALUES (:dataset_id, '{}', :now) RETURNING id"
                ),
                {"dataset_id": dataset_id, "now": now},
            ).scalar_one()
            experiment_ids.append(
                conn.execute(
                    sa.text(
                        "INSERT INTO experiments (dataset_id, dataset_version_id, name, "
                        "repetitions, metadata, created_at, updated_at) VALUES (:dataset_id, "
                        ":version_id, :name, 1, '{}', :now, :now) RETURNING id"
                    ),
                    {
                        "dataset_id": dataset_id,
                        "version_id": dataset_version_id,
                        "name": name,
                        "now": now,
                    },
                ).scalar_one()
            )
        decision_experiment_id, evaluator_experiment_id = experiment_ids
        conn.execute(
            sa.insert(_jobs).values(
                id=decision_experiment_id,
                type="DECISION",
                decision_evaluator_snapshots=[
                    {
                        "definition": _inline_evaluator(_OLD_OBJECT),
                        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
                        "project_id": 1,
                    }
                ],
            )
        )
        conn.execute(
            sa.insert(_decision_tasks).values(
                id=decision_experiment_id,
                type="DECISION",
                model_provider="TYPESAFE",
                model_name="jev-latest",
                config={**_OLD_INPUT, "questions": _QUESTIONS, "input_values_path": "input"},
            )
        )
        conn.execute(
            sa.insert(_jobs).values(
                id=evaluator_experiment_id, type="EVALUATOR", decision_evaluator_snapshots=[]
            )
        )
        conn.execute(
            sa.insert(_evaluator_tasks).values(
                id=evaluator_experiment_id,
                type="EVALUATOR",
                name="accuracy",
                evaluator_kind="DECISION",
                definition=_inline_evaluator(_OLD_TEXT),
                input_mapping={"literal_mapping": {}, "path_mapping": {}},
                output_configs=[],
            )
        )
        conn.commit()
        return {
            **ids,
            "decision": decision_id,
            "decision_experiment": decision_experiment_id,
            "evaluator_experiment": evaluator_experiment_id,
        }

    ids = await _run_async(_engine, seed)
    await _up(_engine, _alembic_config, _UP, _schema)

    def read_versions(conn: Connection) -> dict[int, dict[str, Any]]:
        rows = conn.execute(
            sa.select(_versions.c.id, _versions.c.template_format, _versions.c.state)
        ).all()
        return {
            row.id: {"template_format": row.template_format, "state": row.state} for row in rows
        }

    versions = await _run_async(_engine, read_versions)
    assert versions[ids["object"]] == _NEW_OBJECT
    assert versions[ids["input"]] == _NEW_INPUT
    assert versions[ids["text"]] == _NEW_TEXT
    assert "inputs" not in await _run_async(
        _engine,
        lambda conn: {
            column["name"] for column in sa.inspect(conn).get_columns("decision_versions")
        },
    )

    def read_copies(conn: Connection) -> tuple[Any, Any, Any]:
        config = conn.execute(
            sa.select(_decision_tasks.c.config).where(
                _decision_tasks.c.id == ids["decision_experiment"]
            )
        ).scalar_one()
        definition = conn.execute(
            sa.select(_evaluator_tasks.c.definition).where(
                _evaluator_tasks.c.id == ids["evaluator_experiment"]
            )
        ).scalar_one()
        snapshots = conn.execute(
            sa.select(_jobs.c.decision_evaluator_snapshots).where(
                _jobs.c.id == ids["decision_experiment"]
            )
        ).scalar_one()
        return config, definition, snapshots

    config, definition, snapshots = await _run_async(_engine, read_copies)
    assert config == {**_NEW_INPUT, "questions": _QUESTIONS, "template_variables_path": "input"}
    assert definition == _inline_evaluator(_NEW_TEXT)
    assert snapshots[0]["definition"] == _inline_evaluator(_NEW_OBJECT)

    # Versions saved after the upgrade, including one the downgrade can't map back exactly.
    def insert_new(conn: Connection, template_format: str, state: Any) -> int:
        try:
            row_id = conn.execute(
                sa.insert(_versions)
                .values(
                    decision_id=ids["decision"],
                    template_format=template_format,
                    state=state,
                    questions=[
                        {"type": "predicate", "name": "ok", "instructions": "Is {{who}} ok?"}
                    ],
                    model_provider="TYPESAFE",
                    model_name="jev-latest",
                    metadata={},
                    created_at=datetime.now(timezone.utc),
                )
                .returning(_versions.c.id)
            ).scalar_one()
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        assert isinstance(row_id, int)
        return row_id

    mixed = await _run_async(
        _engine,
        lambda conn: insert_new(
            conn,
            "MUSTACHE",
            {"type": "json", "template": {"customer": "{{customer}}", "since": "Since {{since}}"}},
        ),
    )
    with pytest.raises(Exception, match="template_format"):
        await _run_async(
            _engine, lambda conn: insert_new(conn, "JINJA", {"type": "text", "template": "x"})
        )

    await _down(_engine, _alembic_config, _DOWN, _schema)

    def read_old_versions(conn: Connection) -> dict[int, dict[str, Any]]:
        rows = conn.execute(sa.select(_versions.c.id, _versions.c.inputs, _versions.c.state)).all()
        return {row.id: {"inputs": row.inputs, "state": row.state} for row in rows}

    old = await _run_async(_engine, read_old_versions)
    # Descriptions of inputs are not recoverable; everything else is.
    assert old[ids["object"]] == {
        "inputs": [_input("reference"), _input("output")],
        "state": {"type": "object"},
    }
    assert old[ids["input"]] == _OLD_INPUT
    assert old[ids["text"]] == _OLD_TEXT
    # A JSON template that is not each name mapped to its own tag becomes text whose inputs
    # are the variables it uses, the questions' included.
    assert old[mixed] == {
        "inputs": [_input("customer"), _input("since"), _input("who")],
        "state": {
            "type": "text",
            "template": '{"customer": "{{customer}}", "since": "Since {{since}}"}',
            "template_format": "MUSTACHE",
        },
    }
    config, definition, snapshots = await _run_async(_engine, read_copies)
    assert config == {**_OLD_INPUT, "questions": _QUESTIONS, "input_values_path": "input"}
    assert definition == _inline_evaluator(_OLD_TEXT)
    assert snapshots[0]["definition"] == _inline_evaluator(
        {"inputs": [_input("reference"), _input("output")], "state": {"type": "object"}}
    )
