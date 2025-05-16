from datetime import datetime, timezone
from typing import Any, Literal

import pytest
from alembic.config import Config
from sqlalchemy import Connection, Engine, text
from typing_extensions import assert_never

from . import _down, _up, _version_num


def test_annotation_config_migration(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
) -> None:
    # no migrations applied yet
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine)

    # apply migrations up to right before annotation config migration
    _up(_engine, _alembic_config, "bc8fea3c2bc8")

    # insert entities to be annotated
    now = datetime.now(timezone.utc)
    with _engine.connect() as conn:
        # create a project
        project_id = conn.execute(
            text(
                """
                INSERT INTO projects (name, description)
                VALUES (:name, :description)
                RETURNING id
                """
            ),
            {"name": "project-name", "description": None},
        ).scalar()

        # insert a trace
        trace_rowid = conn.execute(
            text(
                """
                INSERT INTO traces (project_rowid, trace_id, start_time, end_time)
                VALUES (:project_id, :trace_id, :now, :now)
                RETURNING id
                """
            ),
            {
                "project_id": project_id,
                "trace_id": "trace1",
                "now": now,
            },
        ).scalar()
        assert isinstance(trace_rowid, int)

        # insert a span
        span_rowid = conn.execute(
            text(
                """
                INSERT INTO spans (
                    trace_rowid, span_id, parent_id, name, span_kind, start_time, end_time,
                    attributes, events, status_code, status_message,
                    cumulative_error_count, cumulative_llm_token_count_prompt,
                    cumulative_llm_token_count_completion, llm_token_count_prompt,
                    llm_token_count_completion
                )
                VALUES (
                    :trace_rowid, :span_id, :parent_id, :name, :span_kind, :start_time, :end_time,
                    :attributes, :events, :status_code, :status_message,
                    :cumulative_error_count, :cumulative_llm_token_count_prompt,
                    :cumulative_llm_token_count_completion, :llm_token_count_prompt,
                    :llm_token_count_completion
                )
                RETURNING id
                """
            ),
            {
                "trace_rowid": trace_rowid,
                "span_id": "span1",
                "parent_id": None,
                "name": "span-name",
                "span_kind": "INTERNAL",
                "start_time": now,
                "end_time": now,
                "attributes": "{}",
                "events": "[]",
                "status_code": "OK",
                "status_message": "",
                "cumulative_error_count": 0,
                "cumulative_llm_token_count_prompt": 0,
                "cumulative_llm_token_count_completion": 0,
                "llm_token_count_prompt": None,
                "llm_token_count_completion": None,
            },
        ).scalar()
        assert isinstance(span_rowid, int)
        conn.commit()

    for iteration_index in range(2):
        # test behavior before up migration
        with _engine.connect() as conn:
            # verify columns
            if _db_backend == "sqlite":
                trace_annotations_table_def = _get_sqlite_table_info(conn, "trace_annotations")
                span_annotations_table_def = _get_sqlite_table_info(conn, "span_annotations")
                document_annotations_table_def = _get_sqlite_table_info(
                    conn, "document_annotations"
                )

                # Check trace_annotations
                assert "identifier" not in trace_annotations_table_def
                assert "source" not in trace_annotations_table_def
                assert "user_id" not in trace_annotations_table_def
                assert "annotator_kind VARCHAR NOT NULL" in trace_annotations_table_def
                assert (
                    """CONSTRAINT "ck_trace_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'HUMAN'))"""  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_trace_annotations_trace_rowid_traces FOREIGN KEY(trace_rowid) REFERENCES traces (id) ON DELETE CASCADE"  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT pk_trace_annotations PRIMARY KEY (id)"
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_trace_annotations_name_trace_rowid UNIQUE (name, trace_rowid)"
                    in trace_annotations_table_def
                )
                assert trace_annotations_table_def.count("CONSTRAINT") == 4

                # Check span_annotations
                assert "identifier" not in span_annotations_table_def
                assert "source" not in span_annotations_table_def
                assert "user_id" not in span_annotations_table_def
                assert "annotator_kind VARCHAR NOT NULL" in span_annotations_table_def
                assert (
                    """CONSTRAINT "ck_span_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'HUMAN'))"""  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_span_annotations_span_rowid_spans FOREIGN KEY(span_rowid) REFERENCES spans (id) ON DELETE CASCADE"  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT pk_span_annotations PRIMARY KEY (id)" in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_span_annotations_name_span_rowid UNIQUE (name, span_rowid)"
                    in span_annotations_table_def
                )
                assert span_annotations_table_def.count("CONSTRAINT") == 4

                # Check document_annotations
                assert "identifier" not in document_annotations_table_def
                assert "source" not in document_annotations_table_def
                assert "user_id" not in document_annotations_table_def
                assert "annotator_kind VARCHAR NOT NULL" in document_annotations_table_def
                assert (
                    """CONSTRAINT "ck_document_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'HUMAN'))"""  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_document_annotations_span_rowid_spans FOREIGN KEY(span_rowid) REFERENCES spans (id) ON DELETE CASCADE"  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT pk_document_annotations PRIMARY KEY (id)"
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_document_annotations_name_span_rowid_document_position UNIQUE (name, span_rowid, document_position)"  # noqa: E501
                    in document_annotations_table_def
                )
                assert document_annotations_table_def.count("CONSTRAINT") == 4

            elif _db_backend == "postgresql":
                # Get table information for all three tables
                trace_annotations_info = _get_postgres_table_info(conn, "trace_annotations")
                span_annotations_info = _get_postgres_table_info(conn, "span_annotations")
                document_annotations_info = _get_postgres_table_info(conn, "document_annotations")

                # Check trace_annotations
                columns = trace_annotations_info["columns"]
                assert "identifier" not in columns
                assert "source" not in columns
                assert "user_id" not in columns
                assert "annotator_kind" in columns
                assert columns["annotator_kind"]["data_type"] == "character varying"
                assert columns["annotator_kind"]["is_nullable"] == "NO"
                constraints = trace_annotations_info["constraints"]
                assert constraints["ck_trace_annotations_`valid_annotator_kind`"] == {
                    "constraint_type": "CHECK",
                    "column_names": None,
                }
                assert constraints["fk_trace_annotations_trace_rowid_traces"] == {
                    "constraint_type": "FOREIGN KEY",
                    "column_names": ["trace_rowid"],
                }
                assert constraints["pk_trace_annotations"] == {
                    "constraint_type": "PRIMARY KEY",
                    "column_names": ["id"],
                }
                assert constraints["uq_trace_annotations_name_trace_rowid"] == {
                    "constraint_type": "UNIQUE",
                    "column_names": ["name", "trace_rowid"],
                }

                # Check span_annotations
                columns = span_annotations_info["columns"]
                assert "identifier" not in columns
                assert "source" not in columns
                assert "user_id" not in columns
                assert "annotator_kind" in columns
                assert columns["annotator_kind"]["data_type"] == "character varying"
                assert columns["annotator_kind"]["is_nullable"] == "NO"
                constraints = span_annotations_info["constraints"]
                assert constraints["ck_span_annotations_`valid_annotator_kind`"] == {
                    "constraint_type": "CHECK",
                    "column_names": None,
                }
                assert constraints["fk_span_annotations_span_rowid_spans"] == {
                    "constraint_type": "FOREIGN KEY",
                    "column_names": ["span_rowid"],
                }
                assert constraints["pk_span_annotations"] == {
                    "constraint_type": "PRIMARY KEY",
                    "column_names": ["id"],
                }
                assert constraints["uq_span_annotations_name_span_rowid"] == {
                    "constraint_type": "UNIQUE",
                    "column_names": ["name", "span_rowid"],
                }

                # Check document_annotations
                columns = document_annotations_info["columns"]
                assert "identifier" not in columns
                assert "source" not in columns
                assert "user_id" not in columns
                assert "annotator_kind" in columns
                assert columns["annotator_kind"]["data_type"] == "character varying"
                assert columns["annotator_kind"]["is_nullable"] == "NO"
                constraints = document_annotations_info["constraints"]
                assert constraints["ck_document_annotations_`valid_annotator_kind`"] == {
                    "constraint_type": "CHECK",
                    "column_names": None,
                }
                assert constraints["fk_document_annotations_span_rowid_spans"] == {
                    "constraint_type": "FOREIGN KEY",
                    "column_names": ["span_rowid"],
                }
                assert constraints["pk_document_annotations"] == {
                    "constraint_type": "PRIMARY KEY",
                    "column_names": ["id"],
                }
                assert constraints["uq_document_annotations_name_span_rowid_document_position"] == {
                    "constraint_type": "UNIQUE",
                    "column_names": ["name", "span_rowid", "document_position"],
                }

            else:
                assert_never(_db_backend)

            # insert a trace annotation with LLM annotator kind
            trace_annotation_from_llm_id = _create_trace_annotation_pre_migration(
                conn=conn,
                trace_rowid=trace_rowid,
                name=f"trace-annotation-from-llm-{iteration_index}",
                label="trace-annotation-label",
                score=1.23,
                explanation="trace-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="LLM",
            )
            conn.commit()

            # insert a trace annotation with HUMAN annotator kind
            trace_annotation_from_human_id = _create_trace_annotation_pre_migration(
                conn=conn,
                trace_rowid=trace_rowid,
                name=f"trace-annotation-from-human-{iteration_index}",
                label="trace-annotation-label",
                score=1.23,
                explanation="trace-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="HUMAN",
            )
            conn.commit()

            # insert a span annotation with LLM annotator kind
            span_annotation_from_llm_id = _create_span_annotation_pre_migration(
                conn=conn,
                span_rowid=span_rowid,
                name=f"span-annotation-from-llm-{iteration_index}",
                label="span-annotation-label",
                score=1.23,
                explanation="span-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="LLM",
            )
            conn.commit()

            # insert a span annotation with HUMAN annotator kind
            span_annotation_from_human_id = _create_span_annotation_pre_migration(
                conn=conn,
                span_rowid=span_rowid,
                name=f"span-annotation-from-human-{iteration_index}",
                label="span-annotation-label",
                score=1.23,
                explanation="span-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="HUMAN",
            )
            conn.commit()

            # insert a document annotation with LLM annotator kind
            document_annotation_from_llm_id = _create_document_annotation_pre_migration(
                conn=conn,
                span_rowid=span_rowid,
                document_position=0,
                name=f"document-annotation-from-llm-{iteration_index}",
                label="document-annotation-label",
                score=1.23,
                explanation="document-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="LLM",
            )
            conn.commit()

            # insert a document annotation with HUMAN annotator kind
            document_annotation_from_human_id = _create_document_annotation_pre_migration(
                conn=conn,
                span_rowid=span_rowid,
                document_position=1,
                name=f"document-annotation-from-human-{iteration_index}",
                label="document-annotation-label",
                score=1.23,
                explanation="document-annotation-explanation",
                metadata='{"foo": "bar"}',
                annotator_kind="HUMAN",
            )
            conn.commit()

        with _engine.connect() as conn:
            # verify that 'CODE' annotator_kind is not allowed for trace annotations before migration  # noqa: E501
            with pytest.raises(Exception) as exc_info:
                _create_trace_annotation_pre_migration(
                    conn=conn,
                    trace_rowid=trace_rowid,
                    name=f"trace-annotation-from-llm-{iteration_index}",
                    label="trace-annotation-label",
                    score=1.23,
                    explanation="trace-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                )
                # conn.commit()
            assert "valid_annotator_kind" in str(exc_info.value)

        with _engine.connect() as conn:
            # verify that 'CODE' annotator_kind is not allowed for span annotations before migration
            with pytest.raises(Exception) as exc_info:
                _create_span_annotation_pre_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    name=f"span-annotation-from-code-{iteration_index}",
                    label="span-annotation-label",
                    score=1.23,
                    explanation="span-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                )
                conn.commit()
            assert "valid_annotator_kind" in str(exc_info.value)

        with _engine.connect() as conn:
            # Verify that 'CODE' annotator_kind is not allowed for document annotations before migration  # noqa: E501
            with pytest.raises(Exception) as exc_info:
                _create_document_annotation_pre_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    document_position=2,
                    name=f"document-annotation-from-code-{iteration_index}",
                    label="document-annotation-label",
                    score=1.23,
                    explanation="document-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                )
                conn.commit()
            assert "valid_annotator_kind" in str(exc_info.value)

        # run the annotation config migration
        _up(_engine, _alembic_config, "2f9d1a65945f")

        # verify new columns exist and have been backfilled
        with _engine.connect() as conn:
            # verify expected columns and constraints exist
            if _db_backend == "sqlite":
                trace_annotations_table_def = _get_sqlite_table_info(conn, "trace_annotations")
                span_annotations_table_def = _get_sqlite_table_info(conn, "span_annotations")
                document_annotations_table_def = _get_sqlite_table_info(
                    conn, "document_annotations"
                )

                # Check trace_annotations
                assert "annotator_kind VARCHAR NOT NULL" in trace_annotations_table_def
                assert "identifier VARCHAR DEFAULT ('') NOT NULL" in trace_annotations_table_def
                assert "source VARCHAR NOT NULL" in trace_annotations_table_def
                assert "user_id INTEGER" in trace_annotations_table_def
                assert (
                    "CONSTRAINT pk_trace_annotations PRIMARY KEY (id)"
                    in trace_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_trace_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'CODE', 'HUMAN'))"""  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_trace_annotations_trace_rowid_traces FOREIGN KEY(trace_rowid) REFERENCES traces (id) ON DELETE CASCADE"  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_trace_annotations_name_trace_rowid_identifier UNIQUE (name, trace_rowid, identifier)"  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_trace_annotations_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL"  # noqa: E501
                    in trace_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_trace_annotations_`valid_source`" CHECK (source IN ('API', 'APP'))"""  # noqa: E501
                    in trace_annotations_table_def
                )
                assert trace_annotations_table_def.count("CONSTRAINT") == 6

                # Check span_annotations
                assert "annotator_kind VARCHAR NOT NULL" in span_annotations_table_def
                assert "identifier VARCHAR DEFAULT ('') NOT NULL" in span_annotations_table_def
                assert "source VARCHAR NOT NULL" in span_annotations_table_def
                assert "user_id INTEGER" in span_annotations_table_def
                assert (
                    "CONSTRAINT pk_span_annotations PRIMARY KEY (id)" in span_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_span_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'CODE', 'HUMAN'))"""  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_span_annotations_span_rowid_spans FOREIGN KEY(span_rowid) REFERENCES spans (id) ON DELETE CASCADE"  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_span_annotations_name_span_rowid_identifier UNIQUE (name, span_rowid, identifier)"  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_span_annotations_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL"  # noqa: E501
                    in span_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_span_annotations_`valid_source`" CHECK (source IN ('API', 'APP'))"""  # noqa: E501
                    in span_annotations_table_def
                )
                assert span_annotations_table_def.count("CONSTRAINT") == 6

                # Check document_annotations
                assert "annotator_kind VARCHAR NOT NULL" in document_annotations_table_def
                assert "identifier VARCHAR DEFAULT ('') NOT NULL" in document_annotations_table_def
                assert "source VARCHAR NOT NULL" in document_annotations_table_def
                assert "user_id INTEGER" in document_annotations_table_def
                assert (
                    "CONSTRAINT pk_document_annotations PRIMARY KEY (id)"
                    in document_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_document_annotations_`valid_annotator_kind`" CHECK (annotator_kind IN ('LLM', 'CODE', 'HUMAN'))"""  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_document_annotations_span_rowid_spans FOREIGN KEY(span_rowid) REFERENCES spans (id) ON DELETE CASCADE"  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT uq_document_annotations_name_span_rowid_document_pos_identifier UNIQUE (name, span_rowid, document_position, identifier)"  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    "CONSTRAINT fk_document_annotations_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL"  # noqa: E501
                    in document_annotations_table_def
                )
                assert (
                    """CONSTRAINT "ck_document_annotations_`valid_source`" CHECK (source IN ('API', 'APP'))"""  # noqa: E501
                    in document_annotations_table_def
                )
                assert document_annotations_table_def.count("CONSTRAINT") == 6

            elif _db_backend == "postgresql":
                # Get table information for all three tables
                trace_annotations_info = _get_postgres_table_info(conn, "trace_annotations")
                span_annotations_info = _get_postgres_table_info(conn, "span_annotations")
                document_annotations_info = _get_postgres_table_info(conn, "document_annotations")
            else:
                assert_never(_db_backend)

            # get the trace annotation from llm
            trace_annotation_from_llm = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM trace_annotations
                    WHERE id = :id
                    """
                ),
                {"id": trace_annotation_from_llm_id},
            ).first()
            assert trace_annotation_from_llm is not None
            (identifier, source, user_id) = trace_annotation_from_llm
            assert identifier == ""
            assert source == "API"
            assert user_id is None

            # get the trace annotation from human
            trace_annotation_from_human = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM trace_annotations
                    WHERE id = :id
                    """
                ),
                {"id": trace_annotation_from_human_id},
            ).first()
            assert trace_annotation_from_human is not None
            (identifier, source, user_id) = trace_annotation_from_human
            assert identifier == ""
            assert source == "APP"
            assert user_id is None

            # get the span annotation from llm
            span_annotation_from_llm = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM span_annotations
                    WHERE id = :id
                    """
                ),
                {"id": span_annotation_from_llm_id},
            ).first()
            assert span_annotation_from_llm is not None
            (identifier, source, user_id) = span_annotation_from_llm
            assert identifier == ""
            assert source == "API"
            assert user_id is None

            # get the span annotation from human
            span_annotation_from_human = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM span_annotations
                    WHERE id = :id
                    """
                ),
                {"id": span_annotation_from_human_id},
            ).first()
            assert span_annotation_from_human is not None
            (identifier, source, user_id) = span_annotation_from_human
            assert identifier == ""
            assert source == "APP"
            assert user_id is None

            # get the document annotation from llm
            document_annotation_from_llm = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM document_annotations
                    WHERE id = :id
                    """
                ),
                {"id": document_annotation_from_llm_id},
            ).first()
            assert document_annotation_from_llm is not None
            (identifier, source, user_id) = document_annotation_from_llm
            assert identifier == ""
            assert source == "API"
            assert user_id is None

            # get the document annotation from human
            document_annotation_from_human = conn.execute(
                text(
                    """
                    SELECT identifier, source, user_id
                    FROM document_annotations
                    WHERE id = :id
                    """
                ),
                {"id": document_annotation_from_human_id},
            ).first()
            assert document_annotation_from_human is not None
            (identifier, source, user_id) = document_annotation_from_human
            assert identifier == ""
            assert source == "APP"
            assert user_id is None

        with _engine.connect() as conn:
            # verify source is non-nullable for trace annotations
            with pytest.raises(Exception) as exc_info:
                _create_trace_annotation_post_migration(
                    conn=conn,
                    trace_rowid=trace_rowid,
                    name=f"trace-annotation-name-{iteration_index}",
                    label="trace-annotation-label",
                    score=1.23,
                    explanation="trace-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier="",
                    user_id=None,
                    source=None,  # type: ignore
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "source" in error_message

        with _engine.connect() as conn:
            # verify source is non-nullable for span annotations
            with pytest.raises(Exception) as exc_info:
                _create_span_annotation_post_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    name=f"span-annotation-name-{iteration_index}",
                    label="span-annotation-label",
                    score=1.23,
                    explanation="span-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier="",
                    user_id=None,
                    source=None,  # type: ignore
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "source" in error_message

        with _engine.connect() as conn:
            # verify source is non-nullable for document annotations
            with pytest.raises(Exception) as exc_info:
                _create_document_annotation_post_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    document_position=4,
                    name=f"document-annotation-name-{iteration_index}",
                    label="document-annotation-label",
                    score=1.23,
                    explanation="document-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier="",
                    user_id=None,
                    source=None,  # type: ignore
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "source" in error_message

        with _engine.connect() as conn:
            # verify identifier is non-nullable for trace annotations
            with pytest.raises(Exception) as exc_info:
                _create_trace_annotation_post_migration(
                    conn=conn,
                    trace_rowid=trace_rowid,
                    name=f"trace-annotation-name-{iteration_index}",
                    label="trace-annotation-label",
                    score=1.23,
                    explanation="trace-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier=None,  # type: ignore
                    user_id=None,
                    source="API",
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "identifier" in error_message

        with _engine.connect() as conn:
            # verify identifier is non-nullable for span annotations
            with pytest.raises(Exception) as exc_info:
                _create_span_annotation_post_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    name=f"span-annotation-name-{iteration_index}",
                    label="span-annotation-label",
                    score=1.23,
                    explanation="span-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier=None,  # type: ignore
                    user_id=None,
                    source="API",
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "identifier" in error_message

        with _engine.connect() as conn:
            # verify identifier is non-nullable for document annotations
            with pytest.raises(Exception) as exc_info:
                _create_document_annotation_post_migration(
                    conn=conn,
                    span_rowid=span_rowid,
                    document_position=4,
                    name=f"document-annotation-name-{iteration_index}",
                    label="document-annotation-label",
                    score=1.23,
                    explanation="document-annotation-explanation",
                    metadata='{"foo": "bar"}',
                    annotator_kind="CODE",
                    identifier=None,  # type: ignore
                    user_id=None,
                    source="API",
                )
            error_message = str(exc_info.value).lower()
            assert (
                "not null" in error_message
                or "not-null" in error_message
                or "notnull" in error_message
            )
            assert "identifier" in error_message

        with _engine.connect() as conn:
            # verify that after migration, 'CODE' is allowed
            trace_annotation_from_code_id = _create_trace_annotation_post_migration(
                conn=conn,
                trace_rowid=trace_rowid,
                name=f"trace-annotation-name-2-{iteration_index}",
                label="trace-annotation-label-2",
                score=2.34,
                explanation="trace-annotation-explanation",
                metadata='{"foo": "baz"}',
                annotator_kind="CODE",
                user_id=None,
                identifier="id1",
                source="API",
            )
            conn.commit()

            # verify CODE annotator kind for span annotations
            span_annotation_from_code_id = _create_span_annotation_post_migration(
                conn=conn,
                span_rowid=span_rowid,
                name=f"span-annotation-name-2-{iteration_index}",
                label="span-annotation-label-2",
                score=2.34,
                explanation="span-annotation-explanation",
                metadata='{"foo": "baz"}',
                annotator_kind="CODE",
                user_id=None,
                identifier="id2",
                source="API",
            )
            conn.commit()

            # verify CODE annotator kind for document annotations
            document_annotation_from_code_id = _create_document_annotation_post_migration(
                conn=conn,
                span_rowid=span_rowid,
                document_position=3,
                name=f"document-annotation-name-2-{iteration_index}",
                label="document-annotation-label-2",
                score=2.34,
                explanation="document-annotation-explanation",
                metadata='{"foo": "baz"}',
                annotator_kind="CODE",
                user_id=None,
                identifier="id3",
                source="API",
            )
            conn.commit()

            # delete the annotations with CODE annotator kind because they will break the down migration  # noqa: E501
            conn.execute(
                text("DELETE FROM trace_annotations WHERE id = :id"),
                {"id": trace_annotation_from_code_id},
            )
            conn.execute(
                text("DELETE FROM span_annotations WHERE id = :id"),
                {"id": span_annotation_from_code_id},
            )
            conn.execute(
                text("DELETE FROM document_annotations WHERE id = :id"),
                {"id": document_annotation_from_code_id},
            )
            conn.commit()

        _down(_engine, _alembic_config, "bc8fea3c2bc8")


def _create_trace_annotation_pre_migration(
    conn: Connection,
    trace_rowid: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO trace_annotations (
                trace_rowid, name, label, score, explanation,
                metadata, annotator_kind
            )
            VALUES (
                :trace_rowid, :name, :label, :score, :explanation,
                :metadata, :annotator_kind
            )
            RETURNING id
            """
        ),
        {
            "trace_rowid": trace_rowid,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _create_span_annotation_pre_migration(
    conn: Connection,
    span_rowid: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO span_annotations (
                span_rowid, name, label, score, explanation,
                metadata, annotator_kind
            )
            VALUES (
                :span_rowid, :name, :label, :score, :explanation,
                :metadata, :annotator_kind
            )
            RETURNING id
            """
        ),
        {
            "span_rowid": span_rowid,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _create_document_annotation_pre_migration(
    conn: Connection,
    span_rowid: int,
    document_position: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO document_annotations (
                span_rowid, document_position, name, label, score, explanation,
                metadata, annotator_kind
            )
            VALUES (
                :span_rowid, :document_position, :name, :label, :score, :explanation,
                :metadata, :annotator_kind
            )
            RETURNING id
            """
        ),
        {
            "span_rowid": span_rowid,
            "document_position": document_position,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _create_trace_annotation_post_migration(
    conn: Connection,
    trace_rowid: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
    user_id: Any,
    identifier: str,
    source: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO trace_annotations (
                trace_rowid, name, label, score, explanation,
                metadata, annotator_kind, user_id, identifier, source
            )
            VALUES (
                :trace_rowid, :name, :label, :score, :explanation,
                :metadata, :annotator_kind, :user_id, :identifier, :source
            )
            RETURNING id
            """
        ),
        {
            "trace_rowid": trace_rowid,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
            "user_id": user_id,
            "identifier": identifier,
            "source": source,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _create_span_annotation_post_migration(
    conn: Connection,
    span_rowid: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
    user_id: Any,
    identifier: str,
    source: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO span_annotations (
                span_rowid, name, label, score, explanation,
                metadata, annotator_kind, user_id, identifier, source
            )
            VALUES (
                :span_rowid, :name, :label, :score, :explanation,
                :metadata, :annotator_kind, :user_id, :identifier, :source
            )
            RETURNING id
            """
        ),
        {
            "span_rowid": span_rowid,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
            "user_id": user_id,
            "identifier": identifier,
            "source": source,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _create_document_annotation_post_migration(
    conn: Connection,
    span_rowid: int,
    document_position: int,
    name: str,
    label: str,
    score: float,
    explanation: str,
    metadata: str,
    annotator_kind: str,
    user_id: Any,
    identifier: str,
    source: str,
) -> int:
    id = conn.execute(
        text(
            """
            INSERT INTO document_annotations (
                span_rowid, document_position, name, label, score, explanation,
                metadata, annotator_kind, user_id, identifier, source
            )
            VALUES (
                :span_rowid, :document_position, :name, :label, :score, :explanation,
                :metadata, :annotator_kind, :user_id, :identifier, :source
            )
            RETURNING id
            """
        ),
        {
            "span_rowid": span_rowid,
            "document_position": document_position,
            "name": name,
            "label": label,
            "score": score,
            "explanation": explanation,
            "metadata": metadata,
            "annotator_kind": annotator_kind,
            "user_id": user_id,
            "identifier": identifier,
            "source": source,
        },
    ).scalar()
    assert isinstance(id, int)
    return id


def _get_sqlite_table_info(conn: Connection, table_name: str) -> str:
    table_info = conn.execute(
        text(
            """
            SELECT sql FROM sqlite_master
            WHERE type='table' AND name=:table_name;
            """
        ),
        {"table_name": table_name},
    ).scalar()
    assert isinstance(table_info, str)
    return table_info


def _get_postgres_table_info(conn: Connection, table_name: str) -> dict[str, Any]:
    table_info = conn.execute(
        text(
            """
            SELECT json_build_object(
              'table_name', t.table_name,
              'columns', (
                SELECT json_object_agg(
                  c.column_name,
                  json_build_object(
                    'data_type', c.data_type,
                    'is_nullable', c.is_nullable,
                    'ordinal_position', c.ordinal_position
                  )
                )
                FROM information_schema.columns c
                WHERE c.table_name = :table_name
                  AND c.table_schema = current_schema()
              ),
              'constraints', (
                SELECT json_object_agg(
                  tc.constraint_name,
                  json_build_object(
                    'constraint_type', tc.constraint_type,
                    'column_names', (
                      SELECT json_agg(kcu.column_name ORDER BY kcu.position_in_unique_constraint NULLS FIRST, kcu.ordinal_position)
                      FROM information_schema.key_column_usage kcu
                      WHERE tc.constraint_name = kcu.constraint_name
                        AND tc.table_schema = kcu.table_schema
                        AND tc.table_name = kcu.table_name
                    )
                  )
                )
                FROM information_schema.table_constraints tc
                WHERE tc.table_name = :table_name
                  AND tc.table_schema = current_schema()
              )
            ) AS table_structure
            FROM information_schema.tables t
            WHERE t.table_name = :table_name
              AND t.table_schema = current_schema()
            LIMIT 1;
            """  # noqa: E501
        ),
        {"table_name": table_name},
    ).scalar()
    assert isinstance(table_info, dict)
    return table_info
