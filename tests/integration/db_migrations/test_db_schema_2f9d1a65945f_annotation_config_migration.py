from abc import ABC

from alembic.config import Config
from sqlalchemy import Engine
from typing_extensions import assert_never

from . import _DBBackend, _down, _get_table_schema_info, _TableSchemaInfo, _up, _verify_clean_state

_DOWN = "bc8fea3c2bc8"
_UP = "2f9d1a65945f"


class DBSchemaComparisonTest(ABC):
    table_name: str
    foreign_table_name: str
    foreign_key_name: str

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
            f"{cls.foreign_key_name}",
        }
        index_names = {
            f"ix_{cls.table_name}_score",
            f"ix_{cls.table_name}_label",
            f"ix_{cls.table_name}_{cls.foreign_key_name}",
        }
        constraint_names = {
            f"fk_{cls.table_name}_{cls.foreign_key_name}_{cls.foreign_table_name}",
            f"ck_{cls.table_name}_`valid_annotator_kind`",
            f"pk_{cls.table_name}",
            f"uq_{cls.table_name}_name_{cls.foreign_key_name}",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    f"pk_{cls.table_name}",  # Primary key index
                    f"uq_{cls.table_name}_name_{cls.foreign_key_name}",  # Unique constraint index
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    f"sqlite_autoindex_{cls.table_name}_1",  # Auto-generated primary key index
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        current_info = cls._get_current_schema_info(db_backend)
        column_names = set(current_info["column_names"]).union(
            {
                "user_id",
                "identifier",
                "source",
            }
        )
        index_names = set(current_info["index_names"]) - {
            f"ix_{cls.table_name}_score",
            f"ix_{cls.table_name}_label",
        }
        constraint_names = set(current_info["constraint_names"]).union(
            {
                f"ck_{cls.table_name}_`valid_source`",
                f"fk_{cls.table_name}_user_id_users",
                f"uq_{cls.table_name}_name_{cls.foreign_key_name}_identifier",
            }
        ) - {
            f"uq_{cls.table_name}_name_{cls.foreign_key_name}",
        }
        if db_backend == "postgresql":
            index_names = index_names.union(
                {
                    f"uq_{cls.table_name}_name_{cls.foreign_key_name}_identifier",
                }
            ) - {
                f"uq_{cls.table_name}_name_{cls.foreign_key_name}",
            }
        elif db_backend == "sqlite":
            pass
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )


class TestSpanAnnotations(DBSchemaComparisonTest):
    """Tests schema migration for span_annotations table.

    Schema Changes:

    Columns:
    Base:
    - annotator_kind
    - created_at
    - explanation
    - id
    - label
    - metadata
    - name
    - score
    - updated_at
    - span_rowid

    Added:
    - user_id
    - identifier
    - source

    Indices:
    Dropped:
    - ix_span_annotations_score
    - ix_span_annotations_label

    Kept:
    - ix_span_annotations_span_rowid
    - pk_span_annotations (postgresql)

    Added:
    - uq_span_annotations_name_span_rowid_identifier (postgresql)

    Constraints:
    Dropped:
    - uq_span_annotations_name_span_rowid

    Kept:
    - fk_span_annotations_span_rowid_spans
    - ck_span_annotations_`valid_annotator_kind`
    - pk_span_annotations

    Added:
    - ck_span_annotations_`valid_annotator_kind`
    - ck_span_annotations_`valid_source`
    - fk_span_annotations_user_id_users
    - uq_span_annotations_name_span_rowid_identifier
    """  # noqa: E501

    table_name = "span_annotations"
    foreign_table_name = "spans"
    foreign_key_name = "span_rowid"

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        super()._test_db_schema(_engine, _alembic_config, _db_backend)


class TestTraceAnnotations(DBSchemaComparisonTest):
    """Tests schema migration for trace_annotations table.

    Schema Changes:

    Columns:
    Base:
    - annotator_kind
    - created_at
    - explanation
    - id
    - label
    - metadata
    - name
    - score
    - updated_at
    - trace_rowid

    Added:
    - user_id
    - identifier
    - source

    Indices:
    Dropped:
    - ix_trace_annotations_score
    - ix_trace_annotations_label

    Kept:
    - ix_trace_annotations_trace_rowid
    - pk_trace_annotations (postgresql)

    Added:
    - uq_trace_annotations_name_trace_rowid_identifier (postgresql)

    Constraints:
    Dropped:
    - uq_trace_annotations_name_trace_rowid

    Kept:
    - fk_trace_annotations_trace_rowid_traces
    - ck_trace_annotations_`valid_annotator_kind`
    - pk_trace_annotations

    Added:
    - ck_trace_annotations_`valid_annotator_kind`
    - ck_trace_annotations_`valid_source`
    - fk_trace_annotations_user_id_users
    - uq_trace_annotations_name_trace_rowid_identifier
    """  # noqa: E501

    table_name = "trace_annotations"
    foreign_table_name = "traces"
    foreign_key_name = "trace_rowid"

    def test_db_schema(
        self,
        _engine: Engine,
        _alembic_config: Config,
        _db_backend: _DBBackend,
    ) -> None:
        super()._test_db_schema(_engine, _alembic_config, _db_backend)


class TestDocumentAnnotations(DBSchemaComparisonTest):
    """Tests schema migration for document_annotations table.

    Schema Changes:

    Columns:
    Base:
    - annotator_kind
    - created_at
    - document_position
    - explanation
    - id
    - label
    - metadata
    - name
    - score
    - updated_at
    - span_rowid

    Added:
    - user_id
    - identifier
    - source

    Indices:
    Dropped:
    - ix_document_annotations_score
    - ix_document_annotations_label

    Kept:
    - ix_document_annotations_span_rowid
    - pk_document_annotations (postgresql)

    Added:
    - uq_document_annotations_name_span_rowid_document_pos_identifier (postgresql)

    Constraints:
    Dropped:
    - uq_document_annotations_name_span_rowid_document_position

    Kept:
    - fk_document_annotations_span_rowid_spans
    - ck_document_annotations_`valid_annotator_kind`
    - pk_document_annotations

    Added:
    - ck_document_annotations_`valid_annotator_kind`
    - ck_document_annotations_`valid_source`
    - fk_document_annotations_user_id_users
    - uq_document_annotations_name_span_rowid_document_pos_identifier
    """  # noqa: E501

    table_name = "document_annotations"
    foreign_table_name = "spans"
    foreign_key_name = "span_rowid"

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
            f"{cls.foreign_key_name}",
        }
        index_names = {
            f"ix_{cls.table_name}_score",
            f"ix_{cls.table_name}_label",
            f"ix_{cls.table_name}_{cls.foreign_key_name}",
        }
        constraint_names = {
            f"fk_{cls.table_name}_{cls.foreign_key_name}_{cls.foreign_table_name}",
            f"ck_{cls.table_name}_`valid_annotator_kind`",
            f"pk_{cls.table_name}",
            f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_position",
        }
        if db_backend == "postgresql":
            index_names.update(
                {
                    f"pk_{cls.table_name}",  # Primary key index
                    f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_position",
                }
            )
        elif db_backend == "sqlite":
            index_names.update(
                {
                    f"sqlite_autoindex_{cls.table_name}_1",  # Auto-generated primary key index
                }
            )
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
            column_names=frozenset(column_names),
            index_names=frozenset(index_names),
            constraint_names=frozenset(constraint_names),
        )

    @classmethod
    def _get_upgraded_schema_info(
        cls,
        db_backend: _DBBackend,
    ) -> _TableSchemaInfo:
        current_info = cls._get_current_schema_info(db_backend)
        column_names = set(current_info["column_names"]).union(
            {
                "user_id",
                "identifier",
                "source",
            }
        )
        index_names = set(current_info["index_names"]) - {
            f"ix_{cls.table_name}_score",
            f"ix_{cls.table_name}_label",
        }
        constraint_names = set(current_info["constraint_names"]).union(
            {
                f"ck_{cls.table_name}_`valid_source`",
                f"fk_{cls.table_name}_user_id_users",
                f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_pos_identifier",
            }
        ) - {
            f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_position",
        }
        if db_backend == "postgresql":
            index_names = index_names.union(
                {
                    f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_pos_identifier",
                }
            ) - {
                f"uq_{cls.table_name}_name_{cls.foreign_key_name}_document_position",
            }
        elif db_backend == "sqlite":
            pass
        else:
            assert_never(db_backend)
        return _TableSchemaInfo(
            table_name=cls.table_name,
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
        super()._test_db_schema(_engine, _alembic_config, _db_backend)
