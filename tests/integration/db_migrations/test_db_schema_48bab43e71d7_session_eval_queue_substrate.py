from abc import ABC, abstractmethod
from typing import Optional

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

_DOWN = "a7f1c3e9d2b4"
_UP = "48bab43e71d7"


def _constraint_name(name: str, db_backend: _DBBackend) -> str:
    return truncate_name(name) if db_backend == "postgresql" else name


class _NewTableSchemaTest(ABC):
    table_name: str

    @classmethod
    @abstractmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo: ...

    async def test_db_schema(
        self,
        _engine: AsyncEngine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        await _verify_clean_state(_engine, _schema)
        await _up(_engine, _alembic_config, _DOWN, _schema)

        def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
            return _get_table_schema_info(conn, self.table_name, _db_backend, _schema)

        assert (await _run_async(_engine, _get)) is None
        await _up(_engine, _alembic_config, _UP, _schema)
        assert await _run_async(_engine, _get) == self._get_upgraded_schema_info(_db_backend)
        await _down(_engine, _alembic_config, _DOWN, _schema)
        assert (await _run_async(_engine, _get)) is None


class _WorkUnitsSchemaTest(_NewTableSchemaTest):
    entity_column: str
    entity_table: str

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        index_names = {
            f"ix_{cls.table_name}_claimable",
            f"ix_{cls.table_name}_evaluator_id",
            f"ix_{cls.table_name}_criteria_id",
            f"ix_{cls.table_name}_error_attempts",
            f"ix_{cls.table_name}_terminal",
        }
        unique_name = _constraint_name(
            f"uq_{cls.table_name}_{cls.entity_column}_evaluator_id_config_fingerprint_generation",
            db_backend,
        )
        constraint_names = {
            f"pk_{cls.table_name}",
            unique_name,
            _constraint_name(
                f"fk_{cls.table_name}_{cls.entity_column}_{cls.entity_table}",
                db_backend,
            ),
            _constraint_name(
                f"fk_{cls.table_name}_evaluator_id_evaluators",
                db_backend,
            ),
            _constraint_name(
                f"fk_{cls.table_name}_criteria_id_project_evaluator_criteria",
                db_backend,
            ),
            f"ck_{cls.table_name}_`valid_eval_work_status`",
        }
        if db_backend == "postgresql":
            index_names.update({f"pk_{cls.table_name}", unique_name})
        elif db_backend == "sqlite":
            index_names.add(f"sqlite_autoindex_{cls.table_name}_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(
                {
                    "id",
                    cls.entity_column,
                    "evaluator_id",
                    "criteria_id",
                    "config_fingerprint",
                    "generation",
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
                {"claimed_at", "claimed_by", "error", "cooldown_until"}
            ),
        )


class TestEvalSessionWorkUnits(_WorkUnitsSchemaTest):
    table_name = "eval_session_work_units"
    entity_column = "project_session_rowid"
    entity_table = "project_sessions"


class TestEvalTraceWorkUnits(_WorkUnitsSchemaTest):
    table_name = "eval_trace_work_units"
    entity_column = "trace_rowid"
    entity_table = "traces"


class _ActivitySchemaTest(_NewTableSchemaTest):
    entity_column: str
    entity_table: str

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> _TableSchemaInfo:
        unique_name = f"uq_{cls.table_name}_{cls.entity_column}"
        index_names = {f"ix_{cls.table_name}_observed_at"}
        constraint_names = {
            f"pk_{cls.table_name}",
            unique_name,
            _constraint_name(
                f"fk_{cls.table_name}_{cls.entity_column}_{cls.entity_table}",
                db_backend,
            ),
            f"fk_{cls.table_name}_last_seen_span_id_spans",
        }
        if db_backend == "postgresql":
            index_names.update({f"pk_{cls.table_name}", unique_name})
        elif db_backend == "sqlite":
            index_names.add(f"sqlite_autoindex_{cls.table_name}_1")
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset({"id", cls.entity_column, "last_seen_span_id", "observed_at"}),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
            nullable_column_names=frozenset(),
        )


class TestEvalSessionActivity(_ActivitySchemaTest):
    table_name = "eval_session_activity"
    entity_column = "project_session_rowid"
    entity_table = "project_sessions"


class TestEvalTraceActivity(_ActivitySchemaTest):
    table_name = "eval_trace_activity"
    entity_column = "trace_rowid"
    entity_table = "traces"


class TestProjectEvaluatorCriteria:
    async def test_evaluation_delay_column_upgrade_and_downgrade(
        self,
        _engine: AsyncEngine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        await _verify_clean_state(_engine, _schema)
        await _up(_engine, _alembic_config, _DOWN, _schema)

        def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
            return _get_table_schema_info(
                conn,
                "project_evaluator_criteria",
                _db_backend,
                _schema,
            )

        before = await _run_async(_engine, _get)
        assert before is not None
        assert "evaluation_delay_seconds" not in before["column_names"]

        await _up(_engine, _alembic_config, _UP, _schema)
        after = await _run_async(_engine, _get)
        assert after is not None
        assert after["column_names"] == before["column_names"] | {"evaluation_delay_seconds"}
        assert after["nullable_column_names"] == before["nullable_column_names"] | {
            "evaluation_delay_seconds"
        }
        assert after["index_names"] == before["index_names"]
        assert after["constraint_names"] == before["constraint_names"]

        await _down(_engine, _alembic_config, _DOWN, _schema)
        assert await _run_async(_engine, _get) == before
