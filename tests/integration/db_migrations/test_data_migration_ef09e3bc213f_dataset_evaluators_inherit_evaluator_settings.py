import json
from datetime import datetime, timezone
from typing import Any, Literal, NamedTuple, Optional

import pytest
from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.db.types.annotation_configs import OutputConfig

from . import _down, _get_table_schema_info, _run_async, _TableSchemaInfo, _up

_DOWN = "a7f1c3e9d2b4"
_UP = "ef09e3bc213f"

_INPUT_MAPPING: dict[str, dict[str, str]] = {"literal_mapping": {}, "path_mapping": {}}

_TAG_FK = "fk_llm_evaluators_prompt_version_tag_id_prompt_version_tags"
_INTEGRITY_ERRORS = (SQLAlchemyIntegrityError, SQLiteIntegrityError)


def _categorical(name: str, *labels: str) -> list[dict[str, Any]]:
    return [
        {
            "type": "CATEGORICAL",
            "name": name,
            "optimization_direction": "MAXIMIZE",
            "values": [{"label": label, "score": float(i == 0)} for i, label in enumerate(labels)],
        }
    ]


# The shared definition of each LLM evaluator.
_LLM_CONFIGS = _categorical("correctness", "correct", "incorrect")
_STALE_LLM_CONFIGS = _categorical("hallucination", "factual", "hallucinated", "unsure")
# What the stale binding still holds: its evaluator's outputs before a later edit.
_STALE_COPY = _categorical("hallucination", "factual", "hallucinated")
_CODE_OVERRIDE = [
    {
        "type": "CONTINUOUS",
        "name": "latency",
        "optimization_direction": "MINIMIZE",
        "lower_bound": 0.0,
        "upper_bound": None,
        "description": None,
    }
]
# The shared definition of a code evaluator, and a dataset override of its outputs.
_CODE_CONFIGS = _categorical("exact_match", "match", "mismatch")
_CODE_CONFIGS_OVERRIDE = _categorical("exact_match", "same", "different")
_BUILTIN_OVERRIDE = _categorical("contains", "yes", "no")
# Written after the upgrade, standing in for an override set through the dataset evaluator API.
_NEW_OVERRIDE = _categorical("correctness", "right", "wrong")


class _Seed(NamedTuple):
    llm: int
    stale_llm: int
    code: int
    builtin_inherits: int
    builtin_override: int
    code_empty: int
    builtin_empty: int
    code_copy: int
    code_description_copy: int
    code_configs_copy: int
    code_override: int
    llm_evaluator: int
    stale_llm_evaluator: int
    tag: int


class _Binding(NamedTuple):
    description: Any
    output_configs: Any
    is_sql_null: bool
    is_json_null: bool


def _json(value: Any) -> str:
    return json.dumps(value)


def _insert(conn: Connection, sql: str, **params: Any) -> int:
    rowid = conn.execute(text(sql + " RETURNING id"), params).scalar()
    assert isinstance(rowid, int)
    return rowid


def _seed(conn: Connection) -> _Seed:
    now = datetime.now(timezone.utc)
    project = _insert(conn, "INSERT INTO projects (name) VALUES ('evaluators')")
    dataset = _insert(conn, "INSERT INTO datasets (name, metadata) VALUES ('qa', :m)", m=_json({}))
    version = _insert(
        conn,
        "INSERT INTO dataset_versions (dataset_id, metadata) VALUES (:d, :m)",
        d=dataset,
        m=_json({}),
    )
    example = _insert(conn, "INSERT INTO dataset_examples (dataset_id) VALUES (:d)", d=dataset)
    prompt = _insert(
        conn, "INSERT INTO prompts (name, metadata) VALUES ('correctness', :m)", m=_json({})
    )
    prompt_version = _insert(
        conn,
        "INSERT INTO prompt_versions (prompt_id, template_type, template_format, template, "
        "invocation_parameters, model_provider, model_name, metadata) "
        "VALUES (:p, 'CHAT', 'MUSTACHE', :t, :i, 'OPENAI', 'gpt-4o-mini', :m)",
        p=prompt,
        t=_json({"type": "chat", "messages": []}),
        i=_json({"type": "openai", "openai": {}}),
        m=_json({}),
    )
    tag = _insert(
        conn,
        "INSERT INTO prompt_version_tags (name, prompt_id, prompt_version_id) "
        "VALUES ('correctness-evaluator-0a1b', :p, :v)",
        p=prompt,
        v=prompt_version,
    )

    def evaluator(name: str, kind: str, description: Optional[str]) -> int:
        return _insert(
            conn,
            "INSERT INTO evaluators (name, description, metadata, kind) "
            "VALUES (:name, :description, :m, :kind)",
            name=name,
            description=description,
            m=_json({}),
            kind=kind,
        )

    def llm_evaluator(name: str, description: Optional[str], configs: list[Any]) -> int:
        evaluator_id = evaluator(name, "LLM", description)
        conn.execute(
            text(
                "INSERT INTO llm_evaluators (id, prompt_id, output_configs) "
                "VALUES (:id, :prompt, :configs)"
            ),
            {"id": evaluator_id, "prompt": prompt, "configs": _json(configs)},
        )
        return evaluator_id

    llm = llm_evaluator("correctness", "shared description", _LLM_CONFIGS)
    # The evaluator runs through the tag; the other one follows the prompt's latest version.
    conn.execute(
        text("UPDATE llm_evaluators SET prompt_version_tag_id = :tag WHERE id = :id"),
        {"tag": tag, "id": llm},
    )
    stale_llm = llm_evaluator("hallucination", None, _STALE_LLM_CONFIGS)
    code = evaluator("latency", "CODE", None)
    exact_match = evaluator("exact_match", "CODE", "exact match")
    conn.execute(
        text(
            "INSERT INTO code_evaluators (id, language, output_configs) "
            "VALUES (:id, 'PYTHON', :configs)"
        ),
        {"id": exact_match, "configs": _json(_CODE_CONFIGS)},
    )
    builtin = evaluator("contains", "BUILTIN", None)
    # The same configs with integral scores, sorted keys, and no whitespace: equal as JSON
    # values but not as text.
    code_configs_copy = json.dumps(
        [
            {**config, "values": [{**v, "score": int(v["score"])} for v in config["values"]]}
            for config in _CODE_CONFIGS
        ],
        sort_keys=True,
        separators=(",", ":"),
    )

    def binding(name: str, evaluator_id: int, description: Optional[str], configs: Any) -> int:
        return _insert(
            conn,
            "INSERT INTO dataset_evaluators "
            "(dataset_id, evaluator_id, name, description, output_configs, input_mapping, "
            "project_id) VALUES (:d, :e, :name, :description, :configs, :mapping, :project)",
            d=dataset,
            e=evaluator_id,
            name=name,
            description=description,
            configs=configs if isinstance(configs, str) else _json(configs),
            mapping=_json(_INPUT_MAPPING),
            project=project,
        )

    seed = _Seed(
        llm=binding("correctness", llm, "shared description", _LLM_CONFIGS),
        stale_llm=binding("hallucination", stale_llm, "old description", _STALE_COPY),
        code=binding("latency", code, "code override", _CODE_OVERRIDE),
        builtin_inherits=binding("contains", builtin, None, None),
        builtin_override=binding("contains_custom", builtin, None, _BUILTIN_OVERRIDE),
        code_empty=binding("latency_empty", code, "empty override", []),
        builtin_empty=binding("contains_empty", builtin, None, []),
        code_copy=binding("exact_match", exact_match, "exact match", code_configs_copy),
        code_description_copy=binding(
            "exact_match_labels", exact_match, "exact match", _CODE_CONFIGS_OVERRIDE
        ),
        code_configs_copy=binding(
            "exact_match_note", exact_match, "dataset note", code_configs_copy
        ),
        code_override=binding(
            "exact_match_custom", exact_match, "dataset note", _CODE_CONFIGS_OVERRIDE
        ),
        llm_evaluator=llm,
        stale_llm_evaluator=stale_llm,
        tag=tag,
    )

    # Rows that cascade from dataset_evaluators, which a SQLite table rebuild must preserve.
    experiment = _insert(
        conn,
        "INSERT INTO experiments (dataset_id, dataset_version_id, name, repetitions, metadata) "
        "VALUES (:d, :v, 'run', 1, :m)",
        d=dataset,
        v=version,
        m=_json({}),
    )
    conn.execute(
        text("INSERT INTO experiment_jobs (id, type) VALUES (:id, 'PROMPT')"), {"id": experiment}
    )
    conn.execute(
        text(
            "INSERT INTO experiment_dataset_evaluators (experiment_id, dataset_evaluator_id) "
            "VALUES (:x, :b)"
        ),
        {"x": experiment, "b": seed.llm},
    )
    run = _insert(
        conn,
        "INSERT INTO experiment_runs "
        "(experiment_id, dataset_example_id, repetition_number, output, start_time, end_time) "
        "VALUES (:x, :e, 1, :o, :now, :now)",
        x=experiment,
        e=example,
        o=_json({}),
        now=now,
    )
    log = _insert(
        conn,
        "INSERT INTO experiment_logs (experiment_id, category, level, message) "
        "VALUES (:x, 'EVAL', 'ERROR', 'failed')",
        x=experiment,
    )
    conn.execute(
        text(
            "INSERT INTO experiment_eval_logs (id, experiment_run_id, dataset_evaluator_id) "
            "VALUES (:id, :run, :b)"
        ),
        {"id": log, "run": run, "b": seed.llm},
    )
    conn.commit()
    return seed


def _is_json_null(db_backend: Literal["sqlite", "postgresql"]) -> str:
    if db_backend == "postgresql":
        return "jsonb_typeof(output_configs) = 'null'"
    return "json_type(output_configs) = 'null'"


def _decode(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str) else value


def _bindings(conn: Connection, db_backend: Literal["sqlite", "postgresql"]) -> dict[int, _Binding]:
    rows = conn.execute(
        text(
            "SELECT id, description, output_configs, output_configs IS NULL, "
            f"COALESCE({_is_json_null(db_backend)}, FALSE) FROM dataset_evaluators"
        )
    ).all()
    return {
        row[0]: _Binding(
            description=row[1],
            output_configs=_decode(row[2]),
            is_sql_null=bool(row[3]),
            is_json_null=bool(row[4]),
        )
        for row in rows
    }


def _child_row_counts(conn: Connection) -> tuple[int, int]:
    return (
        conn.execute(text("SELECT COUNT(*) FROM experiment_dataset_evaluators")).scalar_one(),
        conn.execute(text("SELECT COUNT(*) FROM experiment_eval_logs")).scalar_one(),
    )


def _schema_info(
    conn: Connection,
    db_backend: Literal["sqlite", "postgresql"],
    schema: str,
    table: str = "dataset_evaluators",
) -> _TableSchemaInfo:
    info = _get_table_schema_info(conn, table, db_backend, schema)
    assert info is not None
    return info


class _LLMEvaluatorsTable(NamedTuple):
    """What a SQLite rebuild of llm_evaluators must carry over, and its foreign keys."""

    schema_info: _TableSchemaInfo
    foreign_keys: dict[str, tuple[tuple[str, ...], str, Optional[str]]]
    check_constraints: dict[str, str]
    indexes: dict[str, tuple[str, ...]]
    rows: list[tuple[Any, ...]]


def _llm_evaluators_table(
    conn: Connection, db_backend: Literal["sqlite", "postgresql"], schema: str
) -> _LLMEvaluatorsTable:
    inspector = inspect(conn)
    schema_name = schema or None
    rows = conn.execute(
        text(
            "SELECT id, kind, prompt_id, prompt_version_tag_id, output_configs, updated_at "
            "FROM llm_evaluators ORDER BY id"
        )
    ).all()
    return _LLMEvaluatorsTable(
        schema_info=_schema_info(conn, db_backend, schema, "llm_evaluators"),
        foreign_keys={
            fk["name"]: (
                tuple(fk["constrained_columns"]),
                fk["referred_table"],
                fk["options"].get("ondelete"),
            )
            for fk in inspector.get_foreign_keys("llm_evaluators", schema=schema_name)
            if fk["name"]
        },
        check_constraints={
            ck["name"]: ck["sqltext"]
            for ck in inspector.get_check_constraints("llm_evaluators", schema=schema_name)
            if ck["name"]
        },
        indexes={
            ix["name"]: tuple(c for c in ix["column_names"] if c)
            for ix in inspector.get_indexes("llm_evaluators", schema=schema_name)
            if ix["name"]
        },
        rows=[(*row[:4], _decode(row[4]), row[5]) for row in rows],
    )


def _without_tag_fk(table: _LLMEvaluatorsTable) -> _LLMEvaluatorsTable:
    return table._replace(
        foreign_keys={name: fk for name, fk in table.foreign_keys.items() if name != _TAG_FK}
    )


def _enforce_foreign_keys(conn: Connection, db_backend: Literal["sqlite", "postgresql"]) -> None:
    # The migration engine leaves SQLite foreign keys unenforced, as the server's migrations do.
    if db_backend == "sqlite":
        conn.execute(text("PRAGMA foreign_keys = ON"))


async def test_dataset_evaluators_inherit_evaluator_settings(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    seed = await _run_async(_engine, _seed)

    def _snapshot(
        conn: Connection,
    ) -> tuple[_TableSchemaInfo, dict[int, _Binding], _LLMEvaluatorsTable]:
        return (
            _schema_info(conn, _db_backend, _schema),
            _bindings(conn, _db_backend),
            _llm_evaluators_table(conn, _db_backend, _schema),
        )

    schema_before, before, llm_evaluators_before = await _run_async(_engine, _snapshot)
    assert llm_evaluators_before.foreign_keys[_TAG_FK] == (
        ("prompt_version_tag_id",),
        "prompt_version_tags",
        "SET NULL",
    )
    assert set(llm_evaluators_before.foreign_keys) == {
        "fk_llm_evaluators_kind_evaluators",
        "fk_llm_evaluators_prompt_id_prompts",
        _TAG_FK,
    }
    assert set(llm_evaluators_before.check_constraints) == {
        "ck_llm_evaluators_`valid_evaluator_kind`"
    }
    assert set(llm_evaluators_before.indexes) == {
        "ix_llm_evaluators_prompt_id",
        "ix_llm_evaluators_prompt_version_tag_id",
    }
    assert [row[3] for row in llm_evaluators_before.rows] == [seed.tag, None]
    assert "output_configs" not in schema_before["nullable_column_names"]
    assert before[seed.builtin_inherits].is_json_null
    for binding_id in (seed.code_empty, seed.builtin_empty):
        assert before[binding_id].output_configs == []

    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify_upgraded(conn: Connection) -> None:
        schema_after = _schema_info(conn, _db_backend, _schema)
        assert schema_after["column_names"] == schema_before["column_names"]
        assert schema_after["index_names"] == schema_before["index_names"]
        assert schema_after["constraint_names"] == schema_before["constraint_names"]
        assert schema_after["nullable_column_names"] == (
            schema_before["nullable_column_names"] | {"output_configs"}
        )
        after = _bindings(conn, _db_backend)
        # LLM bindings inherit, including one whose copy had gone stale.
        for binding_id in (seed.llm, seed.stale_llm):
            assert after[binding_id].is_sql_null
            assert after[binding_id].description is None
        # A binding that already inherited stores SQL NULL instead of JSON null.
        assert after[seed.builtin_inherits].is_sql_null
        # An empty override list inherits, keeping the binding's description.
        for binding_id in (seed.code_empty, seed.builtin_empty):
            assert after[binding_id].is_sql_null
            assert after[binding_id].description == before[binding_id].description
        # A code binding inherits each setting it holds as a copy of its evaluator's.
        assert after[seed.code_copy].is_sql_null
        assert after[seed.code_copy].description is None
        assert after[seed.code_description_copy].description is None
        assert after[seed.code_description_copy].output_configs == _CODE_CONFIGS_OVERRIDE
        assert after[seed.code_configs_copy].is_sql_null
        assert after[seed.code_configs_copy].description == "dataset note"
        # Overrides that differ from their evaluator's settings are untouched.
        for binding_id in (seed.code, seed.code_override, seed.builtin_override):
            assert after[binding_id] == before[binding_id]
        assert _child_row_counts(conn) == (1, 1)
        # The tag foreign key refuses deletes; the rest of llm_evaluators, its rows included,
        # survives the SQLite rebuild.
        llm_evaluators_after = _llm_evaluators_table(conn, _db_backend, _schema)
        assert llm_evaluators_after.foreign_keys[_TAG_FK] == (
            ("prompt_version_tag_id",),
            "prompt_version_tags",
            "RESTRICT",
        )
        assert _without_tag_fk(llm_evaluators_after) == _without_tag_fk(llm_evaluators_before)
        if _db_backend == "sqlite":
            assert conn.execute(text("PRAGMA foreign_key_check")).all() == []

    await _run_async(_engine, _verify_upgraded)

    def _tag_delete_is_refused(conn: Connection) -> None:
        _enforce_foreign_keys(conn, _db_backend)
        try:
            with pytest.raises(_INTEGRITY_ERRORS):
                conn.execute(
                    text("DELETE FROM prompt_version_tags WHERE id = :id"), {"id": seed.tag}
                )
        finally:
            conn.rollback()

    await _run_async(_engine, _tag_delete_is_refused)

    def _override_after_upgrade(conn: Connection) -> None:
        conn.execute(
            text("UPDATE dataset_evaluators SET output_configs = :configs WHERE id = :id"),
            {"configs": _json(_NEW_OVERRIDE), "id": seed.llm},
        )
        conn.execute(
            text("UPDATE dataset_evaluators SET description = 'dataset specific' WHERE id = :id"),
            {"id": seed.stale_llm},
        )
        conn.commit()

    await _run_async(_engine, _override_after_upgrade)
    await _down(_engine, _alembic_config, _DOWN, _schema)

    def _verify_downgraded(conn: Connection) -> None:
        assert _schema_info(conn, _db_backend, _schema) == schema_before
        assert _llm_evaluators_table(conn, _db_backend, _schema) == llm_evaluators_before
        after = _bindings(conn, _db_backend)
        # Overrides written after the upgrade survive the downgrade.
        assert after[seed.llm].output_configs == _NEW_OVERRIDE
        assert after[seed.stale_llm].description == "dataset specific"
        # Inheriting LLM bindings get their evaluator's current settings back.
        assert after[seed.llm].description == "shared description"
        assert after[seed.stale_llm].output_configs == _STALE_LLM_CONFIGS
        # The copied-back LLM configs parse the way the binding's column type reads them.
        restored = [
            OutputConfig.model_validate(config).root
            for config in after[seed.stale_llm].output_configs
        ]
        assert [config.name for config in restored] == ["hallucination"]
        # Other inheriting bindings store JSON null again, which the resolvers and the
        # experiment runner before this revision also read as inherit.
        for binding_id in (
            seed.builtin_inherits,
            seed.code_empty,
            seed.builtin_empty,
            seed.code_copy,
            seed.code_configs_copy,
        ):
            assert after[binding_id].is_json_null
        # Code bindings keep inheriting the description; NULL has always meant inherit.
        for binding_id in (seed.code_copy, seed.code_description_copy):
            assert after[binding_id].description is None
        assert after[seed.code_description_copy].output_configs == _CODE_CONFIGS_OVERRIDE
        assert after[seed.code_configs_copy].description == "dataset note"
        for binding_id in (seed.code, seed.code_override, seed.builtin_override):
            assert after[binding_id] == before[binding_id]
        assert _child_row_counts(conn) == (1, 1)
        if _db_backend == "sqlite":
            assert conn.execute(text("PRAGMA foreign_key_check")).all() == []

    await _run_async(_engine, _verify_downgraded)

    def _tag_delete_unpins_the_evaluator(conn: Connection) -> None:
        _enforce_foreign_keys(conn, _db_backend)
        try:
            conn.execute(text("DELETE FROM prompt_version_tags WHERE id = :id"), {"id": seed.tag})
            assert (
                conn.execute(
                    text("SELECT prompt_version_tag_id FROM llm_evaluators WHERE id = :id"),
                    {"id": seed.llm_evaluator},
                ).scalar_one()
                is None
            )
        finally:
            conn.rollback()

    await _run_async(_engine, _tag_delete_unpins_the_evaluator)
