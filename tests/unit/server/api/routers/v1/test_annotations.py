from datetime import datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def project_with_spans_and_annotations(db: DbSessionFactory) -> None:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="test-project").returning(models.Project.id)
        )

        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )

        span1_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="span1",
                parent_id=None,
                name="test span 1",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        span2_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="span2",
                parent_id=None,
                name="test span 2",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        await session.execute(
            insert(models.SpanAnnotation).values(
                span_rowid=span1_id,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="This is correct",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
                identifier="test-identifier-1",
            )
        )

        await session.execute(
            insert(models.SpanAnnotation).values(
                span_rowid=span2_id,
                name="relevance",
                label="relevant",
                score=0.8,
                explanation="This is relevant",
                metadata_={},
                annotator_kind="LLM",
                source="APP",
                identifier="test-identifier-2",
            )
        )

        await session.execute(
            insert(models.SpanAnnotation).values(
                span_rowid=span1_id,
                name="note",
                label=None,
                score=None,
                explanation="This is a user note",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="note-identifier-1",
            )
        )

        await session.execute(
            insert(models.SpanAnnotation).values(
                span_rowid=span2_id,
                name="note",
                label=None,
                score=None,
                explanation="Another user note",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="note-identifier-2",
            )
        )
        await session.commit()


async def test_list_span_annotations_default_behavior(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={"span_ids": ["span1", "span2"]},
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 4

    annotation_names = {annotation["name"] for annotation in data["data"]}
    assert annotation_names == {"correctness", "relevance", "note"}

    note_count = sum(1 for anno in data["data"] if anno["name"] == "note")
    assert note_count == 2

    for annotation in data["data"]:
        assert "id" in annotation
        assert "span_id" in annotation
        assert "name" in annotation
        assert "result" in annotation
        assert "metadata" in annotation
        assert "annotator_kind" in annotation
        assert "created_at" in annotation
        assert "updated_at" in annotation
        assert "identifier" in annotation
        assert "source" in annotation


async def test_list_span_annotations_inclusion_filter(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={
            "span_ids": ["span1", "span2"],
            "include_annotation_names": ["correctness", "note"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 3

    annotation_names = {annotation["name"] for annotation in data["data"]}
    assert annotation_names == {"correctness", "note"}
    assert "relevance" not in annotation_names


async def test_list_span_annotations_exclusion_filter(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={"span_ids": ["span1", "span2"], "exclude_annotation_names": ["note"]},
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 2

    annotation_names = {annotation["name"] for annotation in data["data"]}
    assert annotation_names == {"correctness", "relevance"}
    assert "note" not in annotation_names


async def test_list_span_annotations_combined_filters(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={
            "span_ids": ["span1", "span2"],
            "include_annotation_names": ["correctness", "relevance", "note"],
            "exclude_annotation_names": ["note"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 2

    annotation_names = {annotation["name"] for annotation in data["data"]}
    assert annotation_names == {"correctness", "relevance"}
    assert "note" not in annotation_names


async def test_list_span_annotations_empty_result_when_all_excluded(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="filtered-project").returning(models.Project.id)
        )

        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="filtered-trace-id",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )

        span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="filtered-span",
                parent_id=None,
                name="test span with filtered annotations",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        await session.execute(
            insert(models.SpanAnnotation).values(
                span_rowid=span_id,
                name="test-annotation",
                label=None,
                score=None,
                explanation="This annotation will be excluded",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="test-identifier",
            )
        )

        await session.commit()

    response = await httpx_client.get(
        "v1/projects/filtered-project/span_annotations",
        params={
            "span_ids": ["filtered-span"],
            "exclude_annotation_names": ["test-annotation"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 0
    assert data["next_cursor"] is None


async def test_list_span_annotations_pagination_with_filters(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="pagination-project").returning(models.Project.id)
        )

        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="pagination-trace-id",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )

        span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="pagination-span",
                parent_id=None,
                name="test span for pagination",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        for i in range(5):
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=span_id,
                    name=f"annotation-{i}",
                    label=f"label-{i}",
                    score=0.1 * i,
                    explanation=f"Explanation {i}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=f"identifier-{i}",
                )
            )

        for i in range(3):
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=span_id,
                    name="excluded-annotation",
                    label=None,
                    score=None,
                    explanation=f"Excluded annotation {i}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="APP",
                    identifier=f"excluded-identifier-{i}",
                )
            )

        await session.commit()

    response = await httpx_client.get(
        "v1/projects/pagination-project/span_annotations",
        params={
            "span_ids": ["pagination-span"],
            "limit": 3,
            "exclude_annotation_names": ["excluded-annotation"],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert len(data["data"]) == 3

    for annotation in data["data"]:
        assert annotation["name"] != "excluded-annotation"
        assert annotation["name"].startswith("annotation-")

    assert data["next_cursor"] is not None
