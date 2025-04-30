from datetime import datetime, timezone
from typing import Literal

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text

from . import _up, _version_num


def test_data_migration_for_trace_annotations(
    _engine: Engine,
    _alembic_config: Config,
    _db_backend: Literal["sqlite", "postgresql"],
) -> None:
    # no migrations applied yet
    with pytest.raises(BaseException, match="alembic_version"):
        _version_num(_engine)

    # apply migrations up to before annotation config migration
    _up(_engine, _alembic_config, "bc8fea3c2bc8")

    # insert a project and a trace
    now = datetime.now(timezone.utc)
    with _engine.connect() as conn:
        # Create a project
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

        # Create a trace
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

        # Insert a span
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

        # Insert a trace annotation with LLM annotator kind
        trace_annotation_from_llm_id = conn.execute(
            text(
                """
                INSERT INTO trace_annotations (
                    trace_rowid, name, label, score, explanation,
                    metadata, annotator_kind
                )
                VALUES (
                    :trace_id, :name, :label, :score, :explanation,
                    :metadata, :annotator_kind
                )
                RETURNING id
                """
            ),
            {
                "trace_id": trace_rowid,
                "name": "trace-annotation-from-llm",
                "label": "trace-annotation-label",
                "score": 1.23,
                "explanation": "trace-annotation-explanation",
                "metadata": '{"foo": "bar"}',
                "annotator_kind": "LLM",
            },
        ).scalar()
        conn.commit()

        # Insert a trace annotation with LLM annotator kind
        trace_annotation_from_human_id = conn.execute(
            text(
                """
                INSERT INTO trace_annotations (
                    trace_rowid, name, label, score, explanation,
                    metadata, annotator_kind
                )
                VALUES (
                    :trace_id, :name, :label, :score, :explanation,
                    :metadata, :annotator_kind
                )
                RETURNING id
                """
            ),
            {
                "trace_id": trace_rowid,
                "name": "trace-annotation-from-human",
                "label": "trace-annotation-label",
                "score": 1.23,
                "explanation": "trace-annotation-explanation",
                "metadata": '{"foo": "bar"}',
                "annotator_kind": "HUMAN",
            },
        ).scalar()
        conn.commit()

        # Insert a span annotation with LLM annotator kind
        span_annotation_from_llm_id = conn.execute(
            text(
                """
                INSERT INTO span_annotations (
                    span_rowid, name, label, score, explanation,
                    metadata, annotator_kind
                )
                VALUES (
                    :span_id, :name, :label, :score, :explanation,
                    :metadata, :annotator_kind
                )
                RETURNING id
                """
            ),
            {
                "span_id": span_rowid,
                "name": "span-annotation-from-llm",
                "label": "span-annotation-label",
                "score": 1.23,
                "explanation": "span-annotation-explanation",
                "metadata": '{"foo": "bar"}',
                "annotator_kind": "LLM",
            },
        ).scalar()
        conn.commit()

        # Insert a span annotation with HUMAN annotator kind
        span_annotation_from_human_id = conn.execute(
            text(
                """
                INSERT INTO span_annotations (
                    span_rowid, name, label, score, explanation,
                    metadata, annotator_kind
                )
                VALUES (
                    :span_id, :name, :label, :score, :explanation,
                    :metadata, :annotator_kind
                )
                RETURNING id
                """
            ),
            {
                "span_id": span_rowid,
                "name": "span-annotation-from-human",
                "label": "span-annotation-label",
                "score": 1.23,
                "explanation": "span-annotation-explanation",
                "metadata": '{"foo": "bar"}',
                "annotator_kind": "HUMAN",
            },
        ).scalar()
        conn.commit()

        # Verify that 'CODE' annotator_kind is not allowed before migration
        with pytest.raises(Exception, match="valid_annotator_kind"):
            conn.execute(
                text(
                    """
                    INSERT INTO trace_annotations (
                        trace_rowid, name, label, score, explanation,
                        metadata, annotator_kind
                    )
                    VALUES (
                        :trace_id, :name, :label, :score, :explanation,
                        :metadata, :annotator_kind
                    )
                    """
                ),
                {
                    "trace_id": trace_rowid,
                    "name": "trace-annotation-from-llm",
                    "label": "trace-annotation-label",
                    "score": 1.23,
                    "explanation": "trace-annotation-explanation",
                    "metadata": '{"foo": "bar"}',
                    "annotator_kind": "CODE",
                },
            )
            conn.commit()

    # apply the annotation config migration under test
    _up(_engine, _alembic_config, "2f9d1a65945f")

    # verify new columns exist
    with _engine.connect() as conn:
        # get the trace annotation
        trace_annotation = conn.execute(
            text(
                """
                SELECT id, trace_rowid, name, label, score, explanation, metadata, annotator_kind, created_at, updated_at, identifier, source, user_id
                FROM trace_annotations
                WHERE id = :id
                """  # noqa: E501
            ),
            {"id": trace_annotation_from_llm_id},
        ).first()
        assert trace_annotation is not None
        (
            annotation_id,
            trace_rowid,
            name,
            label,
            score,
            explanation,
            metadata,
            annotator_kind,
            created_at,
            updated_at,
            identifier,
            source,
            user_id,
        ) = trace_annotation
        assert annotation_id == trace_annotation_from_llm_id
        assert trace_rowid == trace_rowid
        assert name == "trace-annotation-from-llm"
        assert label == "trace-annotation-label"
        assert score == 1.23
        assert explanation == "trace-annotation-explanation"
        assert metadata == '{"foo": "bar"}'
        assert isinstance(created_at, str)
        assert isinstance(updated_at, str)
        assert annotator_kind == "LLM"
        assert identifier == ""
        assert source == "API"
        assert user_id is None

    # verify new columns exist
    with _engine.connect() as conn:
        # get the trace annotation
        trace_annotation_from_human = conn.execute(
            text(
                """
                SELECT id, trace_rowid, name, label, score, explanation, metadata, annotator_kind, created_at, updated_at, identifier, source, user_id
                FROM trace_annotations
                WHERE id = :id
                """  # noqa: E501
            ),
            {"id": trace_annotation_from_human_id},
        ).first()
        assert trace_annotation_from_human is not None
        (
            annotation_id,
            trace_rowid,
            name,
            label,
            score,
            explanation,
            metadata,
            annotator_kind,
            created_at,
            updated_at,
            identifier,
            source,
            user_id,
        ) = trace_annotation_from_human
        assert annotation_id == trace_annotation_from_human_id
        assert trace_rowid == trace_rowid
        assert name == "trace-annotation-from-human"
        assert label == "trace-annotation-label"
        assert score == 1.23
        assert explanation == "trace-annotation-explanation"
        assert metadata == '{"foo": "bar"}'
        assert isinstance(created_at, str)
        assert isinstance(updated_at, str)
        assert annotator_kind == "HUMAN"
        assert identifier == ""
        assert source == "APP"
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

        # after migration, 'CODE' is allowed and new columns are required
        conn.execute(
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
                """
            ),
            {
                "trace_rowid": trace_rowid,
                "name": "trace-annotation-name-2",
                "label": "trace-annotation-label-2",
                "score": 2.34,
                "explanation": "trace-annotation-explanation",
                "metadata": '{"foo": "baz"}',
                "annotator_kind": "CODE",
                "user_id": None,
                "identifier": "id1",
                "source": "API",
            },
        )
        conn.commit()
