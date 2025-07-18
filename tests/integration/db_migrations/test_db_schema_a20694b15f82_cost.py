from abc import ABC, abstractmethod
from typing import Optional

from alembic.config import Config
from sqlalchemy import Engine
from typing_extensions import assert_never, override

from . import _DBBackend, _down, _get_table_schema_info, _TableSchemaInfo, _up, _verify_clean_state

_DOWN = "6a88424799fe"
_UP = "a20694b15f82"


class DBSchemaComparisonTest(ABC):
    table_name: str

    @classmethod
    @abstractmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]: ...

    @classmethod
    @abstractmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]: ...

    def _test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        _verify_clean_state(_engine, _schema)

        _up(_engine, _alembic_config, _DOWN, _schema)

        current_info = self._get_current_schema_info(_db_backend)
        upgraded_info = self._get_upgraded_schema_info(_db_backend)

        with _engine.connect() as conn:
            initial_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            initial_info == current_info
        ), "Initial schema info does not match expected current schema info"  # noqa: E501

        _up(_engine, _alembic_config, _UP, _schema)

        with _engine.connect() as conn:
            final_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            final_info == upgraded_info
        ), "Final schema info does not match expected upgraded schema info"  # noqa: E501

        _down(_engine, _alembic_config, _DOWN, _schema)

        with _engine.connect() as conn:
            downgraded_info = _get_table_schema_info(conn, self.table_name, _db_backend, _schema)
        assert (
            downgraded_info == current_info
        ), "Downgraded schema info does not match expected current schema info"  # noqa: E501


class TestGenerativeModel(DBSchemaComparisonTest):
    table_name = "generative_models"

    @override
    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        return None

    @override
    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "name",
            "name_pattern",
            "provider",
            "is_built_in",
            "start_time",
            "created_at",
            "deleted_at",
            "updated_at",
        }
        index_names = {
            "ix_generative_models_name_is_built_in",
            "ix_generative_models_match_criteria",
        }
        constraint_names = {
            "pk_generative_models",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_generative_models",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_generative_models_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="generative_models",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend, _schema)


class TestTokenPrices(DBSchemaComparisonTest):
    table_name = "token_prices"

    @override
    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        return None

    @override
    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "model_id",
            "token_type",
            "is_prompt",
            "base_rate",
            "customization",
        }
        index_names = {
            "ix_token_prices_model_id",
        }
        constraint_names = {
            "pk_token_prices",
            "fk_token_prices_model_id_generative_models",
            "uq_token_prices_model_id_token_type_is_prompt",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_token_prices",
                    "uq_token_prices_model_id_token_type_is_prompt",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_token_prices_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="token_prices",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend, _schema)


class TestSpanCosts(DBSchemaComparisonTest):
    table_name = "span_costs"

    @override
    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        return None

    @override
    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "span_rowid",
            "trace_rowid",
            "model_id",
            "span_start_time",
            "total_cost",
            "total_tokens",
            "prompt_cost",
            "prompt_tokens",
            "completion_cost",
            "completion_tokens",
        }
        index_names = {
            "ix_span_costs_span_rowid",
            "ix_span_costs_trace_rowid",
            "ix_span_costs_span_start_time",
            "ix_span_costs_model_id_span_start_time",
        }
        constraint_names = {
            "pk_span_costs",
            "fk_span_costs_span_rowid_spans",
            "fk_span_costs_trace_rowid_traces",
            "fk_span_costs_model_id_generative_models",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_span_costs",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_span_costs_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="span_costs",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend, _schema)


class TestSpanCostDetails(DBSchemaComparisonTest):
    table_name = "span_cost_details"

    @override
    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        return None

    @override
    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> Optional[_TableSchemaInfo]:
        column_names = {
            "id",
            "span_cost_id",
            "token_type",
            "is_prompt",
            "cost",
            "tokens",
            "cost_per_token",
        }
        index_names = {
            "ix_span_cost_details_span_cost_id",
            "ix_span_cost_details_token_type",
        }
        constraint_names = {
            "pk_span_cost_details",
            "fk_span_cost_details_span_cost_id_span_costs",
            "uq_span_cost_details_span_cost_id_token_type_is_prompt",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_span_cost_details",
                    "uq_span_cost_details_span_cost_id_token_type_is_prompt",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_span_cost_details_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="span_cost_details",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
        _schema: str,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend, _schema)
