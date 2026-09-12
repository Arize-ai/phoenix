from datetime import datetime
from typing import Any, Literal

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import insert, select
from starlette.types import ASGIApp, Receive, Scope, Send
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.bearer_auth import INTERNAL_PRINCIPAL_SCOPE_KEY, PhoenixUser
from phoenix.server.types import DbSessionFactory, UserClaimSet, UserId, UserTokenAttributes


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


async def test_delete_annotations_unknown_project_404(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.request(
        "DELETE",
        "v1/projects/does-not-exist/span_annotations",
        params={"name": "anything", "identifier": "anything", "delete_all": "true"},
    )
    assert response.status_code == 404


async def test_delete_annotations_without_bound_or_delete_all_returns_422(
    httpx_client: httpx.AsyncClient,
) -> None:
    """The destructive-delete gate: a request that is neither time-bounded
    (both `start_time` and `end_time`) nor authorized via
    `delete_all=true` must be rejected with 422 and a message naming both
    resolutions.
    """
    response = await httpx_client.request(
        "DELETE",
        "v1/projects/project-X/span_annotations",
        params={"name": "anything"},
    )
    assert response.status_code == 422
    assert response.text == (
        "Delete is unbounded. Set delete_all=true to acknowledge, or "
        "supply both start_time and end_time to bound the time range."
    )


# =============================================================================
# PATCH/DELETE /v1/{kind}_annotations/{annotation_id} — single annotation by GlobalID
# =============================================================================


_UserRole = Literal["SYSTEM", "ADMIN", "MEMBER", "VIEWER"]


async def _create_user(db: DbSessionFactory, *, role: _UserRole, username: str) -> int:
    async with db() as session:
        role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == role)
        )
        assert role_id is not None, f"Role {role} not seeded"
        user = models.User(
            user_role_id=role_id,
            username=username,
            email=f"{username}@example.com",
            password_hash=b"hash",
            password_salt=b"salt",
            reset_password=False,
            auth_method="LOCAL",
        )
        session.add(user)
        await session.flush()
        return user.id


@pytest.fixture
async def auth_app(db: DbSessionFactory) -> Any:
    """A FastAPI app built with `authentication_enabled=True` from the start.

    Role-gating dependencies (e.g. `restrict_access_by_viewers`) are wired
    onto the v1 router only when `authentication_enabled` is True *at router
    construction time* — flipping `app.state.authentication_enabled` after
    the fact (as the experiment-tag user-attribution tests do) does not
    retroactively add them. So role-based authorization tests need an app
    built with auth enabled from the start.
    """
    import contextlib

    from asgi_lifespan import LifespanManager
    from pydantic import SecretStr

    from phoenix.server.app import create_app
    from tests.unit.conftest import TestBulkInserter, patch_batched_caller, patch_grpc_server

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=db,
            authentication_enabled=True,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            secret=SecretStr("test-secret-at-least-32-chars-long!!"),
        )
        manager = await stack.enter_async_context(LifespanManager(app))
        yield app, manager.app


def _authenticated_client(
    asgi_app: ASGIApp,
    *,
    user_rowid: int,
    role: _UserRole,
) -> httpx.AsyncClient:
    """Build an httpx client that appears to FastAPI as an authenticated
    PhoenixUser with the given role.

    When the app is built with `authentication_enabled=True`, the real
    `BearerTokenAuthBackend` runs in the middleware stack and would overwrite
    a `scope["user"]` set here with an unauthenticated user (no bearer token
    is actually presented). Instead, seed the in-process dispatch scope key
    (`INTERNAL_PRINCIPAL_SCOPE_KEY`) that the backend checks first —
    the same mechanism the mounted MCP server uses to forward an
    already-authenticated principal back into `/v1` without replaying a
    token.
    """
    user_id = UserId(user_rowid)
    phoenix_user = PhoenixUser(
        user_id,
        UserClaimSet(
            subject=user_id,
            token_id="test-token",
            attributes=UserTokenAttributes(user_role=role),
        ),
    )

    async def _authenticated_app(scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            scope[INTERNAL_PRINCIPAL_SCOPE_KEY] = phoenix_user
        await asgi_app(scope, receive, send)

    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=_authenticated_app),
        base_url="http://test",
    )


@pytest.fixture
async def _owned_annotations(db: DbSessionFactory) -> dict[str, Any]:
    """One span, one trace, and one session, each carrying one annotation
    owned by `owner_user_id`. Used by the single-annotation PATCH/DELETE
    tests.
    """
    async with db() as session:
        role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        assert role_id is not None
        owner = models.User(
            user_role_id=role_id,
            username="annotation-owner",
            email="annotation-owner@example.com",
            password_hash=b"hash",
            password_salt=b"salt",
            reset_password=False,
            auth_method="LOCAL",
        )
        session.add(owner)
        await session.flush()
        owner_user_id = owner.id

        project_rowid = await session.scalar(
            insert(models.Project).values(name="byid-project").returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="byid-trace",
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
                span_id="byid-span",
                parent_id=None,
                name="byid-span",
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
                session_id="byid-session",
                project_id=project_rowid,
                start_time=datetime.fromisoformat("2024-01-01T00:00:00+00:00"),
                end_time=datetime.fromisoformat("2024-01-01T00:01:00+00:00"),
            )
            .returning(models.ProjectSession.id)
        )

        span_annotation_rowid = await session.scalar(
            insert(models.SpanAnnotation)
            .values(
                span_rowid=span_rowid,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="original span explanation",
                metadata_={"k": "v"},
                annotator_kind="HUMAN",
                source="APP",
                identifier="span-anno-1",
                user_id=owner_user_id,
            )
            .returning(models.SpanAnnotation.id)
        )
        trace_annotation_rowid = await session.scalar(
            insert(models.TraceAnnotation)
            .values(
                trace_rowid=trace_rowid,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="original trace explanation",
                metadata_={"k": "v"},
                annotator_kind="HUMAN",
                source="APP",
                identifier="trace-anno-1",
                user_id=owner_user_id,
            )
            .returning(models.TraceAnnotation.id)
        )
        session_annotation_rowid = await session.scalar(
            insert(models.ProjectSessionAnnotation)
            .values(
                project_session_id=session_rowid,
                name="correctness",
                label="correct",
                score=0.9,
                explanation="original session explanation",
                metadata_={"k": "v"},
                annotator_kind="HUMAN",
                source="APP",
                identifier="session-anno-1",
                user_id=owner_user_id,
            )
            .returning(models.ProjectSessionAnnotation.id)
        )
        await session.commit()

    return {
        "owner_user_id": owner_user_id,
        "span_annotation_gid": str(GlobalID("SpanAnnotation", str(span_annotation_rowid))),
        "trace_annotation_gid": str(GlobalID("TraceAnnotation", str(trace_annotation_rowid))),
        "session_annotation_gid": str(
            GlobalID("ProjectSessionAnnotation", str(session_annotation_rowid))
        ),
        "span_annotation_rowid": span_annotation_rowid,
        "trace_annotation_rowid": trace_annotation_rowid,
        "session_annotation_rowid": session_annotation_rowid,
    }


_ENDPOINT_BY_KIND: dict[str, tuple[str, Any]] = {
    "span": ("span_annotation_gid", models.SpanAnnotation),
    "trace": ("trace_annotation_gid", models.TraceAnnotation),
    "session": ("session_annotation_gid", models.ProjectSessionAnnotation),
}


def _url(kind: str, gid: str) -> str:
    return f"v1/{kind}_annotations/{gid}"


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_no_auth_succeeds(
    httpx_client: httpx.AsyncClient,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """When authentication is disabled, any caller may patch any annotation,
    and omitted fields are left unchanged (partial update)."""
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    response = await httpx_client.patch(_url(kind, gid), json={"label": "updated-label"})
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["result"]["label"] == "updated-label"
    # score/explanation were omitted, so they must be unchanged.
    assert data["result"]["score"] == 0.9
    assert data["result"]["explanation"] == f"original {kind} explanation"
    assert data["name"] == "correctness"
    assert data["metadata"] == {"k": "v"}


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_owner_can_update_own(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    _app, asgi_app = auth_app
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    owner_user_id = _owned_annotations["owner_user_id"]
    client = _authenticated_client(asgi_app, user_rowid=owner_user_id, role="MEMBER")
    try:
        response = await client.patch(_url(kind, gid), json={"label": "owner-updated"})
        assert response.status_code == 200, response.text
        assert response.json()["data"]["result"]["label"] == "owner-updated"
    finally:
        await client.aclose()


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_non_owner_member_forbidden(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """A non-admin caller who does not own the annotation is rejected with 403,
    and the annotation is left unmodified."""
    _app, asgi_app = auth_app
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]
    other_user_id = await _create_user(db, role="MEMBER", username=f"other-{kind}-patcher")
    client = _authenticated_client(asgi_app, user_rowid=other_user_id, role="MEMBER")
    try:
        response = await client.patch(_url(kind, gid), json={"label": "should-not-apply"})
        assert response.status_code == 403, response.text
    finally:
        await client.aclose()

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is not None
        assert row.label == "correct", "annotation must remain unmodified after a 403"


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_admin_can_update_any(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """An admin may update an annotation owned by a different user."""
    _app, asgi_app = auth_app
    gid_key, _ = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    admin_user_id = await _create_user(db, role="ADMIN", username=f"admin-{kind}-patcher")
    client = _authenticated_client(asgi_app, user_rowid=admin_user_id, role="ADMIN")
    try:
        response = await client.patch(_url(kind, gid), json={"label": "admin-updated"})
        assert response.status_code == 200, response.text
        assert response.json()["data"]["result"]["label"] == "admin-updated"
    finally:
        await client.aclose()


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_viewer_forbidden(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """Viewers (below MEMBER) cannot perform mutating requests at all,
    regardless of ownership — enforced by the router-level viewer restriction."""
    _app, asgi_app = auth_app
    gid_key, _ = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    owner_user_id = _owned_annotations["owner_user_id"]
    # Even the annotation's own owner is blocked if their role is VIEWER (a
    # role change scenario), since MEMBER+ is required for any write.
    client = _authenticated_client(asgi_app, user_rowid=owner_user_id, role="VIEWER")
    try:
        response = await client.patch(_url(kind, gid), json={"label": "viewer-should-fail"})
        assert response.status_code == 403, response.text
    finally:
        await client.aclose()


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_not_found(
    httpx_client: httpx.AsyncClient,
    kind: str,
) -> None:
    node_name = {
        "span": "SpanAnnotation",
        "trace": "TraceAnnotation",
        "session": "ProjectSessionAnnotation",
    }[kind]
    missing_gid = str(GlobalID(node_name, "999999"))
    response = await httpx_client.patch(_url(kind, missing_gid), json={"label": "x"})
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_invalid_id_returns_422(
    httpx_client: httpx.AsyncClient,
    kind: str,
) -> None:
    response = await httpx_client.patch(_url(kind, "not-a-valid-global-id"), json={"label": "x"})
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_patch_annotation_respects_is_not_locked(
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """PATCH must respect the storage-lock gate: when the DB reports
    `should_not_insert_or_update`, the request is rejected with 507 and the
    annotation is left unmodified."""
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]

    class _LockedDb:
        should_not_insert_or_update = True

    original_db = app.state.db
    app.state.db = _LockedDb()
    try:
        response = await httpx_client.patch(_url(kind, gid), json={"label": "locked-should-fail"})
        assert response.status_code == 507, response.text
    finally:
        app.state.db = original_db

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is not None
        assert row.label == "correct", "annotation must remain unmodified when locked"


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_no_auth_succeeds(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]
    response = await httpx_client.delete(_url(kind, gid))
    assert response.status_code == 204, response.text

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is None


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_non_owner_member_forbidden(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    _app, asgi_app = auth_app
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]
    other_user_id = await _create_user(db, role="MEMBER", username=f"other-{kind}-deleter")
    client = _authenticated_client(asgi_app, user_rowid=other_user_id, role="MEMBER")
    try:
        response = await client.delete(_url(kind, gid))
        assert response.status_code == 403, response.text
    finally:
        await client.aclose()

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is not None, "annotation must not be deleted after a 403"


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_admin_can_delete_any(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    _app, asgi_app = auth_app
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]
    admin_user_id = await _create_user(db, role="ADMIN", username=f"admin-{kind}-deleter")
    client = _authenticated_client(asgi_app, user_rowid=admin_user_id, role="ADMIN")
    try:
        response = await client.delete(_url(kind, gid))
        assert response.status_code == 204, response.text
    finally:
        await client.aclose()

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is None


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_viewer_forbidden(
    auth_app: Any,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    _app, asgi_app = auth_app
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]
    owner_user_id = _owned_annotations["owner_user_id"]
    client = _authenticated_client(asgi_app, user_rowid=owner_user_id, role="VIEWER")
    try:
        response = await client.delete(_url(kind, gid))
        assert response.status_code == 403, response.text
    finally:
        await client.aclose()

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is not None


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_not_found(
    httpx_client: httpx.AsyncClient,
    kind: str,
) -> None:
    node_name = {
        "span": "SpanAnnotation",
        "trace": "TraceAnnotation",
        "session": "ProjectSessionAnnotation",
    }[kind]
    missing_gid = str(GlobalID(node_name, "999999"))
    response = await httpx_client.delete(_url(kind, missing_gid))
    assert response.status_code == 404, response.text


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_invalid_id_returns_422(
    httpx_client: httpx.AsyncClient,
    kind: str,
) -> None:
    response = await httpx_client.delete(_url(kind, "not-a-valid-global-id"))
    assert response.status_code == 422, response.text


@pytest.mark.parametrize("kind", ["span", "trace", "session"])
async def test_delete_annotation_ignores_is_not_locked(
    app: FastAPI,
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    _owned_annotations: dict[str, Any],
    kind: str,
) -> None:
    """DELETE does NOT respect the storage-lock gate (unlike PATCH) — deletes
    remain available even when insertion/update is locked due to storage
    capacity."""
    gid_key, model = _ENDPOINT_BY_KIND[kind]
    gid = _owned_annotations[gid_key]
    rowid = _owned_annotations[f"{kind}_annotation_rowid"]

    original_db = app.state.db

    # Wrap the real db callable but report should_not_insert_or_update True,
    # while still delegating actual DB access to the real factory.
    class _LockedDbWrapper:
        should_not_insert_or_update = True

        def __call__(self, *args: Any, **kwargs: Any) -> Any:
            return original_db(*args, **kwargs)

    app.state.db = _LockedDbWrapper()
    try:
        response = await httpx_client.delete(_url(kind, gid))
        assert response.status_code == 204, response.text
    finally:
        app.state.db = original_db

    async with db() as session:
        row = await session.get(model, rowid)
        assert row is None
