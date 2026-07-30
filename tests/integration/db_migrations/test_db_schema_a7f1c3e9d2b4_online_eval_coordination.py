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

_DOWN = "d4e5f6a7b8c9"
_PREVIOUS = "c9d0e1f2a3b4"
_UP = "a7f1c3e9d2b4"


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


class TestProjectEvaluatorCriteria(_OnlineEvalSchemaTest):
    table_name = "project_evaluator_criteria"

    @override
    @classmethod
    def _get_upgraded_schema_info(cls, db_backend: _DBBackend) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "project_id",
            "evaluator_id",
            "name",
            "filter_condition",
            "sampling_rate",
            "evaluation_target",
            "input_mapping",
            "enabled",
            "created_at",
            "updated_at",
        }
        index_names = {
            "ix_project_evaluator_criteria_project_id",
            "ix_project_evaluator_criteria_evaluator_id",
        }
        constraint_names = {
            "pk_project_evaluator_criteria",
            "uq_project_evaluator_criteria_project_id_name",
            "fk_project_evaluator_criteria_project_id_projects",
            "fk_project_evaluator_criteria_evaluator_id_evaluators",
            "ck_project_evaluator_criteria_`valid_sampling_rate`",
            "ck_project_evaluator_criteria_`valid_evaluation_target`",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_project_evaluator_criteria",
                    "uq_project_evaluator_criteria_project_id_name",
                }
            )
        elif db_backend == "sqlite":
            index_names.update({"sqlite_autoindex_project_evaluator_criteria_1"})
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
            "criteria_id",
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
            "ix_eval_work_units_criteria_id",
            "ix_eval_work_units_error_attempts",
            "ix_eval_work_units_terminal",
        }
        constraint_names = {
            "pk_eval_work_units",
            "uq_eval_work_units_span_rowid_evaluator_id_config_fingerprint",
            "fk_eval_work_units_span_rowid_spans",
            "fk_eval_work_units_evaluator_id_evaluators",
            "fk_eval_work_units_criteria_id_project_evaluator_criteria",
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
        unique_name = _constraint_name(
            "uq_eval_session_work_units_project_session_rowid_evaluator_id_config_fingerprint",
            db_backend,
        )
        index_names = {
            "ix_eval_session_work_units_claimable",
            "ix_eval_session_work_units_evaluator_id",
            "ix_eval_session_work_units_criteria_id",
            "ix_eval_session_work_units_error_attempts",
            "ix_eval_session_work_units_terminal",
        }
        constraint_names = {
            "pk_eval_session_work_units",
            unique_name,
            _constraint_name(
                "fk_eval_session_work_units_project_session_rowid_project_sessions",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_session_work_units_evaluator_id_evaluators",
                db_backend,
            ),
            _constraint_name(
                "fk_eval_session_work_units_criteria_id_project_evaluator_criteria",
                db_backend,
            ),
            "ck_eval_session_work_units_`valid_eval_work_status`",
        }
        if db_backend == "postgresql":
            index_names.update({"pk_eval_session_work_units", unique_name})
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
                    "criteria_id",
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
                {"claimed_at", "claimed_by", "error", "cooldown_until"}
            ),
        )


async def test_project_session_liveness_schema(
    _engine: AsyncEngine,
    _alembic_config: Config,
    _db_backend: _DBBackend,
    _schema: str,
) -> None:
    await _verify_clean_state(_engine, _schema)
    await _up(_engine, _alembic_config, _PREVIOUS, _schema)

    def _get(conn: Connection) -> Optional[_TableSchemaInfo]:
        return _get_table_schema_info(conn, "project_sessions", _db_backend, _schema)

    before = await _run_async(_engine, _get)
    assert before is not None
    assert "last_activity_at" not in before["column_names"]
    assert "content_complete" not in before["column_names"]

    await _up(_engine, _alembic_config, _UP, _schema)
    after = await _run_async(_engine, _get)
    assert after is not None
    assert after["column_names"] == before["column_names"] | {
        "last_activity_at",
        "content_complete",
    }
    assert after["index_names"] == before["index_names"] | {"ix_project_sessions_last_activity_at"}
    assert after["constraint_names"] == before["constraint_names"]
    assert after["nullable_column_names"] == before["nullable_column_names"]

    await _down(_engine, _alembic_config, _PREVIOUS, _schema)
    assert await _run_async(_engine, _get) == before
