from abc import ABC, abstractmethod
from collections.abc import Collection
from datetime import datetime, timezone
from typing import NamedTuple, Optional

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import AsyncEngine
from typing_extensions import assert_never, override

from phoenix.db.helpers import truncate_name

from . import (
    _DBBackend,
    _down,
    _get_table_schema_info,
    _run_async,
    _TableSchemaInfo,
    _up,
    _verify_clean_state,
)

_DOWN = "4aad9107d196"
_UP = "a7f1c3e9d2b4"


class _LivenessTable(NamedTuple):
    table_name: str
    project_column: str
    key_column: str
    key_value: str
    added_column_names: frozenset[str]
    liveness_index_name: str
    sqlite_desc_index_sql: dict[str, str]
    postgresql_desc_index_columns: dict[str, str]


_LIVENESS_TABLES = {
    "project_sessions": _LivenessTable(
        table_name="project_sessions",
        project_column="project_id",
        key_column="session_id",
        key_value="liveness-backfill",
        added_column_names=frozenset({"last_span_ingested_at", "content_complete"}),
        liveness_index_name="ix_project_sessions_project_id_last_span_ingested_at",
        sqlite_desc_index_sql={
            "ix_project_sessions_project_id_end_time": (
                "CREATE INDEX ix_project_sessions_project_id_end_time "
                "ON project_sessions (project_id, end_time DESC)"
            ),
            "ix_project_sessions_project_id_start_time": (
                "CREATE INDEX ix_project_sessions_project_id_start_time "
                "ON project_sessions (project_id, start_time DESC)"
            ),
        },
        postgresql_desc_index_columns={
            "ix_project_sessions_project_id_end_time": "(project_id, end_time DESC)",
            "ix_project_sessions_project_id_start_time": "(project_id, start_time DESC)",
        },
    ),
    "traces": _LivenessTable(
        table_name="traces",
        project_column="project_rowid",
        key_column="trace_id",
        key_value="trace-liveness-backfill",
        added_column_names=frozenset({"last_span_ingested_at"}),
        liveness_index_name="ix_traces_project_rowid_last_span_ingested_at",
        sqlite_desc_index_sql={
            "ix_traces_project_rowid_start_time": (
                "CREATE INDEX ix_traces_project_rowid_start_time "
                "ON traces (project_rowid, start_time DESC)"
            ),
        },
        postgresql_desc_index_columns={
            "ix_traces_project_rowid_start_time": "(project_rowid, start_time DESC)",
        },
    ),
}


def _get_sqlite_index_sql(conn: Connection, index_names: Collection[str]) -> dict[str, str]:
    rows = conn.execute(
        sa.text(
            "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND name IN :index_names"
        ).bindparams(sa.bindparam("index_names", tuple(index_names), expanding=True))
    ).all()
    return {name: sql for name, sql in rows if sql is not None}


def _get_postgresql_index_def(
    conn: Connection, schema: str, table_name: str, index_names: Collection[str]
) -> dict[str, str]:
    rows = conn.execute(
        sa.text(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE schemaname = :schema "
            "AND tablename = :table_name "
            "AND indexname IN :index_names"
        ).bindparams(sa.bindparam("index_names", tuple(index_names), expanding=True)),
        {"schema": schema, "table_name": table_name},
    ).all()
    return {name: indexdef for name, indexdef in rows}


def _constraint_name(name: str, db_backend: _DBBackend) -> str:
    return truncate_name(name) if db_backend == "postgresql" else name


class _OnlineEvalSchemaTest(ABC):
    table_name: str

    @classmethod
    @abstractmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]: ...

    async def test_db_schema(
        self,
        _engine: AsyncEngine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        await _verify_clean_state(_engine, _schema)

        # The tables do not exist before this migration.
        await _up(_engine, _alembic_config, _DOWN, _schema)

        def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
            return _get_table_schema_info(conn, self.table_name, _db_backend, _schema)

        assert (await _run_async(_engine, _get)) is None

        await _up(_engine, _alembic_config, _UP, _schema)
        final_info = await _run_async(_engine, _get)
        assert final_info == self._get_upgraded_schema_info(_db_backend), (
            "Final schema info does not match expected upgraded schema info"
        )

        await _down(_engine, _alembic_config, _DOWN, _schema)
        assert (await _run_async(_engine, _get)) is None, "Table should not exist after downgrade"


class TestEvalWorkCursors(_OnlineEvalSchemaTest):
    table_name = "eval_work_cursors"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "evaluation_target",
            "consumer_group",
            "produced_through_id",
            "observed_high_water_id",
            "observed_at",
            "claimed_at",
            "claimed_by",
            "created_at",
            "updated_at",
        }
        index_names: set[str] = set()
        constraint_names = {
            "pk_eval_work_cursors",
            "uq_eval_work_cursors_evaluation_target_consumer_group",
            "ck_eval_work_cursors_`valid_evaluation_target`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_eval_work_cursors",
                    "uq_eval_work_cursors_evaluation_target_consumer_group",
                }
            )
        elif db_backend == "sqlite":
            index_names.update({"sqlite_autoindex_eval_work_cursors_1"})
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                ["observed_high_water_id", "observed_at", "claimed_at", "claimed_by"]
            ),
        )


class TestEvalWorkLeases(_OnlineEvalSchemaTest):
    table_name = "eval_work_leases"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "name",
            "holder",
            "heartbeat_at",
            "created_at",
            "updated_at",
        }
        index_names: set[str] = set()
        constraint_names = {
            "pk_eval_work_leases",
            "uq_eval_work_leases_name",
        }
        if db_backend == "postgresql":
            index_names.update({"pk_eval_work_leases", "uq_eval_work_leases_name"})
        elif db_backend == "sqlite":
            index_names.update({"sqlite_autoindex_eval_work_leases_1"})
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(["holder", "heartbeat_at"]),
        )


class TestProjectEvaluators(_OnlineEvalSchemaTest):
    table_name = "project_evaluators"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "project_id",
            "evaluator_id",
            "trace_project_id",
            "name",
            "filter_condition",
            "sampling_rate",
            "evaluation_target",
            "evaluation_delay_seconds",
            "input_mapping",
            "enabled",
            "swept_through_at",
            "created_at",
            "updated_at",
        }
        index_names = {
            "ix_project_evaluators_project_id",
            "ix_project_evaluators_evaluator_id",
            "ix_project_evaluators_trace_project_id",
        }
        constraint_names = {
            "pk_project_evaluators",
            "uq_project_evaluators_project_id_name",
            "fk_project_evaluators_project_id_projects",
            "fk_project_evaluators_evaluator_id_evaluators",
            "fk_project_evaluators_trace_project_id_projects",
            "ck_project_evaluators_`valid_sampling_rate`",
            "ck_project_evaluators_`valid_evaluation_target`",
            "ck_project_evaluators_`valid_evaluation_delay_seconds`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_project_evaluators",
                    "uq_project_evaluators_project_id_name",
                }
            )
        elif db_backend == "sqlite":
            index_names.update({"sqlite_autoindex_project_evaluators_1"})
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(["input_mapping", "swept_through_at"]),
        )


class TestEvalWorkUnits(_OnlineEvalSchemaTest):
    table_name = "eval_work_units"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "span_rowid",
            "evaluator_id",
            "project_evaluator_id",
            "config_fingerprint",
            "status",
            "claimed_at",
            "claimed_by",
            "attempts",
            "error",
            "cooldown_until",
            "created_at",
            "updated_at",
        }
        index_names = {
            "ix_eval_work_units_claimable",
            "ix_eval_work_units_evaluator_id",
            "ix_eval_work_units_project_evaluator_id",
            "ix_eval_work_units_error_attempts",
            "ix_eval_work_units_terminal",
        }
        constraint_names = {
            "pk_eval_work_units",
            "uq_eval_work_units_span_rowid_evaluator_id_config_fingerprint",
            "fk_eval_work_units_span_rowid_spans",
            "fk_eval_work_units_evaluator_id_evaluators",
            "fk_eval_work_units_project_evaluator_id_project_evaluators",
            "ck_eval_work_units_`valid_eval_work_status`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_eval_work_units",
                    "uq_eval_work_units_span_rowid_evaluator_id_config_fingerprint",
                }
            )
        elif db_backend == "sqlite":
            index_names.update({"sqlite_autoindex_eval_work_units_1"})
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                ["claimed_at", "claimed_by", "error", "cooldown_until"]
            ),
        )


class TestEvalSessionWorkUnits(_OnlineEvalSchemaTest):
    table_name = "eval_session_work_units"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {
            "ix_eval_session_work_units_claimable",
            "ix_eval_session_work_units_evaluator_id",
            "ix_eval_session_work_units_project_evaluator_id",
            "ix_eval_session_work_units_error_attempts",
            "ix_eval_session_work_units_terminal",
            "ix_eval_session_work_units_terminal_watermark",
            "uq_eval_session_work_units_live_key",
        }
        constraint_names = {
            "pk_eval_session_work_units",
            _constraint_name(
                "fk_eval_session_work_units_project_session_rowid_project_sessions",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_session_work_units_evaluator_id_evaluators",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_session_work_units_project_evaluator_id_project_evaluators",
                db_backend,
            ),
            "ck_eval_session_work_units_`valid_eval_work_status`",
        }
        if db_backend == "postgresql":
            index_names.add("pk_eval_session_work_units")
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_eval_session_work_units_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "project_session_rowid",
                    "evaluator_id",
                    "project_evaluator_id",
                    "config_fingerprint",
                    "evaluated_through",
                    "status",
                    "claimed_at",
                    "claimed_by",
                    "attempts",
                    "error",
                    "cooldown_until",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                {
                    "claimed_at",
                    "claimed_by",
                    "error",
                    "cooldown_until",
                }
            ),
        )


class TestEvalTraceWorkUnits(_OnlineEvalSchemaTest):
    table_name = "eval_trace_work_units"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {
            "ix_eval_trace_work_units_claimable",
            "ix_eval_trace_work_units_evaluator_id",
            "ix_eval_trace_work_units_project_evaluator_id",
            "ix_eval_trace_work_units_error_attempts",
            "ix_eval_trace_work_units_terminal",
            "ix_eval_trace_work_units_terminal_watermark",
            "uq_eval_trace_work_units_live_key",
        }
        constraint_names = {
            "pk_eval_trace_work_units",
            _constraint_name(
                "fk_eval_trace_work_units_trace_rowid_traces",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_trace_work_units_evaluator_id_evaluators",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_trace_work_units_project_evaluator_id_project_evaluators",
                db_backend,
            ),
            "ck_eval_trace_work_units_`valid_eval_work_status`",
        }
        if db_backend == "postgresql":
            index_names.add("pk_eval_trace_work_units")
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_eval_trace_work_units_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "trace_rowid",
                    "evaluator_id",
                    "project_evaluator_id",
                    "config_fingerprint",
                    "evaluated_through",
                    "status",
                    "claimed_at",
                    "claimed_by",
                    "attempts",
                    "error",
                    "cooldown_until",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                {
                    "claimed_at",
                    "claimed_by",
                    "error",
                    "cooldown_until",
                }
            ),
        )


@pytest.mark.parametrize("spec", _LIVENESS_TABLES.values(), ids=_LIVENESS_TABLES)
async def test_liveness_schema(
    spec: _LivenessTable,
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)
    end_time = datetime(2026, 1, 2, tzinfo=timezone.utc)

    def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
        return _get_table_schema_info(conn, spec.table_name, _db_backend, _schema)

    async def _assert_desc_indexes() -> None:
        if _db_backend == "sqlite":
            index_sql = await _run_async(
                _engine,
                lambda conn: _get_sqlite_index_sql(conn, spec.sqlite_desc_index_sql),
            )
            assert index_sql == spec.sqlite_desc_index_sql
        elif _db_backend == "postgresql":
            index_defs = await _run_async(
                _engine,
                lambda conn: _get_postgresql_index_def(
                    conn, _schema, spec.table_name, spec.postgresql_desc_index_columns
                ),
            )
            assert index_defs.keys() == spec.postgresql_desc_index_columns.keys()
            for index_name, columns in spec.postgresql_desc_index_columns.items():
                assert index_defs[index_name].endswith(columns)
        else:
            assert_never(_db_backend)

    def _seed(conn: Connection) -> None:
        metadata = sa.MetaData()
        schema = _schema or None
        projects = sa.Table("projects", metadata, autoload_with=conn, schema=schema)
        table = sa.Table(spec.table_name, metadata, autoload_with=conn, schema=schema)
        inserted_primary_key = conn.execute(
            projects.insert().values(name=spec.key_value)
        ).inserted_primary_key
        assert inserted_primary_key is not None
        conn.execute(
            table.insert().values(
                {
                    spec.key_column: spec.key_value,
                    spec.project_column: inserted_primary_key[0],
                    "start_time": end_time,
                    "end_time": end_time,
                }
            )
        )
        conn.commit()

    def _get_liveness_and_index(conn: Connection) -> tuple[Optional[datetime], list[str], str]:
        metadata = sa.MetaData()
        schema = _schema or None
        table = sa.Table(spec.table_name, metadata, autoload_with=conn, schema=schema)
        last_span_ingested_at = conn.scalar(
            sa.select(table.c.last_span_ingested_at).where(
                table.c[spec.key_column] == spec.key_value
            )
        )
        indexes = sa.inspect(conn).get_indexes(spec.table_name, schema=schema)
        index = next(index for index in indexes if index["name"] == spec.liveness_index_name)
        index_columns = index["column_names"]
        assert all(column is not None for column in index_columns)
        where = index.get("dialect_options", {})[f"{_db_backend}_where"]
        return (
            last_span_ingested_at,
            [column for column in index_columns if column is not None],
            str(where),
        )

    before = await _run_async(_engine, _get)
    assert before is not None
    assert not before["column_names"] & spec.added_column_names
    await _run_async(_engine, _seed)

    await _up(_engine, _alembic_config, _UP, _schema)
    after = await _run_async(_engine, _get)
    assert after is not None
    assert after["column_names"] == before["column_names"] | spec.added_column_names
    assert after["index_names"] == before["index_names"] | {spec.liveness_index_name}
    assert after["constraint_names"] == before["constraint_names"]
    assert after["nullable_column_names"] == before["nullable_column_names"] | {
        "last_span_ingested_at"
    }
    last_span_ingested_at, index_columns, index_where = await _run_async(
        _engine, _get_liveness_and_index
    )
    assert last_span_ingested_at is None
    assert index_columns == [spec.project_column, "last_span_ingested_at"]
    assert "last_span_ingested_at IS NOT NULL" in index_where
    await _assert_desc_indexes()

    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert await _run_async(_engine, _get) == before
    # Index names and column lists survive a DESC -> ASC rebuild, so the comparison above
    # cannot catch a downgrade that flips them.
    await _assert_desc_indexes()
