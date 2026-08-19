import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Callable, NamedTuple, Optional, TypeVar

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

T = TypeVar("T")

_DOWN = "4aad9107d196"
_UP = "a7f1c3e9d2b4"
_SQLITE_PROJECT_SESSION_DESC_INDEX_SQL = {
    "ix_project_sessions_project_id_end_time": (
        "CREATE INDEX ix_project_sessions_project_id_end_time "
        "ON project_sessions (project_id, end_time DESC)"
    ),
    "ix_project_sessions_project_id_start_time": (
        "CREATE INDEX ix_project_sessions_project_id_start_time "
        "ON project_sessions (project_id, start_time DESC)"
    ),
}
_PG_PROJECT_SESSION_DESC_INDEX_COLUMNS = {
    "ix_project_sessions_project_id_end_time": "(project_id, end_time DESC)",
    "ix_project_sessions_project_id_start_time": "(project_id, start_time DESC)",
}


def _get_sqlite_project_session_index_sql(conn: Connection) -> dict[str, str]:
    rows = conn.execute(
        sa.text(
            "SELECT name, sql FROM sqlite_master "
            "WHERE type = 'index' "
            "AND name IN ("
            "'ix_project_sessions_project_id_start_time', "
            "'ix_project_sessions_project_id_end_time'"
            ")"
        )
    ).all()
    return {name: sql for name, sql in rows if sql is not None}


def _get_postgresql_project_session_index_def(conn: Connection, schema: str) -> dict[str, str]:
    rows = conn.execute(
        sa.text(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE schemaname = :schema "
            "AND tablename = 'project_sessions' "
            "AND indexname IN ("
            "'ix_project_sessions_project_id_start_time', "
            "'ix_project_sessions_project_id_end_time'"
            ")"
        ),
        {"schema": schema},
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
            nullable_column_names=frozenset(["input_mapping"]),
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
            "ck_eval_session_work_units_`valid_scheduling_origin`",
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
                    "transcript_covered_through",
                    "status",
                    "scheduling_origin",
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
                    "transcript_covered_through",
                    "claimed_at",
                    "claimed_by",
                    "error",
                    "cooldown_until",
                }
            ),
        )


class TestEvaluatorSignals(_OnlineEvalSchemaTest):
    table_name = "evaluator_signals"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {
            "ix_evaluator_signals_undrained",
            "ix_evaluator_signals_project_id",
            "ix_evaluator_signals_span_rowid",
            "ix_evaluator_signals_trace_rowid",
            "ix_evaluator_signals_project_session_rowid",
        }
        constraint_names = {
            "pk_evaluator_signals",
            "uq_evaluator_signals_kind_dedup_key",
            "fk_evaluator_signals_project_id_projects",
            "fk_evaluator_signals_span_rowid_spans",
            "fk_evaluator_signals_trace_rowid_traces",
            _constraint_name(
                "fk_evaluator_signals_project_session_rowid_project_sessions",
                db_backend,
            ),
            "ck_evaluator_signals_`valid_signal_kind`",
            "ck_evaluator_signals_`valid_evaluation_target`",
            "ck_evaluator_signals_`valid_target_key`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_evaluator_signals",
                    "uq_evaluator_signals_kind_dedup_key",
                }
            )
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_evaluator_signals_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "kind",
                    "dedup_key",
                    "project_id",
                    "evaluation_target",
                    "span_rowid",
                    "trace_rowid",
                    "project_session_rowid",
                    "payload",
                    "acknowledged_at",
                    "created_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            # Every target key is nullable; the exactly-one CHECK is what requires the
            # one that matches evaluation_target.
            nullable_column_names=frozenset(
                {
                    "span_rowid",
                    "trace_rowid",
                    "project_session_rowid",
                    "acknowledged_at",
                }
            ),
        )


class TestProjectEvaluatorTriggers(_OnlineEvalSchemaTest):
    table_name = "project_evaluator_triggers"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {"ix_project_evaluator_triggers_project_evaluator_id"}
        constraint_names = {
            "pk_project_evaluator_triggers",
            "uq_project_evaluator_triggers_id_signal_kind",
            _constraint_name(
                "fk_project_evaluator_triggers_project_evaluator_id_project_evaluators",
                db_backend,
            ),
            "ck_project_evaluator_triggers_`valid_signal_kind`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_project_evaluator_triggers",
                    "uq_project_evaluator_triggers_id_signal_kind",
                }
            )
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_project_evaluator_triggers_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "project_evaluator_id",
                    "signal_kind",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(),
        )


class TestProjectEvaluatorTriggerAnnotationPredicates(_OnlineEvalSchemaTest):
    table_name = "project_evaluator_trigger_annotation_predicates"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names: set[str] = set()
        constraint_names = {
            "pk_project_evaluator_trigger_annotation_predicates",
            "uq_project_evaluator_trigger_annotation_predicates_trigger_id",
            _constraint_name(
                "fk_project_evaluator_trigger_annotation_predicates"
                "_trigger_id_project_evaluator_triggers",
                db_backend,
            ),
            _constraint_name(
                "ck_project_evaluator_trigger_annotation_predicates_`valid_signal_kind`",
                db_backend,
            ),
            _constraint_name(
                "ck_project_evaluator_trigger_annotation_predicates_`valid_annotator_kind`",
                db_backend,
            ),
            _constraint_name(
                "ck_project_evaluator_trigger_annotation_predicates_`valid_annotation_change`",
                db_backend,
            ),
            _constraint_name(
                "ck_project_evaluator_trigger_annotation_predicates_`valid_annotation_target`",
                db_backend,
            ),
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_project_evaluator_trigger_annotation_predicates",
                    "uq_project_evaluator_trigger_annotation_predicates_trigger_id",
                }
            )
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_project_evaluator_trigger_annotation_predicates_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "trigger_id",
                    "signal_kind",
                    "name",
                    "label",
                    "score_below",
                    "score_above",
                    "annotator_kind",
                    "annotation_change",
                    "annotation_target",
                    "matches_evaluator_annotations",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            # Every predicate column is nullable: NULL means unconstrained, so a trigger
            # whose predicate row is all NULL fires on every signal of its kind.
            nullable_column_names=frozenset(
                {
                    "name",
                    "label",
                    "score_below",
                    "score_above",
                    "annotator_kind",
                    "annotation_change",
                    "annotation_target",
                }
            ),
        )


class TestProjectEvaluatorTriggerEvaluationPredicates(_OnlineEvalSchemaTest):
    table_name = "project_evaluator_trigger_evaluation_predicates"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {"ix_trigger_evaluation_predicates_source_project_evaluator_id"}
        constraint_names = {
            "pk_project_evaluator_trigger_evaluation_predicates",
            "uq_project_evaluator_trigger_evaluation_predicates_trigger_id",
            _constraint_name(
                "fk_project_evaluator_trigger_evaluation_predicates"
                "_trigger_id_project_evaluator_triggers",
                db_backend,
            ),
            _constraint_name(
                "fk_project_evaluator_trigger_evaluation_predicates"
                "_source_project_evaluator_id_project_evaluators",
                db_backend,
            ),
            _constraint_name(
                "ck_project_evaluator_trigger_evaluation_predicates_`valid_signal_kind`",
                db_backend,
            ),
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_project_evaluator_trigger_evaluation_predicates",
                    "uq_project_evaluator_trigger_evaluation_predicates_trigger_id",
                }
            )
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_project_evaluator_trigger_evaluation_predicates_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "trigger_id",
                    "signal_kind",
                    "name",
                    "label",
                    "score_below",
                    "score_above",
                    "source_project_evaluator_id",
                    "result_changed_only",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                {
                    "name",
                    "label",
                    "score_below",
                    "score_above",
                    "source_project_evaluator_id",
                }
            ),
        )


class TestEvaluationRequests(_OnlineEvalSchemaTest):
    table_name = "evaluation_requests"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {"ix_evaluation_requests_project_evaluator_id_project_session_rowid"}
        constraint_names = {
            "pk_evaluation_requests",
            "uq_evaluation_requests_project_session_rowid_project_evaluator_id",
            _constraint_name(
                "fk_evaluation_requests_project_session_rowid_project_sessions",
                db_backend,
            ),
            _constraint_name(
                "fk_evaluation_requests_project_evaluator_id_project_evaluators",
                db_backend,
            ),
            _constraint_name(
                "fk_evaluation_requests_materialized_by_session_work_unit_id"
                "_eval_session_work_units",
                db_backend,
            ),
            "ck_evaluation_requests_`valid_requested_generation`",
            "ck_evaluation_requests_`valid_materialized_generation`",
            "ck_evaluation_requests_`valid_force_requested_generation`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_evaluation_requests",
                    "uq_evaluation_requests_project_session_rowid_project_evaluator_id",
                }
            )
        elif db_backend == "sqlite":
            index_names.add("sqlite_autoindex_evaluation_requests_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    "project_session_rowid",
                    "project_evaluator_id",
                    "requested_generation",
                    "materialized_generation",
                    "force_requested_generation",
                    "materialized_by_session_work_unit_id",
                    "requested_at",
                    "requested_by",
                    "created_at",
                    "updated_at",
                }
            ),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(
                {"materialized_by_session_work_unit_id", "requested_by"}
            ),
        )


async def test_project_session_liveness_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _DOWN, _schema)
    end_time = datetime(2026, 1, 2, tzinfo=timezone.utc)

    def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
        return _get_table_schema_info(conn, "project_sessions", _db_backend, _schema)

    async def _assert_desc_indexes() -> None:
        """Assert both project_sessions indexes are descending, at DDL level, on either dialect."""
        if _db_backend == "sqlite":
            assert (
                await _run_async(_engine, _get_sqlite_project_session_index_sql)
                == _SQLITE_PROJECT_SESSION_DESC_INDEX_SQL
            )
        elif _db_backend == "postgresql":
            index_defs = await _run_async(
                _engine,
                lambda conn: _get_postgresql_project_session_index_def(conn, _schema),
            )
            assert index_defs.keys() == _PG_PROJECT_SESSION_DESC_INDEX_COLUMNS.keys()
            for index_name, columns in _PG_PROJECT_SESSION_DESC_INDEX_COLUMNS.items():
                assert index_defs[index_name].endswith(columns)
        else:
            assert_never(_db_backend)

    def _seed(conn: Connection) -> None:
        metadata = sa.MetaData()
        schema = _schema or None
        projects = sa.Table("projects", metadata, autoload_with=conn, schema=schema)
        project_sessions = sa.Table("project_sessions", metadata, autoload_with=conn, schema=schema)
        inserted_primary_key = conn.execute(
            projects.insert().values(name="liveness-backfill")
        ).inserted_primary_key
        assert inserted_primary_key is not None
        project_id = inserted_primary_key[0]
        conn.execute(
            project_sessions.insert().values(
                session_id="liveness-backfill",
                project_id=project_id,
                start_time=end_time,
                end_time=end_time,
            )
        )
        conn.commit()

    def _get_liveness_and_index(conn: Connection) -> tuple[Optional[datetime], list[str], str]:
        metadata = sa.MetaData()
        schema = _schema or None
        project_sessions = sa.Table("project_sessions", metadata, autoload_with=conn, schema=schema)
        last_span_ingested_at = conn.scalar(
            sa.select(project_sessions.c.last_span_ingested_at).where(
                project_sessions.c.session_id == "liveness-backfill"
            )
        )
        indexes = sa.inspect(conn).get_indexes("project_sessions", schema=schema)
        index = next(
            index
            for index in indexes
            if index["name"] == "ix_project_sessions_project_id_last_span_ingested_at"
        )
        index_columns = index["column_names"]
        assert all(column is not None for column in index_columns)
        where = index["dialect_options"][f"{_db_backend}_where"]
        return (
            last_span_ingested_at,
            [column for column in index_columns if column is not None],
            str(where),
        )

    before = await _run_async(_engine, _get)
    assert before is not None
    assert "last_span_ingested_at" not in before["column_names"]
    assert "content_complete" not in before["column_names"]
    await _run_async(_engine, _seed)

    await _up(_engine, _alembic_config, _UP, _schema)
    after = await _run_async(_engine, _get)
    assert after is not None
    assert after["column_names"] == before["column_names"] | {
        "last_span_ingested_at",
        "content_complete",
    }
    assert after["index_names"] == before["index_names"] | {
        "ix_project_sessions_project_id_last_span_ingested_at"
    }
    assert after["constraint_names"] == before["constraint_names"]
    assert after["nullable_column_names"] == before["nullable_column_names"] | {
        "last_span_ingested_at"
    }
    last_span_ingested_at, index_columns, index_where = await _run_async(
        _engine, _get_liveness_and_index
    )
    assert last_span_ingested_at is None
    assert index_columns == ["project_id", "last_span_ingested_at"]
    assert "last_span_ingested_at IS NOT NULL" in index_where
    await _assert_desc_indexes()

    await _down(_engine, _alembic_config, _DOWN, _schema)
    assert await _run_async(_engine, _get) == before
    # Reflection-driven index drift is symmetric: index names and column lists survive a
    # DESC -> ASC rebuild, so the schema comparison above cannot catch one on the way down.
    await _assert_desc_indexes()


class _Seed(NamedTuple):
    """Rows the constraint tests below route signals to and hang triggers off."""

    project_id: int
    project_session_rowid: int
    trace_rowid: int
    span_rowid: int
    project_evaluator_id: int
    watched_project_evaluator_id: int


async def _run_with_foreign_keys(
    engine: AsyncEngine,
    db_backend: _DBBackend,
    fn: Callable[[Connection], T],
) -> T:
    """Run `fn` against a committing connection that enforces foreign keys.

    The migration engine deliberately leaves SQLite's foreign_keys pragma off, because
    batch_alter_table's table rebuild would cascade child rows away. Constraint tests
    need it on, and it is per-connection.
    """
    async with engine.connect() as connection:
        if db_backend == "sqlite":
            await connection.exec_driver_sql("PRAGMA foreign_keys = ON")
        try:
            result = await connection.run_sync(fn)
        except BaseException:
            await connection.rollback()
            raise
        await connection.commit()
        return result


def _scalar_id(conn: Connection, statement: sa.TextClause, parameters: dict[str, Any]) -> int:
    row_id = conn.execute(statement, parameters).scalar_one()
    assert isinstance(row_id, int)
    return row_id


def _seed_rows(conn: Connection) -> _Seed:
    now = datetime.now(timezone.utc)
    project_id = _scalar_id(
        conn,
        sa.text("INSERT INTO projects (name) VALUES (:name) RETURNING id"),
        {"name": f"project-{token_hex(8)}"},
    )
    project_session_rowid = _scalar_id(
        conn,
        sa.text(
            "INSERT INTO project_sessions (session_id, project_id, start_time, end_time)"
            " VALUES (:session_id, :project_id, :start_time, :end_time) RETURNING id"
        ),
        {
            "session_id": token_hex(8),
            "project_id": project_id,
            "start_time": now,
            "end_time": now,
        },
    )
    trace_rowid = _scalar_id(
        conn,
        sa.text(
            "INSERT INTO traces"
            " (project_rowid, trace_id, start_time, end_time, project_session_rowid)"
            " VALUES (:project_rowid, :trace_id, :start_time, :end_time, :project_session_rowid)"
            " RETURNING id"
        ),
        {
            "project_rowid": project_id,
            "trace_id": token_hex(16),
            "start_time": now,
            "end_time": now,
            "project_session_rowid": project_session_rowid,
        },
    )
    span_rowid = _scalar_id(
        conn,
        sa.text(
            "INSERT INTO spans"
            " (trace_rowid, span_id, name, span_kind, start_time, end_time, attributes, events,"
            " status_message, cumulative_error_count, cumulative_llm_token_count_prompt,"
            " cumulative_llm_token_count_completion)"
            " VALUES (:trace_rowid, :span_id, 'span', 'LLM', :start_time, :end_time,"
            " '{}', '[]', '', 0, 0, 0)"
            " RETURNING id"
        ),
        {
            "trace_rowid": trace_rowid,
            "span_id": token_hex(8),
            "start_time": now,
            "end_time": now,
        },
    )
    evaluator_id = _scalar_id(
        conn,
        sa.text(
            "INSERT INTO evaluators (name, metadata, kind) VALUES (:name, '{}', 'LLM') RETURNING id"
        ),
        {"name": f"evaluator-{token_hex(8)}"},
    )
    criteria_statement = sa.text(
        "INSERT INTO project_evaluators"
        " (project_id, evaluator_id, name, evaluation_target, sampling_rate)"
        " VALUES (:project_id, :evaluator_id, :name, 'SESSION', 1.0) RETURNING id"
    )
    project_evaluator_id, watched_project_evaluator_id = (
        _scalar_id(
            conn,
            criteria_statement,
            {"project_id": project_id, "evaluator_id": evaluator_id, "name": name},
        )
        for name in ("downstream", "watched")
    )
    return _Seed(
        project_id=project_id,
        project_session_rowid=project_session_rowid,
        trace_rowid=trace_rowid,
        span_rowid=span_rowid,
        project_evaluator_id=project_evaluator_id,
        watched_project_evaluator_id=watched_project_evaluator_id,
    )


_INSERT_SIGNAL = sa.text(
    "INSERT INTO evaluator_signals"
    " (kind, dedup_key, project_id, evaluation_target,"
    " span_rowid, trace_rowid, project_session_rowid, payload)"
    " VALUES ('annotation_upserted', :dedup_key, :project_id, :evaluation_target,"
    " :span_rowid, :trace_rowid, :project_session_rowid, '{}')"
    " RETURNING id"
)


def _signal_insert(
    project_id: int,
    evaluation_target: str,
    *,
    span_rowid: Optional[int] = None,
    trace_rowid: Optional[int] = None,
    project_session_rowid: Optional[int] = None,
) -> Callable[[Connection], int]:
    def _insert(conn: Connection) -> int:
        return _scalar_id(
            conn,
            _INSERT_SIGNAL,
            {
                "dedup_key": token_hex(8),
                "project_id": project_id,
                "evaluation_target": evaluation_target,
                "span_rowid": span_rowid,
                "trace_rowid": trace_rowid,
                "project_session_rowid": project_session_rowid,
            },
        )

    return _insert


def _predicates_insert(
    table: str, trigger_id: int, signal_kind: str
) -> Callable[[Connection], int]:
    statement = sa.text(
        f"INSERT INTO {table} (trigger_id, signal_kind)"  # noqa: S608
        " VALUES (:trigger_id, :signal_kind) RETURNING id"
    )

    def _insert(conn: Connection) -> int:
        return _scalar_id(conn, statement, {"trigger_id": trigger_id, "signal_kind": signal_kind})

    return _insert


def _insert_trigger(conn: Connection, project_evaluator_id: int, signal_kind: str) -> int:
    return _scalar_id(
        conn,
        sa.text(
            "INSERT INTO project_evaluator_triggers (project_evaluator_id, signal_kind)"
            " VALUES (:project_evaluator_id, :signal_kind) RETURNING id"
        ),
        {"project_evaluator_id": project_evaluator_id, "signal_kind": signal_kind},
    )


def _delete(conn: Connection, table: str, row_id: int) -> None:
    conn.execute(
        sa.text(f"DELETE FROM {table} WHERE id = :row_id"),  # noqa: S608
        {"row_id": row_id},
    )


def _count(conn: Connection, table: str, row_id: int) -> int:
    count = conn.execute(
        sa.text(f"SELECT count(*) FROM {table} WHERE id = :row_id"),  # noqa: S608
        {"row_id": row_id},
    ).scalar_one()
    assert isinstance(count, int)
    return count


async def test_evaluator_signal_routes_to_exactly_one_target(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _UP, _schema)
    seed = await _run_with_foreign_keys(_engine, _db_backend, _seed_rows)

    accepted = {
        target: await _run_with_foreign_keys(_engine, _db_backend, insert)
        for target, insert in (
            ("SPAN", _signal_insert(seed.project_id, "SPAN", span_rowid=seed.span_rowid)),
            ("TRACE", _signal_insert(seed.project_id, "TRACE", trace_rowid=seed.trace_rowid)),
            (
                "SESSION",
                _signal_insert(
                    seed.project_id,
                    "SESSION",
                    project_session_rowid=seed.project_session_rowid,
                ),
            ),
        )
    }

    refused = (
        # A target key without its declared target.
        _signal_insert(seed.project_id, "SESSION", span_rowid=seed.span_rowid),
        _signal_insert(seed.project_id, "SPAN", project_session_rowid=seed.project_session_rowid),
        # A declared target without its key.
        _signal_insert(seed.project_id, "SPAN"),
        _signal_insert(seed.project_id, "SESSION"),
        # Two keys at once.
        _signal_insert(
            seed.project_id, "SPAN", span_rowid=seed.span_rowid, trace_rowid=seed.trace_rowid
        ),
    )
    for insert in refused:
        # SQLite reports a CHECK violation as a raw driver exception, so the assertion
        # matches the message rather than a SQLAlchemy exception class.
        with pytest.raises(BaseException, match="valid_target_key"):
            await _run_with_foreign_keys(_engine, _db_backend, insert)

    def _surviving_signals(conn: Connection) -> set[str]:
        return {
            target
            for target, signal_id in accepted.items()
            if _count(conn, "evaluator_signals", signal_id)
        }

    def _delete_target(table: str, row_id: int) -> Callable[[Connection], set[str]]:
        def _delete_and_count(conn: Connection) -> set[str]:
            _delete(conn, table, row_id)
            return _surviving_signals(conn)

        return _delete_and_count

    # Each target key cascades on its own, in an order that leaves the other two intact.
    cascades: tuple[tuple[Callable[[Connection], set[str]], set[str]], ...] = (
        (_delete_target("spans", seed.span_rowid), {"TRACE", "SESSION"}),
        (_delete_target("traces", seed.trace_rowid), {"SESSION"}),
        (_delete_target("project_sessions", seed.project_session_rowid), set()),
    )
    for delete_target, surviving in cascades:
        assert await _run_with_foreign_keys(_engine, _db_backend, delete_target) == surviving


async def test_trigger_predicates_attach_only_to_their_own_signal_kind(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _UP, _schema)
    seed = await _run_with_foreign_keys(_engine, _db_backend, _seed_rows)

    def _triggers(conn: Connection) -> dict[str, int]:
        return {
            signal_kind: _insert_trigger(conn, seed.project_evaluator_id, signal_kind)
            for signal_kind in ("annotation_upserted", "evaluation_completed")
        }

    triggers = await _run_with_foreign_keys(_engine, _db_backend, _triggers)
    families = (
        ("project_evaluator_trigger_annotation_predicates", "annotation_upserted"),
        ("project_evaluator_trigger_evaluation_predicates", "evaluation_completed"),
    )
    for table, signal_kind in families:
        own_trigger = triggers[signal_kind]
        other_kind = next(kind for _, kind in families if kind != signal_kind)
        other_trigger = triggers[other_kind]

        predicates_id = await _run_with_foreign_keys(
            _engine, _db_backend, _predicates_insert(table, own_trigger, signal_kind)
        )

        # Its own kind against the other family's trigger: the composite foreign key has
        # no parent row to reference.
        with pytest.raises(BaseException, match="(?i)foreign key constraint"):
            await _run_with_foreign_keys(
                _engine, _db_backend, _predicates_insert(table, other_trigger, signal_kind)
            )

        # The other family's kind, which would have matched that parent: the CHECK pins
        # the child to its own kind.
        check_name = _constraint_name(f"ck_{table}_`valid_signal_kind`", _db_backend)
        with pytest.raises(BaseException, match=re.escape(check_name)):
            await _run_with_foreign_keys(
                _engine, _db_backend, _predicates_insert(table, other_trigger, other_kind)
            )

        def _delete_trigger(conn: Connection) -> int:
            _delete(conn, "project_evaluator_triggers", own_trigger)
            return _count(conn, table, predicates_id)

        assert await _run_with_foreign_keys(_engine, _db_backend, _delete_trigger) == 0


async def test_deleting_a_watched_criterion_never_orphans_its_trigger(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _UP, _schema)
    seed = await _run_with_foreign_keys(_engine, _db_backend, _seed_rows)

    def _watching_trigger(conn: Connection) -> tuple[int, int]:
        trigger_id = _insert_trigger(conn, seed.project_evaluator_id, "evaluation_completed")
        predicates_id = _scalar_id(
            conn,
            sa.text(
                "INSERT INTO project_evaluator_trigger_evaluation_predicates"
                " (trigger_id, signal_kind, source_project_evaluator_id)"
                " VALUES (:trigger_id, 'evaluation_completed', :source_project_evaluator_id)"
                " RETURNING id"
            ),
            {"trigger_id": trigger_id, "source_project_evaluator_id": seed.watched_project_evaluator_id},
        )
        return trigger_id, predicates_id

    trigger_id, predicates_id = await _run_with_foreign_keys(
        _engine, _db_backend, _watching_trigger
    )

    def _delete_watched(conn: Connection) -> None:
        _delete(conn, "project_evaluators", seed.watched_project_evaluator_id)

    with pytest.raises(BaseException, match="(?i)foreign key constraint"):
        await _run_with_foreign_keys(_engine, _db_backend, _delete_watched)

    def _delete_owning(conn: Connection) -> tuple[int, int]:
        _delete(conn, "project_evaluators", seed.project_evaluator_id)
        return (
            _count(conn, "project_evaluator_triggers", trigger_id),
            _count(conn, "project_evaluator_trigger_evaluation_predicates", predicates_id),
        )

    assert await _run_with_foreign_keys(_engine, _db_backend, _delete_owning) == (0, 0)
    await _run_with_foreign_keys(_engine, _db_backend, _delete_watched)

