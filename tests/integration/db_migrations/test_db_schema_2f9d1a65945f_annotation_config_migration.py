from abc import ABC, abstractmethod

from alembic.config import Config
from sqlalchemy import Engine
from typing_extensions import assert_never

from . import _DBBackend, _down, _get_table_schema_info, _TableSchemaInfo, _up, _verify_clean_state

_DOWN = "bc8fea3c2bc8"
_UP = "2f9d1a65945f"


class DBSchemaComparisonTest(ABC):
    table_name: str

    @classmethod
    @abstractmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo: ...

    @classmethod
    @abstractmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo: ...

    def _test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        _verify_clean_state(_engine)

        _up(_engine, _alembic_config, _DOWN)

        current_info = self._get_current_schema_info(_db_backend)
        upgraded_info = self._get_upgraded_schema_info(_db_backend)

        with _engine.connect() as conn:
            initial_info = _get_table_schema_info(conn, self.table_name, _db_backend)
        assert (
            initial_info == current_info
        ), "Initial schema info does not match expected current schema info"  # noqa: E501

        _up(_engine, _alembic_config, _UP)

        with _engine.connect() as conn:
            final_info = _get_table_schema_info(conn, self.table_name, _db_backend)
        assert (
            final_info == upgraded_info
        ), "Final schema info does not match expected upgraded schema info"  # noqa: E501

        _down(_engine, _alembic_config, _DOWN)

        with _engine.connect() as conn:
            downgraded_info = _get_table_schema_info(conn, self.table_name, _db_backend)
        assert (
            downgraded_info == current_info
        ), "Downgraded schema info does not match expected current schema info"  # noqa: E501


class TestSpanAnnotations(DBSchemaComparisonTest):
    table_name = "span_annotations"

    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "span_rowid",
        }
        index_names = {
            "ix_span_annotations_score",
            "ix_span_annotations_label",
            "ix_span_annotations_span_rowid",
        }
        constraint_names = {
            "fk_span_annotations_span_rowid_spans",
            "ck_span_annotations_`valid_annotator_kind`",
            "pk_span_annotations",
            "uq_span_annotations_name_span_rowid",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_span_annotations",
                    "uq_span_annotations_name_span_rowid",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_span_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="span_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "span_rowid",
            "user_id",
            "identifier",
            "source",
        }
        index_names = {
            "ix_span_annotations_span_rowid",
        }
        constraint_names = {
            "fk_span_annotations_span_rowid_spans",
            "ck_span_annotations_`valid_annotator_kind`",
            "pk_span_annotations",
            "ck_span_annotations_`valid_source`",
            "fk_span_annotations_user_id_users",
            "uq_span_annotations_name_span_rowid_identifier",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_span_annotations",
                    "uq_span_annotations_name_span_rowid_identifier",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_span_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="span_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend)


class TestTraceAnnotations(DBSchemaComparisonTest):
    table_name = "trace_annotations"

    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "trace_rowid",
        }
        index_names = {
            "ix_trace_annotations_score",
            "ix_trace_annotations_label",
            "ix_trace_annotations_trace_rowid",
        }
        constraint_names = {
            "fk_trace_annotations_trace_rowid_traces",
            "ck_trace_annotations_`valid_annotator_kind`",
            "pk_trace_annotations",
            "uq_trace_annotations_name_trace_rowid",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_trace_annotations",
                    "uq_trace_annotations_name_trace_rowid",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_trace_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="trace_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "trace_rowid",
            "user_id",
            "identifier",
            "source",
        }
        index_names = {
            "ix_trace_annotations_trace_rowid",
        }
        constraint_names = {
            "fk_trace_annotations_trace_rowid_traces",
            "ck_trace_annotations_`valid_annotator_kind`",
            "pk_trace_annotations",
            "ck_trace_annotations_`valid_source`",
            "fk_trace_annotations_user_id_users",
            "uq_trace_annotations_name_trace_rowid_identifier",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_trace_annotations",
                    "uq_trace_annotations_name_trace_rowid_identifier",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_trace_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="trace_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend)


class TestDocumentAnnotations(DBSchemaComparisonTest):
    table_name = "document_annotations"

    @classmethod
    def _get_current_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "document_position",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "span_rowid",
        }
        index_names = {
            "ix_document_annotations_score",
            "ix_document_annotations_label",
            "ix_document_annotations_span_rowid",
        }
        constraint_names = {
            "fk_document_annotations_span_rowid_spans",
            "ck_document_annotations_`valid_annotator_kind`",
            "pk_document_annotations",
            "uq_document_annotations_name_span_rowid_document_position",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_document_annotations",
                    "uq_document_annotations_name_span_rowid_document_position",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_document_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="document_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        column_names = {
            "annotator_kind",
            "created_at",
            "document_position",
            "explanation",
            "id",
            "label",
            "metadata",
            "name",
            "score",
            "updated_at",
            "span_rowid",
            "user_id",
            "identifier",
            "source",
        }
        index_names = {
            "ix_document_annotations_span_rowid",
        }
        constraint_names = {
            "fk_document_annotations_span_rowid_spans",
            "ck_document_annotations_`valid_annotator_kind`",
            "pk_document_annotations",
            "ck_document_annotations_`valid_source`",
            "fk_document_annotations_user_id_users",
            "uq_document_annotations_name_span_rowid_document_pos_identifier",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    "pk_document_annotations",
                    "uq_document_annotations_name_span_rowid_document_pos_identifier",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    "sqlite_autoindex_document_annotations_1",
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name="document_annotations",
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        self._test_db_schema(_engine, _alembic_config, _db_backend)
