from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from sqlalchemy import insert, select, update

from phoenix.db import models
from phoenix.server.api.routers.v1.annotations import _resolve_non_admin_user_id
from phoenix.server.bearer_auth import PhoenixUser
from phoenix.server.dml_event import (
    ProjectSessionAnnotationDeleteEvent,
    SpanAnnotationDeleteEvent,
    TraceAnnotationDeleteEvent,
)
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

        trace2_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="test-trace-id-2",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )

        session1_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="session1",
                project_id=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.ProjectSession.id)
        )

        session2_id = await session.scalar(
            insert(models.ProjectSession)
            .values(
                session_id="session2",
                project_id=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:02:00.000+00:00"),
            )
            .returning(models.ProjectSession.id)
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

        # Trace annotations on the two traces.
        await session.execute(
            insert(models.TraceAnnotation).values(
                trace_rowid=trace_id,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="Trace 1 correct",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
                identifier="test-identifier-1",
            )
        )
        await session.execute(
            insert(models.TraceAnnotation).values(
                trace_rowid=trace2_id,
                name="relevance",
                label="relevant",
                score=0.8,
                explanation="Trace 2 relevant",
                metadata_={},
                annotator_kind="LLM",
                source="APP",
                identifier="test-identifier-2",
            )
        )

        # Session annotations on the two sessions.
        await session.execute(
            insert(models.ProjectSessionAnnotation).values(
                project_session_id=session1_id,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="Session 1 correct",
                metadata_={},
                annotator_kind="HUMAN",
                source="API",
                identifier="test-identifier-1",
            )
        )
        await session.execute(
            insert(models.ProjectSessionAnnotation).values(
                project_session_id=session2_id,
                name="relevance",
                label="relevant",
                score=0.8,
                explanation="Session 2 relevant",
                metadata_={},
                annotator_kind="LLM",
                source="APP",
                identifier="test-identifier-2",
            )
        )

        await session.commit()


@pytest.fixture
async def two_projects_with_annotations_for_query(db: DbSessionFactory) -> None:
    """Two projects each carrying span/trace/session annotations sharing the
    same identifier value, used to verify that identifier filtering remains
    project-scoped (an identifier in project-A must not surface in project-B).
    """
    shared_identifier = "shared-identifier"
    async with db() as session:
        for label in ("A", "B"):
            project_rowid = await session.scalar(
                insert(models.Project).values(name=f"qproject-{label}").returning(models.Project.id)
            )
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=f"qtrace-{label}",
                    project_rowid=project_rowid,
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:01:00+00:00"),
                )
                .returning(models.Trace.id)
            )
            span_rowid = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_rowid,
                    span_id=f"qspan-{label}",
                    parent_id=None,
                    name=f"qspan-{label}",
                    span_kind="CHAIN",
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:00:30+00:00"),
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
            session_rowid = await session.scalar(
                insert(models.ProjectSession)
                .values(
                    session_id=f"qsession-{label}",
                    project_id=project_rowid,
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:01:00+00:00"),
                )
                .returning(models.ProjectSession.id)
            )
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=span_rowid,
                    name="tag",
                    label=None,
                    score=None,
                    explanation=f"span-anno-{label}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=shared_identifier,
                )
            )
            await session.execute(
                insert(models.TraceAnnotation).values(
                    trace_rowid=trace_rowid,
                    name="tag",
                    label=None,
                    score=None,
                    explanation=f"trace-anno-{label}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=shared_identifier,
                )
            )
            await session.execute(
                insert(models.ProjectSessionAnnotation).values(
                    project_session_id=session_rowid,
                    name="tag",
                    label=None,
                    score=None,
                    explanation=f"session-anno-{label}",
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=shared_identifier,
                )
            )
        await session.commit()


async def test_list_span_annotations_default_behavior(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations", params={"span_ids": ["span1", "span2"]}
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
        params={"span_ids": ["filtered-span"], "exclude_annotation_names": ["test-annotation"]},
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


# =============================================================================
# GET .../{kind}_annotations — identifier filter mode
# =============================================================================


async def test_list_span_annotations_by_identifier_only(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    """Identifier-only happy path returns only the matching span annotation."""
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={"identifier": "test-identifier-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["identifier"] == "test-identifier-1"
    assert data["data"][0]["name"] == "correctness"


async def test_list_trace_annotations_by_identifier_only(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/trace_annotations",
        params={"identifier": "test-identifier-2"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["identifier"] == "test-identifier-2"
    assert data["data"][0]["name"] == "relevance"


async def test_list_session_annotations_by_identifier_only(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    response = await httpx_client.get(
        "v1/projects/test-project/session_annotations",
        params={"identifier": "test-identifier-1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["identifier"] == "test-identifier-1"
    assert data["data"][0]["name"] == "correctness"


@pytest.mark.parametrize(
    "endpoint",
    ["span_annotations", "trace_annotations", "session_annotations"],
)
async def test_list_annotations_identifier_only_empty_returns_200(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
    endpoint: str,
) -> None:
    """D5: identifier-only mode with no matching rows returns 200 + [] (not 404)."""
    response = await httpx_client.get(
        f"v1/projects/test-project/{endpoint}",
        params={"identifier": "does-not-exist"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data == {"data": [], "next_cursor": None}


@pytest.mark.parametrize(
    "endpoint",
    ["span_annotations", "trace_annotations", "session_annotations"],
)
async def test_list_annotations_identifier_filter_is_project_scoped(
    httpx_client: httpx.AsyncClient,
    two_projects_with_annotations_for_query: Any,
    endpoint: str,
) -> None:
    """An identifier shared across two projects is returned only from the
    project specified in the path — project scoping via
    get_project_by_identifier is preserved.
    """
    response = await httpx_client.get(
        f"v1/projects/qproject-A/{endpoint}",
        params={"identifier": "shared-identifier"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["identifier"] == "shared-identifier"
    # The matching annotation's result.explanation labels the source project
    # so we can verify project-A's row was returned (not project-B's).
    assert "-A" in data["data"][0]["result"]["explanation"]


async def test_list_span_annotations_unknown_span_ids_only_still_404(
    httpx_client: httpx.AsyncClient,
    project_with_spans_and_annotations: Any,
) -> None:
    """D5: span_ids-only mode with no matching rows still 404s — preserves
    existing typoed-IDs behavior.
    """
    response = await httpx_client.get(
        "v1/projects/test-project/span_annotations",
        params={"span_ids": ["nonexistent-span"]},
    )
    assert response.status_code == 404


# =============================================================================
# DELETE /v1/projects/{project_identifier}/{kind}_annotations
# =============================================================================


@pytest.fixture
async def two_projects_with_annotations(db: DbSessionFactory) -> dict[str, Any]:
    """Build two projects (project-A, project-B), each with one trace, one
    span, one project_session, and matching span/trace/session annotations
    sharing the same `(name, identifier)` so we can verify that DELETE on
    project-A leaves project-B's matching rows intact.

    Identifier intentionally uses uppercase characters to confirm that DELETE
    accepts identifiers that the `Identifier` regex would reject — create
    accepts arbitrary strings, so delete must accept what create allowed.
    """
    name = "rollback-tag"
    identifier = "Agent-Run-1"  # uppercase — fails the Identifier regex
    state: dict[str, Any] = {"name": name, "identifier": identifier}
    async with db() as session:
        for label in ("A", "B"):
            project_rowid = await session.scalar(
                insert(models.Project).values(name=f"project-{label}").returning(models.Project.id)
            )
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=f"trace-{label}",
                    project_rowid=project_rowid,
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:01:00+00:00"),
                )
                .returning(models.Trace.id)
            )
            span_rowid = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_rowid,
                    span_id=f"span-{label}",
                    parent_id=None,
                    name=f"span-{label}",
                    span_kind="CHAIN",
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:00:30+00:00"),
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
            session_rowid = await session.scalar(
                insert(models.ProjectSession)
                .values(
                    session_id=f"session-{label}",
                    project_id=project_rowid,
                    start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                    end_time=datetime.fromisoformat("2024-01-01T00:01:00+00:00"),
                )
                .returning(models.ProjectSession.id)
            )
            await session.execute(
                insert(models.SpanAnnotation).values(
                    span_rowid=span_rowid,
                    name=name,
                    label=None,
                    score=None,
                    explanation=None,
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=identifier,
                )
            )
            await session.execute(
                insert(models.TraceAnnotation).values(
                    trace_rowid=trace_rowid,
                    name=name,
                    label=None,
                    score=None,
                    explanation=None,
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=identifier,
                )
            )
            await session.execute(
                insert(models.ProjectSessionAnnotation).values(
                    project_session_id=session_rowid,
                    name=name,
                    label=None,
                    score=None,
                    explanation=None,
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="API",
                    identifier=identifier,
                )
            )
        await session.commit()
    return state


async def _count(db: DbSessionFactory, model: Any, **filters: Any) -> int:
    async with db() as session:
        rows = (await session.scalars(select(model).filter_by(**filters))).all()
        return len(list(rows))


async def test_delete_span_annotations_happy_path(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    two_projects_with_annotations: dict[str, Any],
) -> None:
    """204 + matching row in project-A removed + project-B's matching row
    preserved + non-regex identifier accepted (project-scoped hard delete).
    Uses `delete_all=true` to authorize the non-time-bounded `name`/`identifier`
    delete under the new gate.
    """
    name = two_projects_with_annotations["name"]
    identifier = two_projects_with_annotations["identifier"]

    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/span_annotations",
        params={"name": name, "identifier": identifier, "delete_all": "true"},
    )
    assert response.status_code == 204

    remaining = await _count(db, models.SpanAnnotation, name=name, identifier=identifier)
    assert remaining == 1, "project-B's matching row must be preserved"


async def test_delete_trace_annotations_happy_path(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    two_projects_with_annotations: dict[str, Any],
) -> None:
    name = two_projects_with_annotations["name"]
    identifier = two_projects_with_annotations["identifier"]

    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/trace_annotations",
        params={"name": name, "identifier": identifier, "delete_all": "true"},
    )
    assert response.status_code == 204

    remaining = await _count(db, models.TraceAnnotation, name=name, identifier=identifier)
    assert remaining == 1


async def test_delete_session_annotations_happy_path(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    two_projects_with_annotations: dict[str, Any],
) -> None:
    name = two_projects_with_annotations["name"]
    identifier = two_projects_with_annotations["identifier"]

    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/session_annotations",
        params={"name": name, "identifier": identifier, "delete_all": "true"},
    )
    assert response.status_code == 204

    remaining = await _count(db, models.ProjectSessionAnnotation, name=name, identifier=identifier)
    assert remaining == 1


async def test_delete_annotations_idempotent_204(
    httpx_client: httpx.AsyncClient,
    two_projects_with_annotations: dict[str, Any],
) -> None:
    """Re-issuing the same DELETE on an empty matching set returns 204 (idempotent)."""
    name = two_projects_with_annotations["name"]
    identifier = two_projects_with_annotations["identifier"]

    first = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/span_annotations",
        params={"name": name, "identifier": identifier, "delete_all": "true"},
    )
    assert first.status_code == 204

    second = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/span_annotations",
        params={"name": name, "identifier": identifier, "delete_all": "true"},
    )
    assert second.status_code == 204


async def test_delete_annotations_unknown_project_404(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.request(
        "DELETE",
        "v1/projects/does-not-exist/span_annotations",
        params={"name": "anything", "identifier": "anything", "delete_all": "true"},
    )
    assert response.status_code == 404


_GATE_FAILURE_DETAIL = (
    "Delete is unbounded. Set delete_all=true to acknowledge, or "
    "supply both created_after and created_before to bound the time range."
)


@pytest.mark.parametrize(
    "params, expect_gate_message",
    [
        pytest.param({}, True, id="no-filter-rejected"),
        pytest.param({"name": ""}, False, id="empty-name-rejected"),
        pytest.param({"identifier": ""}, False, id="empty-identifier-rejected"),
        pytest.param(
            {"annotator_kind": "ROBOT"},
            False,
            id="unknown-annotator-kind-rejected",
        ),
        pytest.param(
            {"created_after": "not-a-date"},
            False,
            id="malformed-datetime-rejected",
        ),
        pytest.param(
            {
                "created_after": "2024-01-02T00:00:00+00:00",
                "created_before": "2024-01-01T00:00:00+00:00",
            },
            False,
            id="created-after-not-strictly-earlier-than-before",
        ),
        pytest.param(
            {
                "created_after": "2024-01-01T00:00:00+00:00",
                "created_before": "2024-01-01T00:00:00+00:00",
            },
            False,
            id="created-after-equal-to-before",
        ),
        # New gate cases: non-time filters and half-bounded ranges no longer
        # authorize the request without `delete_all=true`.
        pytest.param({"name": "anything"}, True, id="name-alone-fails-gate"),
        pytest.param(
            {"identifier": "anything"},
            True,
            id="identifier-alone-fails-gate",
        ),
        pytest.param(
            {"annotator_kind": "LLM"},
            True,
            id="annotator-kind-alone-fails-gate",
        ),
        pytest.param(
            {"created_after": "2024-01-01T00:00:00+00:00"},
            True,
            id="half-bounded-created-after-only-fails-gate",
        ),
        pytest.param(
            {"created_before": "2024-01-02T00:00:00+00:00"},
            True,
            id="half-bounded-created-before-only-fails-gate",
        ),
        pytest.param(
            {
                "name": "anything",
                "created_after": "2024-01-01T00:00:00+00:00",
            },
            True,
            id="name-plus-half-bounded-fails-gate",
        ),
        pytest.param(
            {"name": "anything", "delete_all": "false"},
            True,
            id="delete-all-false-equivalent-to-absent",
        ),
    ],
)
async def test_delete_annotations_rejects_invalid_filters_422(
    httpx_client: httpx.AsyncClient,
    params: dict[str, str],
    expect_gate_message: bool,
) -> None:
    """A request must satisfy the delete-bound gate (both `created_after` and
    `created_before` present, OR `delete_all=true`) and pass the per-field
    rules: `name`/`identifier` non-empty when supplied, `annotator_kind` a
    known value, datetimes ISO-8601-parseable, and `created_after` strictly
    earlier than `created_before` when both are present. Failures return 422.
    Gate failures specifically return the new D4 detail message naming both
    resolutions (set `delete_all=true` or supply both time bounds).
    """
    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-X/span_annotations",
        params=params,
    )
    assert response.status_code == 422
    if expect_gate_message:
        assert response.text == _GATE_FAILURE_DETAIL


async def test_delete_annotations_emits_dml_event(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    two_projects_with_annotations: dict[str, Any],
) -> None:
    """Emit *AnnotationDeleteEvent with deleted-row IDs on non-empty delete;
    do NOT emit when zero rows match. We verify the no-emit branch by issuing
    a delete that matches no rows and asserting the fixture rows are
    untouched. The on-emit branch is verified indirectly via the happy-path
    tests (DB rows physically removed implies the DELETE...RETURNING path
    ran) and the canonical DML event class names are asserted here as a
    guard against accidental rebinding.
    """
    # No-emit-on-zero-rows branch.
    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-A/span_annotations",
        params={
            "name": "no-such-name",
            "identifier": "no-such-identifier",
            "delete_all": "true",
        },
    )
    assert response.status_code == 204
    remaining = await _count(
        db,
        models.SpanAnnotation,
        name=two_projects_with_annotations["name"],
        identifier=two_projects_with_annotations["identifier"],
    )
    assert remaining == 2

    assert SpanAnnotationDeleteEvent.__name__ == "SpanAnnotationDeleteEvent"
    assert TraceAnnotationDeleteEvent.__name__ == "TraceAnnotationDeleteEvent"
    assert ProjectSessionAnnotationDeleteEvent.__name__ == "ProjectSessionAnnotationDeleteEvent"


# -----------------------------------------------------------------------------
# Auth helper unit test: non-admin narrows by user_id; admin/no-auth returns
# None. Tested directly because the unit suite's httpx_client runs with
# authentication_enabled=False and cannot exercise this branch via HTTP.
# -----------------------------------------------------------------------------


def _build_request(
    *,
    auth_enabled: bool,
    user: Any,
) -> Any:
    """Construct a minimal Request stand-in carrying the two attributes
    `_resolve_non_admin_user_id` reads.
    """
    request = MagicMock()
    request.app.state.authentication_enabled = auth_enabled
    request.user = user
    return request


@pytest.mark.parametrize(
    "auth_enabled, is_admin, identity, expected",
    [
        pytest.param(False, False, 42, None, id="auth-disabled-returns-none"),
        pytest.param(True, True, 42, None, id="admin-returns-none"),
        pytest.param(True, False, 42, 42, id="non-admin-returns-user-id"),
    ],
)
def test_resolve_non_admin_user_id(
    auth_enabled: bool,
    is_admin: bool,
    identity: int,
    expected: Any,
) -> None:
    user = MagicMock(spec=PhoenixUser)
    user.is_admin = is_admin
    user.identity = identity
    request = _build_request(auth_enabled=auth_enabled, user=user)
    assert _resolve_non_admin_user_id(request) == expected


def test_resolve_non_admin_user_id_non_phoenix_user_returns_none() -> None:
    """Defensive: a non-PhoenixUser caller (e.g. UnauthenticatedUser slipped
    past `is_authenticated`) returns None — the endpoint then deletes
    unconditionally, matching the no-auth code path. is_authenticated would
    normally reject this with 401 first.
    """
    request = _build_request(auth_enabled=True, user=object())
    assert _resolve_non_admin_user_id(request) is None


# -----------------------------------------------------------------------------
# Filter-combinator tests (Phase 2 — D7): per-filter narrowing, multi-filter
# AND, datetime-bound semantics, UTC normalization. One project, multiple
# span annotations engineered so each filter dimension picks out a known
# subset.
# -----------------------------------------------------------------------------


@pytest.fixture
async def project_with_filter_dimensions(db: DbSessionFactory) -> dict[str, Any]:
    """Build a single project with five span annotations engineered so each
    filter dimension picks out a known subset.

    Annotations (all under the same span in `project-F`):
      - row "a": name="alpha",   identifier="id-A", annotator_kind="HUMAN", created_at=2026-01-01T12:00Z
      - row "b": name="alpha",   identifier="id-B", annotator_kind="LLM",   created_at=2026-01-02T12:00Z
      - row "c": name="beta",    identifier="id-A", annotator_kind="LLM",   created_at=2026-01-03T12:00Z
      - row "d": name="gamma",   identifier="id-C", annotator_kind="CODE",  created_at=2026-01-04T12:00Z
      - row "e": name="note",    identifier="id-A", annotator_kind="HUMAN", created_at=2026-01-05T12:00Z

    Filter expectations (each a single-dimension query):
      - name="alpha"            → {a, b}
      - identifier="id-A"       → {a, c, e}
      - annotator_kind="LLM"    → {b, c}
      - created_after=2026-01-03T12:00Z (inclusive) → {c, d, e}
      - created_before=2026-01-03T12:00Z (exclusive) → {a, b}
    """
    rows: dict[str, dict[str, Any]] = {
        "a": {
            "name": "alpha",
            "identifier": "id-A",
            "annotator_kind": "HUMAN",
            "created_at": datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        },
        "b": {
            "name": "alpha",
            "identifier": "id-B",
            "annotator_kind": "LLM",
            "created_at": datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc),
        },
        "c": {
            "name": "beta",
            "identifier": "id-A",
            "annotator_kind": "LLM",
            "created_at": datetime(2026, 1, 3, 12, 0, tzinfo=timezone.utc),
        },
        "d": {
            "name": "gamma",
            "identifier": "id-C",
            "annotator_kind": "CODE",
            "created_at": datetime(2026, 1, 4, 12, 0, tzinfo=timezone.utc),
        },
        "e": {
            "name": "note",
            "identifier": "id-A",
            "annotator_kind": "HUMAN",
            "created_at": datetime(2026, 1, 5, 12, 0, tzinfo=timezone.utc),
        },
    }
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name="project-F").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace-F",
                project_rowid=project_rowid,
                start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
                end_time=datetime(2026, 1, 5, 23, 59, tzinfo=timezone.utc),
            )
            .returning(models.Trace.id)
        )
        span_rowid = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_rowid,
                span_id="span-F",
                parent_id=None,
                name="span-F",
                span_kind="CHAIN",
                start_time=datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc),
                end_time=datetime(2026, 1, 1, 0, 30, tzinfo=timezone.utc),
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
        for key, fields in rows.items():
            anno_id = await session.scalar(
                insert(models.SpanAnnotation)
                .values(
                    span_rowid=span_rowid,
                    name=fields["name"],
                    label=None,
                    score=None,
                    explanation=None,
                    metadata_={},
                    annotator_kind=fields["annotator_kind"],
                    source="API",
                    identifier=fields["identifier"],
                )
                .returning(models.SpanAnnotation.id)
            )
            # Force created_at to a deterministic value (the column is
            # populated server-side at insert; override it after the row
            # exists so each row has a known timestamp).
            await session.execute(
                update(models.SpanAnnotation)
                .where(models.SpanAnnotation.id == anno_id)
                .values(created_at=fields["created_at"])
            )
            rows[key]["id"] = anno_id
        await session.commit()
    return {"rows": rows, "project": "project-F"}


async def _surviving_keys(db: DbSessionFactory, rows: dict[str, dict[str, Any]]) -> set[str]:
    async with db() as session:
        ids = (await session.scalars(select(models.SpanAnnotation.id))).all()
    surviving = set(ids)
    return {key for key, fields in rows.items() if fields["id"] in surviving}


@pytest.mark.parametrize(
    "params, expected_deleted",
    [
        # Non-time and half-bounded filters require delete_all=true under
        # the new gate; fully bounded time-range cases pass on their own.
        pytest.param(
            {"name": "alpha", "delete_all": "true"},
            {"a", "b"},
            id="name-alone",
        ),
        pytest.param(
            {"identifier": "id-A", "delete_all": "true"},
            {"a", "c", "e"},
            id="identifier-alone",
        ),
        pytest.param(
            {"annotator_kind": "LLM", "delete_all": "true"},
            {"b", "c"},
            id="annotator-kind-alone",
        ),
        pytest.param(
            {
                "created_after": "2026-01-03T12:00:00+00:00",
                "delete_all": "true",
            },
            {"c", "d", "e"},
            id="created-after-inclusive",
        ),
        pytest.param(
            {
                "created_before": "2026-01-03T12:00:00+00:00",
                "delete_all": "true",
            },
            {"a", "b"},
            id="created-before-exclusive",
        ),
        pytest.param(
            {"name": "alpha", "annotator_kind": "LLM", "delete_all": "true"},
            {"b"},
            id="multi-filter-and-narrowing",
        ),
        pytest.param(
            {
                "created_after": "2026-01-02T00:00:00+00:00",
                "created_before": "2026-01-04T00:00:00+00:00",
            },
            {"b", "c"},
            id="created-after-and-before-bound-window",
        ),
        pytest.param(
            {"name": "no-such-name", "delete_all": "true"},
            set(),
            id="no-match-still-204-and-no-rows-deleted",
        ),
        # delete_all=true alone deletes every row in the project.
        pytest.param(
            {"delete_all": "true"},
            {"a", "b", "c", "d", "e"},
            id="delete-all-alone-deletes-everything-in-project",
        ),
        # delete_all=true combined with a name filter narrows to that name.
        pytest.param(
            {"delete_all": "true", "name": "alpha"},
            {"a", "b"},
            id="delete-all-plus-name-narrows-to-name",
        ),
        # Bounded time range AND delete_all=true together: gate satisfied
        # both ways; the time predicates still apply as filters.
        pytest.param(
            {
                "delete_all": "true",
                "created_after": "2026-01-02T00:00:00+00:00",
                "created_before": "2026-01-04T00:00:00+00:00",
            },
            {"b", "c"},
            id="both-gates-set-together",
        ),
    ],
)
async def test_delete_span_annotations_filter_combinators(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    project_with_filter_dimensions: dict[str, Any],
    params: dict[str, str],
    expected_deleted: set[str],
) -> None:
    rows = project_with_filter_dimensions["rows"]
    response = await httpx_client.request(
        "DELETE",
        f"v1/projects/{project_with_filter_dimensions['project']}/span_annotations",
        params=params,
    )
    assert response.status_code == 204
    surviving = await _surviving_keys(db, rows)
    assert surviving == set(rows) - expected_deleted


async def test_delete_span_annotations_utc_normalization_for_naive_datetime(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    project_with_filter_dimensions: dict[str, Any],
) -> None:
    """A naive datetime in the query string is interpreted as UTC. Row "c"
    has `created_at = 2026-01-03T12:00:00Z`. A `created_after=2026-01-03T12:00:00`
    query (no offset) must match it (inclusive lower bound, normalized to
    UTC).
    """
    rows = project_with_filter_dimensions["rows"]
    response = await httpx_client.request(
        "DELETE",
        f"v1/projects/{project_with_filter_dimensions['project']}/span_annotations",
        params={"created_after": "2026-01-03T12:00:00", "delete_all": "true"},
    )
    assert response.status_code == 204
    surviving = await _surviving_keys(db, rows)
    # Same as the explicit-UTC bound case: rows {c, d, e} deleted.
    assert surviving == {"a", "b"}
