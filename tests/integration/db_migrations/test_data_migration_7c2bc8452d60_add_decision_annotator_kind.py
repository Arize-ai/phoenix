from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Callable, Literal, NamedTuple

import pytest
from alembic.config import Config
from sqlalchemy import Connection, inspect, text
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from . import _down, _get_table_schema_info, _run_async, _TableSchemaInfo, _up

_DOWN = "f3b8c2d14e70"
_UP = "7c2bc8452d60"

_TABLES = (
    "span_annotations",
    "trace_annotations",
    "document_annotations",
    "project_session_annotations",
    "experiment_run_annotations",
)
_INTEGRITY_ERRORS = (SQLAlchemyIntegrityError, SQLiteIntegrityError)

_Columns = dict[str, dict[str, Any]]


class _Table(NamedTuple):
    schema_info: _TableSchemaInfo
    indexes: dict[str, tuple[tuple[str, ...], bool]]


def _insert(conn: Connection, table: str, values: dict[str, Any]) -> int:
    columns = ", ".join(values)
    params = ", ".join(f":{name}" for name in values)
    stmt = text(f"INSERT INTO {table} ({columns}) VALUES ({params}) RETURNING id")
    rowid = conn.execute(stmt, values).scalar()
    assert isinstance(rowid, int)
    return rowid


def _seed(conn: Connection) -> _Columns:
    now = datetime.now(timezone.utc)
    project = _insert(conn, "projects", {"name": token_hex(4)})
    trace = _insert(
        conn,
        "traces",
        {"project_rowid": project, "trace_id": token_hex(16), "start_time": now, "end_time": now},
    )
    span = _insert(
        conn,
        "spans",
        {
            "trace_rowid": trace,
            "span_id": token_hex(8),
            "name": "span",
            "span_kind": "LLM",
            "start_time": now,
            "end_time": now,
            "attributes": "{}",
            "events": "[]",
            "status_code": "OK",
            "status_message": "",
            "cumulative_error_count": 0,
            "cumulative_llm_token_count_prompt": 0,
            "cumulative_llm_token_count_completion": 0,
        },
    )
    session = _insert(
        conn,
        "project_sessions",
        {"session_id": token_hex(8), "project_id": project, "start_time": now, "end_time": now},
    )
    dataset = _insert(conn, "datasets", {"name": token_hex(4), "metadata": "{}"})
    version = _insert(conn, "dataset_versions", {"dataset_id": dataset, "metadata": "{}"})
    example = _insert(conn, "dataset_examples", {"dataset_id": dataset})
    experiment = _insert(
        conn,
        "experiments",
        {
            "dataset_id": dataset,
            "dataset_version_id": version,
            "name": "experiment",
            "repetitions": 1,
            "metadata": "{}",
        },
    )
    experiment_run = _insert(
        conn,
        "experiment_runs",
        {
            "experiment_id": experiment,
            "dataset_example_id": example,
            "repetition_number": 1,
            "output": "{}",
            "start_time": now,
            "end_time": now,
        },
    )
    conn.commit()
    return {
        "span_annotations": {"span_rowid": span, "source": "API"},
        "trace_annotations": {"trace_rowid": trace, "source": "API"},
        "document_annotations": {"span_rowid": span, "document_position": 0, "source": "API"},
        "project_session_annotations": {"project_session_id": session, "source": "API"},
        "experiment_run_annotations": {
            "experiment_run_id": experiment_run,
            "start_time": now,
            "end_time": now,
        },
    }


def _add_annotation(conn: Connection, table: str, columns: _Columns, annotator_kind: str) -> int:
    values = {
        **columns[table],
        "name": token_hex(4),
        "annotator_kind": annotator_kind,
        "metadata": "{}",
    }
    return _insert(conn, table, values)


def _annotator_kinds(conn: Connection) -> dict[str, dict[int, str]]:
    return {
        table: dict(conn.execute(text(f"SELECT id, annotator_kind FROM {table}")).all())
        for table in _TABLES
    }


def _tables(
    conn: Connection, db_backend: Literal["sqlite", "postgresql"], schema: str
) -> dict[str, _Table]:
    tables = {}
    for name in _TABLES:
        schema_info = _get_table_schema_info(conn, name, db_backend, schema)
        assert schema_info is not None
        indexes = {
            ix["name"]: (tuple(c for c in ix["column_names"] if c), bool(ix["unique"]))
            for ix in inspect(conn).get_indexes(name, schema=schema or None)
            if ix["name"]
        }
        tables[name] = _Table(schema_info=schema_info, indexes=indexes)
    return tables


def _decision_is_refused(table: str, columns: _Columns) -> Callable[[Connection], None]:
    def _check(conn: Connection) -> None:
        # The rollback also undoes the connection's search_path on PostgreSQL, so each check
        # gets a connection of its own.
        try:
            with pytest.raises(_INTEGRITY_ERRORS, match="valid_annotator_kind"):
                _add_annotation(conn, table, columns, "DECISION")
        finally:
            conn.rollback()

    return _check


async def test_add_decision_annotator_kind(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
    _schema: str,
) -> None:
    await _up(_engine, _alembic_config, _DOWN, _schema)
    columns = await _run_async(_engine, _seed)

    def _add_llm_annotations(conn: Connection) -> None:
        for table in _TABLES:
            _add_annotation(conn, table, columns, "LLM")
        conn.commit()

    await _run_async(_engine, _add_llm_annotations)
    before = await _run_async(_engine, lambda conn: _tables(conn, _db_backend, _schema))
    kinds_before = await _run_async(_engine, _annotator_kinds)
    for table in _TABLES:
        await _run_async(_engine, _decision_is_refused(table, columns))

    await _up(_engine, _alembic_config, _UP, _schema)

    def _verify_upgraded(conn: Connection) -> dict[str, int]:
        assert _tables(conn, _db_backend, _schema) == before
        assert _annotator_kinds(conn) == kinds_before
        decision_ids = {
            table: _add_annotation(conn, table, columns, "DECISION") for table in _TABLES
        }
        conn.commit()
        return decision_ids

    decision_ids = await _run_async(_engine, _verify_upgraded)

    await _down(_engine, _alembic_config, _DOWN, _schema)

    def _verify_downgraded(conn: Connection) -> None:
        assert _tables(conn, _db_backend, _schema) == before
        assert _annotator_kinds(conn) == {
            table: {**kinds_before[table], decision_ids[table]: "LLM"} for table in _TABLES
        }

    await _run_async(_engine, _verify_downgraded)
    for table in _TABLES:
        await _run_async(_engine, _decision_is_refused(table, columns))
