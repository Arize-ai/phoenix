import random
from datetime import datetime, timezone

import pytest
from alembic.config import Config
from sqlalchemy import Engine, text

from . import _down, _up, _version_num


def test_annotation_config_migration(
    _engine: Engine,
    _alembic_config: Config,
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

    for _ in range(2):
        # test before migration
        with _engine.connect() as conn:
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
                    "name": f"trace-annotation-from-llm-{random.randint(1, 1000)}",
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
                    "name": f"trace-annotation-from-human-{random.randint(1, 1000)}",
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
                    "name": f"span-annotation-from-llm-{random.randint(1, 1000)}",
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
                    "name": f"span-annotation-from-human-{random.randint(1, 1000)}",
                    "label": "span-annotation-label",
                    "score": 1.23,
                    "explanation": "span-annotation-explanation",
                    "metadata": '{"foo": "bar"}',
                    "annotator_kind": "HUMAN",
                },
            ).scalar()
            conn.commit()

            # Insert a document annotation with LLM annotator kind
            document_annotation_from_llm_id = conn.execute(
                text(
                    """
                    INSERT INTO document_annotations (
                        span_rowid, document_position, name, label, score, explanation,
                        metadata, annotator_kind
                    )
                    VALUES (
                        :span_id, :document_position, :name, :label, :score, :explanation,
                        :metadata, :annotator_kind
                    )
                    RETURNING id
                    """
                ),
                {
                    "span_id": span_rowid,
                    "document_position": 0,
                    "name": f"document-annotation-from-llm-{random.randint(1, 1000)}",
                    "label": "document-annotation-label",
                    "score": 1.23,
                    "explanation": "document-annotation-explanation",
                    "metadata": '{"foo": "bar"}',
                    "annotator_kind": "LLM",
                },
            ).scalar()
            conn.commit()

            # Insert a document annotation with HUMAN annotator kind
            document_annotation_from_human_id = conn.execute(
                text(
                    """
                    INSERT INTO document_annotations (
                        span_rowid, document_position, name, label, score, explanation,
                        metadata, annotator_kind
                    )
                    VALUES (
                        :span_id, :document_position, :name, :label, :score, :explanation,
                        :metadata, :annotator_kind
                    )
                    RETURNING id
                    """
                ),
                {
                    "span_id": span_rowid,
                    "document_position": 1,
                    "name": f"document-annotation-from-human-{random.randint(1, 1000)}",
                    "label": "document-annotation-label",
                    "score": 1.23,
                    "explanation": "document-annotation-explanation",
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
                        "name": f"trace-annotation-from-llm-{random.randint(1, 1000)}",
                        "label": "trace-annotation-label",
                        "score": 1.23,
                        "explanation": "trace-annotation-explanation",
                        "metadata": '{"foo": "bar"}',
                        "annotator_kind": "CODE",
                    },
                )
                conn.commit()

            # Verify that 'CODE' annotator_kind is not allowed for span annotations before migration
            with pytest.raises(Exception, match="valid_annotator_kind"):
                conn.execute(
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
                        """
                    ),
                    {
                        "span_id": span_rowid,
                        "name": f"span-annotation-from-code-{random.randint(1, 1000)}",
                        "label": "span-annotation-label",
                        "score": 1.23,
                        "explanation": "span-annotation-explanation",
                        "metadata": '{"foo": "bar"}',
                        "annotator_kind": "CODE",
                    },
                )
                conn.commit()

            # Verify that 'CODE' annotator_kind is not allowed for document annotations before migration  # noqa: E501
            with pytest.raises(Exception, match="valid_annotator_kind"):
                conn.execute(
                    text(
                        """
                        INSERT INTO document_annotations (
                            span_rowid, document_position, name, label, score, explanation,
                            metadata, annotator_kind
                        )
                        VALUES (
                            :span_id, :document_position, :name, :label, :score, :explanation,
                            :metadata, :annotator_kind
                        )
                        """
                    ),
                    {
                        "span_id": span_rowid,
                        "document_position": 2,
                        "name": f"document-annotation-from-code-{random.randint(1, 1000)}",
                        "label": "document-annotation-label",
                        "score": 1.23,
                        "explanation": "document-annotation-explanation",
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
                    SELECT identifier, source, user_id
                    FROM trace_annotations
                    WHERE id = :id
                    """
                ),
                {"id": trace_annotation_from_llm_id},
            ).first()
            assert trace_annotation is not None
            (identifier, source, user_id) = trace_annotation
            assert identifier == ""
            assert source == "API"
            assert user_id is None

            # get the trace annotation
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

            # after migration, 'CODE' is allowed and new columns are required
            trace_annotation_id = conn.execute(
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
                    "name": f"trace-annotation-name-2-{random.randint(1, 1000)}",
                    "label": "trace-annotation-label-2",
                    "score": 2.34,
                    "explanation": "trace-annotation-explanation",
                    "metadata": '{"foo": "baz"}',
                    "annotator_kind": "CODE",
                    "user_id": None,
                    "identifier": "id1",
                    "source": "API",
                },
            ).scalar()
            conn.commit()

            # Delete the trace annotation
            conn.execute(
                text("DELETE FROM trace_annotations WHERE id = :id"), {"id": trace_annotation_id}
            )
            conn.commit()

        _down(_engine, _alembic_config, "bc8fea3c2bc8")
