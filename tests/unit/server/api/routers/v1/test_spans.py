from asyncio import sleep
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

import httpx
import pytest
from faker import Faker
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.routers.v1.spans import (
    OtlpAnyValue,
    OtlpSpan,
    OtlpStatus,
    Span,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize("sync", [False, True])
async def test_rest_span_annotation(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    sync: bool,
    fake: Faker,
) -> None:
    name = fake.pystr()
    request_body = {
        "data": [
            {
                "span_id": "7e2f08cb43bbf521",
                "name": name,
                "annotator_kind": "HUMAN",
                "result": {
                    "label": "True",
                    "score": 0.95,
                    "explanation": "This is a test annotation.",
                },
                "metadata": {},
            }
        ]
    }

    response = await httpx_client.post(f"v1/span_annotations?sync={sync}", json=request_body)
    assert response.status_code == 200
    if not sync:
        await sleep(0.1)
    async with db() as session:
        orm_annotation = await session.scalar(
            select(models.SpanAnnotation).where(models.SpanAnnotation.name == name)
        )

    assert orm_annotation is not None
    assert orm_annotation.name == name
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.label == "True"
    assert orm_annotation.score == 0.95
    assert orm_annotation.explanation == "This is a test annotation."
    assert orm_annotation.metadata_ == dict()


async def test_rest_create_span_note(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    """Test creating a span note via the REST API."""
    note_text = fake.pystr()
    request_body = {
        "data": {
            "span_id": "7e2f08cb43bbf521",
            "note": note_text,
        }
    }

    response = await httpx_client.post("v1/span_notes", json=request_body)
    assert response.status_code == 200

    # Verify the response contains the annotation ID
    response_data = response.json()
    assert "data" in response_data
    assert "id" in response_data["data"]

    # Verify the annotation was created correctly in the database
    async with db() as session:
        orm_annotation = await session.scalar(
            select(models.SpanAnnotation).where(
                models.SpanAnnotation.name == "note",
                models.SpanAnnotation.explanation == note_text,
            )
        )

    assert orm_annotation is not None
    assert orm_annotation.name == "note"
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.explanation == note_text
    assert orm_annotation.source == "API"
    assert orm_annotation.identifier.startswith("px-span-note:")
    assert orm_annotation.label is None
    assert orm_annotation.score is None
    assert orm_annotation.metadata_ == dict()


async def test_rest_create_span_note_not_found(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    """Test creating a span note for a non-existent span returns 404."""
    request_body = {
        "data": {
            "span_id": "nonexistent12345678",
            "note": "This should fail",
        }
    }

    response = await httpx_client.post("v1/span_notes", json=request_body)
    assert response.status_code == 404
    assert "not found" in response.text.lower()


async def test_rest_create_multiple_span_notes(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    """Test that multiple notes can be created for the same span."""
    note_texts = [fake.pystr() for _ in range(3)]

    for note_text in note_texts:
        request_body = {
            "data": {
                "span_id": "7e2f08cb43bbf521",
                "note": note_text,
            }
        }
        response = await httpx_client.post("v1/span_notes", json=request_body)
        assert response.status_code == 200

    # Verify all notes were created
    async with db() as session:
        result = await session.execute(
            select(models.SpanAnnotation).where(models.SpanAnnotation.name == "note")
        )
        annotations = list(result.scalars().all())

    assert len(annotations) == 3
    explanations = {a.explanation for a in annotations}
    assert explanations == set(note_texts)

    # Verify each annotation has a unique identifier
    identifiers = [a.identifier for a in annotations]
    assert len(identifiers) == len(set(identifiers))  # All unique


@pytest.fixture
def span_factory() -> Callable[..., models.Span]:
    """Factory for creating spans with sensible defaults."""

    def _create_span(
        trace_rowid: int,
        span_id: str,
        parent_id: Optional[str] = None,
        name: Optional[str] = None,
        **overrides: Any,
    ) -> models.Span:
        defaults = {
            "span_kind": "INTERNAL",
            "start_time": datetime.now(),
            "end_time": datetime.now(),
            "attributes": {},
            "events": [],
            "status_code": "OK",
            "status_message": "",
            "cumulative_error_count": 0,
            "cumulative_llm_token_count_prompt": 0,
            "cumulative_llm_token_count_completion": 0,
        }
        defaults.update(overrides)
        return models.Span(
            trace_rowid=trace_rowid,
            span_id=span_id,
            parent_id=parent_id,
            name=name or span_id.replace("-", " ").title(),
            **defaults,
        )

    return _create_span


@pytest.fixture
async def span_hierarchy(
    db: DbSessionFactory,
    project_with_a_single_trace_and_span: None,
    span_factory: Callable[..., models.Span],
) -> dict[str, Any]:
    """Creates a span hierarchy for testing subtree deletion."""
    async with db() as session:
        project = await session.scalar(select(models.Project))
        assert project is not None
        trace = await session.scalar(
            select(models.Trace).where(models.Trace.project_rowid == project.id)
        )
        assert trace is not None

        # Create the hierarchy: parent -> children -> grandchild + sibling
        parent = span_factory(trace.id, "parent-span")
        child1 = span_factory(trace.id, "child-1", "parent-span")
        child2 = span_factory(trace.id, "child-2", "parent-span")
        grandchild = span_factory(trace.id, "grandchild-1", "child-1")
        sibling = span_factory(trace.id, "sibling-span")  # No parent = root level

        session.add_all([parent, child1, child2, grandchild, sibling])
        await session.commit()

        return {
            "project": project,
            "trace": trace,
            "parent": parent,
            "child1": child1,
            "child2": child2,
            "grandchild": grandchild,
            "sibling": sibling,
        }


async def test_delete_single_span_leave_descendants(
    httpx_client: httpx.AsyncClient,
    span_hierarchy: dict[str, Any],
    db: DbSessionFactory,
) -> None:
    """Test that deleting a span only deletes the target span and leaves descendants alone."""
    hierarchy = span_hierarchy

    # Delete the parent span (should only delete the parent, leave descendants)
    response = await httpx_client.delete("v1/spans/parent-span")
    assert response.status_code == 204

    # Verify only the target span was deleted
    async with db() as session:
        # Parent should be deleted
        assert (
            await session.scalar(
                select(models.Span).where(models.Span.id == hierarchy["parent"].id)
            )
            is None
        )

        # All descendants should still exist (left alone)
        remaining_child1 = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["child1"].id)
        )
        assert remaining_child1 is not None
        assert remaining_child1.span_id == "child-1"

        remaining_child2 = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["child2"].id)
        )
        assert remaining_child2 is not None
        assert remaining_child2.span_id == "child-2"

        remaining_grandchild = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["grandchild"].id)
        )
        assert remaining_grandchild is not None
        assert remaining_grandchild.span_id == "grandchild-1"

        # Sibling should still exist (unaffected)
        remaining_sibling = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["sibling"].id)
        )
        assert remaining_sibling is not None
        assert remaining_sibling.span_id == "sibling-span"


async def test_delete_span_empty_trace_cleanup(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    project_with_a_single_trace_and_span: None,
) -> None:
    """Test that deleting the last span in a trace also deletes the trace."""
    async with db() as session:
        project = await session.scalar(select(models.Project))
        assert project is not None

        # Get initial trace count
        initial_trace_count = await session.scalar(
            select(models.Trace).where(models.Trace.project_rowid == project.id)
        )
        assert initial_trace_count is not None

    # Delete the only span in the trace
    response = await httpx_client.delete("v1/spans/7e2f08cb43bbf521")
    assert response.status_code == 204

    # Verify both span and trace are deleted
    async with db() as session:
        # Span should be deleted
        remaining_span = await session.scalar(
            select(models.Span).where(models.Span.span_id == "7e2f08cb43bbf521")
        )
        assert remaining_span is None

        # Trace should also be deleted (was empty after span deletion)
        remaining_trace = await session.scalar(
            select(models.Trace).where(models.Trace.project_rowid == project.id)
        )
        assert remaining_trace is None


async def test_delete_span_with_global_id(
    httpx_client: httpx.AsyncClient,
    span_hierarchy: dict[str, Any],
    db: DbSessionFactory,
) -> None:
    """Test that deleting a span works with relay GlobalID identifier."""
    hierarchy = span_hierarchy

    # Use GlobalID instead of OpenTelemetry span_id
    child1_global_id = str(GlobalID("Span", str(hierarchy["child1"].id)))

    # Delete using GlobalID
    response = await httpx_client.delete(f"v1/spans/{child1_global_id}")
    assert response.status_code == 204

    # Verify child1 was deleted but others remain
    async with db() as session:
        # child1 should be deleted
        assert (
            await session.scalar(
                select(models.Span).where(models.Span.id == hierarchy["child1"].id)
            )
            is None
        )

        # Parent should still exist
        remaining_parent = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["parent"].id)
        )
        assert remaining_parent is not None

        # Grandchild should still exist (even though its parent was deleted)
        remaining_grandchild = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["grandchild"].id)
        )
        assert remaining_grandchild is not None


@pytest.fixture
async def span_hierarchy_with_metrics(
    db: DbSessionFactory,
    project_with_a_single_trace_and_span: None,
    span_factory: Callable[..., models.Span],
) -> dict[str, Any]:
    """Creates a span hierarchy with cumulative metrics for testing propagation."""
    async with db() as session:
        project = await session.scalar(select(models.Project))
        assert project is not None
        trace = await session.scalar(
            select(models.Trace).where(models.Trace.project_rowid == project.id)
        )
        assert trace is not None

        # Delete the existing span to start fresh
        from sqlalchemy import delete

        await session.execute(delete(models.Span).where(models.Span.trace_rowid == trace.id))

        # Create hierarchy with specific cumulative metrics:
        # root (errors: 10, prompt: 100, completion: 200)
        #   └── child (errors: 5, prompt: 50, completion: 100)
        #       └── grandchild (errors: 2, prompt: 20, completion: 40)

        # Grandchild (leaf node - no descendants)
        grandchild = span_factory(
            trace.id,
            "grandchild-span",
            "child-span",
            cumulative_error_count=2,
            cumulative_llm_token_count_prompt=20,
            cumulative_llm_token_count_completion=40,
        )

        # Child includes its own values + grandchild's cumulative values
        child = span_factory(
            trace.id,
            "child-span",
            "root-span",
            cumulative_error_count=5,  # 3 own + 2 from grandchild
            cumulative_llm_token_count_prompt=50,  # 30 own + 20 from grandchild
            cumulative_llm_token_count_completion=100,  # 60 own + 40 from grandchild
        )

        # Root includes its own values + all descendants' cumulative values
        root = span_factory(
            trace.id,
            "root-span",
            None,  # No parent
            cumulative_error_count=10,  # 5 own + 5 from child (which includes grandchild)
            cumulative_llm_token_count_prompt=100,  # 50 own + 50 from child (which includes grandchild)
            cumulative_llm_token_count_completion=200,  # 100 own + 100 from child (which includes grandchild)
        )

        session.add_all([grandchild, child, root])
        await session.commit()

        return {
            "project": project,
            "trace": trace,
            "root": root,
            "child": child,
            "grandchild": grandchild,
        }


async def test_delete_span_cumulative_metrics_propagation(
    httpx_client: httpx.AsyncClient,
    span_hierarchy_with_metrics: dict[str, Any],
    db: DbSessionFactory,
) -> None:
    """Test that cumulative metrics are properly updated when deleting a span with a parent."""
    hierarchy = span_hierarchy_with_metrics

    # Get initial metrics for root span
    async with db() as session:
        initial_root = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["root"].id)
        )
        assert initial_root is not None
        initial_root_errors = initial_root.cumulative_error_count
        initial_root_prompt = initial_root.cumulative_llm_token_count_prompt
        initial_root_completion = initial_root.cumulative_llm_token_count_completion

    # Delete child span (should subtract child's cumulative values from root)
    child_errors = hierarchy["child"].cumulative_error_count
    child_prompt = hierarchy["child"].cumulative_llm_token_count_prompt
    child_completion = hierarchy["child"].cumulative_llm_token_count_completion

    response = await httpx_client.delete("v1/spans/child-span")
    assert response.status_code == 204

    # Verify metrics propagation
    async with db() as session:
        # Child should be deleted
        remaining_child = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["child"].id)
        )
        assert remaining_child is None

        # Root metrics should be reduced by child's cumulative values
        updated_root = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["root"].id)
        )
        assert updated_root is not None

        expected_root_errors = initial_root_errors - child_errors
        expected_root_prompt = initial_root_prompt - child_prompt
        expected_root_completion = initial_root_completion - child_completion

        assert updated_root.cumulative_error_count == expected_root_errors
        assert updated_root.cumulative_llm_token_count_prompt == expected_root_prompt
        assert updated_root.cumulative_llm_token_count_completion == expected_root_completion

        # Grandchild should still exist (orphaned but not deleted)
        remaining_grandchild = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["grandchild"].id)
        )
        assert remaining_grandchild is not None
        # Grandchild metrics should be unchanged
        assert remaining_grandchild.cumulative_error_count == 2
        assert remaining_grandchild.cumulative_llm_token_count_prompt == 20
        assert remaining_grandchild.cumulative_llm_token_count_completion == 40


async def test_delete_span_no_metrics_propagation_when_no_parent(
    httpx_client: httpx.AsyncClient,
    span_hierarchy_with_metrics: dict[str, Any],
    db: DbSessionFactory,
) -> None:
    """Test that no metrics propagation occurs when deleting a root span (no parent)."""
    hierarchy = span_hierarchy_with_metrics

    # Delete root span (no parent, so no propagation should occur)
    response = await httpx_client.delete("v1/spans/root-span")
    assert response.status_code == 204

    # Verify root is deleted and children remain with unchanged metrics
    async with db() as session:
        # Root should be deleted
        remaining_root = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["root"].id)
        )
        assert remaining_root is None

        # Child and grandchild should still exist with original metrics
        remaining_child = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["child"].id)
        )
        assert remaining_child is not None
        assert remaining_child.cumulative_error_count == 5
        assert remaining_child.cumulative_llm_token_count_prompt == 50
        assert remaining_child.cumulative_llm_token_count_completion == 100

        remaining_grandchild = await session.scalar(
            select(models.Span).where(models.Span.id == hierarchy["grandchild"].id)
        )
        assert remaining_grandchild is not None
        assert remaining_grandchild.cumulative_error_count == 2
        assert remaining_grandchild.cumulative_llm_token_count_prompt == 20
        assert remaining_grandchild.cumulative_llm_token_count_completion == 40


async def test_delete_span_not_found(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: None,
) -> None:
    # Try to delete a non-existent span
    async with db() as session:
        project = await session.scalar(select(models.Project))
        assert project is not None
        project_identifier = str(GlobalID("Project", str(project.id)))

    response = await httpx_client.delete(
        f"v1/projects/{project_identifier}/spans/non-existent-span"
    )
    assert response.status_code == 404
    assert "not found" in response.text.lower()


@pytest.fixture
async def project_with_a_single_trace_and_span(
    db: DbSessionFactory,
) -> None:
    """
    Contains a project with a single trace and a single span.
    """
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="project-name").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="649993371fa95c788177f739b7423818",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        await session.execute(
            insert(models.Span)
            .values(
                trace_rowid=trace_id,
                span_id="7e2f08cb43bbf521",
                parent_id=None,
                name="chain span",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "input": {"value": "chain-span-input-value", "mime_type": "text/plain"},
                    "output": {"value": "chain-span-output-value", "mime_type": "text/plain"},
                },
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )


@pytest.fixture
async def project_with_a_single_trace_and_span_with_events(
    project_with_a_single_trace_and_span: None,
    db: DbSessionFactory,
) -> None:
    """
    Contains a project with a single trace and a single span that has events.
    """
    async with db() as session:
        span = await session.scalar(
            select(models.Span).where(models.Span.span_id == "7e2f08cb43bbf521")
        )
        assert span is not None
        assert span.events is not None
        span.events = [
            {
                "name": "test_event",
                "timestamp": "2021-01-01T00:00:15.000000+00:00",
                "attributes": {
                    "string_attr": "test_value",
                    "bool_attr": True,
                    "int_attr": 42,
                    "float_attr": 3.14,
                },
            }
        ]
        await session.commit()


@pytest.fixture
async def span_search_test_data(db: DbSessionFactory) -> None:
    """Insert three spans with different times for filter tests."""

    async with db() as session:
        project = models.Project(name="search-test")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            project_rowid=project.id,
            trace_id="abcd1234",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00+00:00"),
        )
        session.add(trace)
        await session.flush()

        # 3 spans 1 minute apart
        spans: list[models.Span] = []
        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        for i in range(3):
            span = models.Span(
                trace_rowid=trace.id,
                span_id=f"span{i}",
                parent_id=None,
                name=f"span-{i}",
                span_kind="CHAIN",
                start_time=base_time + timedelta(minutes=i),
                end_time=base_time + timedelta(minutes=i, seconds=30),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            session.add(span)
            spans.append(span)
        await session.flush()


@pytest.fixture
async def project_with_nested_attributes(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="nested-attrs").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="nested123",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )
        await session.execute(
            insert(models.Span).values(
                trace_rowid=trace_id,
                span_id="6e657374656473706e",  # hex-encoded "nestedspn" -> base64 compatible
                parent_id=None,
                name="nested span",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={
                    "simple": "value",
                    "nested": {"key": "nested_value", "deep": {"deeper": "deepest"}},
                    "array": [1, 2, 3],
                    "mixed": {"numbers": [10, 20], "text": "hello"},
                    "openinference": {"span": {"kind": "LLM"}},
                },
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )


async def test_otlp_span_search_basic(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp = await httpx_client.get("v1/projects/search-test/spans/otlpv1")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 3
    # Verify the spans have the expected structure
    for span in spans:
        assert isinstance(span.span_id, str)
        assert isinstance(span.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time_unix_nano, (int, str))
        assert isinstance(span.end_time_unix_nano, (int, str))
        assert isinstance(span.attributes, (list, type(None)))
        assert isinstance(span.status, (OtlpStatus, type(None)))
        if span.status is not None:
            assert isinstance(span.status.code, int)
            assert span.status.code in (0, 1, 2)  # Valid OTLP status codes


async def test_otlp_span_search_time_slice(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    start = "2021-01-01T00:01:00+00:00"
    end = "2021-01-01T00:03:00+00:00"
    resp = await httpx_client.get(
        "v1/projects/search-test/spans/otlpv1",
        params={"start_time": start, "end_time": end},
    )
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    # spans 1 and 2 fall in range
    assert len(spans) == 2
    # Verify the spans have the expected structure
    for span in spans:
        assert isinstance(span.span_id, str)
        assert isinstance(span.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time_unix_nano, (int, str))
        assert isinstance(span.end_time_unix_nano, (int, str))
        assert isinstance(span.attributes, (list, type(None)))
        assert isinstance(span.status, (OtlpStatus, type(None)))
        if span.status is not None:
            assert isinstance(span.status.code, int)
            assert span.status.code in (0, 1, 2)  # Valid OTLP status codes


async def test_otlp_span_search_pagination(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp1 = await httpx_client.get(
        "v1/projects/search-test/spans/otlpv1",
        params={"limit": 2},
    )
    assert resp1.is_success
    body1 = resp1.json()
    spans1 = [OtlpSpan.model_validate(s) for s in body1["data"]]
    assert len(spans1) == 2 and body1["next_cursor"]

    cursor = body1["next_cursor"]
    # Second page
    resp2 = await httpx_client.get(
        "v1/projects/search-test/spans/otlpv1",
        params={"cursor": cursor},
    )
    assert resp2.is_success
    body2 = resp2.json()
    spans2 = [OtlpSpan.model_validate(s) for s in body2["data"]]
    assert len(spans2) == 1 and body2["next_cursor"] is None

    # Verify the spans have the expected structure
    for spans in [spans1, spans2]:
        for span in spans:
            assert isinstance(span.span_id, str)
            assert isinstance(span.trace_id, str)
            assert isinstance(span.name, str)
            assert isinstance(span.start_time_unix_nano, (int, str))
            assert isinstance(span.end_time_unix_nano, (int, str))
            assert isinstance(span.attributes, (list, type(None)))
            assert isinstance(span.status, (OtlpStatus, type(None)))
            if span.status is not None:
                assert isinstance(span.status.code, int)
                assert span.status.code in (0, 1, 2)  # Valid OTLP status codes


async def test_otlp_span_attributes_conversion(
    httpx_client: httpx.AsyncClient, project_with_a_single_trace_and_span: None
) -> None:
    """Test that span attributes are properly converted to OTLP format."""
    resp = await httpx_client.get("v1/projects/project-name/spans/otlpv1")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.attributes is not None
    # Find the input and output attributes
    input_attr = next((attr for attr in span.attributes if attr.key == "input.value"), None)
    output_attr = next((attr for attr in span.attributes if attr.key == "output.value"), None)

    assert input_attr is not None
    assert output_attr is not None

    # Verify the input attribute value
    assert input_attr.value is not None
    assert isinstance(input_attr.value, OtlpAnyValue)
    assert input_attr.value.string_value == "chain-span-input-value"

    # Verify the output attribute value
    assert output_attr.value is not None
    assert isinstance(output_attr.value, OtlpAnyValue)
    assert output_attr.value.string_value == "chain-span-output-value"


async def test_otlp_span_events_conversion(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span_with_events: None,
) -> None:
    """Test that span events are properly converted to OTLP format."""
    resp = await httpx_client.get("v1/projects/project-name/spans/otlpv1")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.events is not None
    assert len(span.events) == 1

    event = span.events[0]
    assert event.name == "test_event"
    assert event.time_unix_nano == 1609459215000000000
    assert event.attributes is not None
    assert len(event.attributes) == 4

    string_attr = next((attr for attr in event.attributes if attr.key == "string_attr"), None)
    assert string_attr is not None
    assert string_attr.value is not None
    assert string_attr.value.string_value == "test_value"

    bool_attr = next((attr for attr in event.attributes if attr.key == "bool_attr"), None)
    assert bool_attr is not None
    assert bool_attr.value is not None
    assert bool_attr.value.bool_value is True

    int_attr = next((attr for attr in event.attributes if attr.key == "int_attr"), None)
    assert int_attr is not None
    assert int_attr.value is not None
    assert int_attr.value.int_value == 42

    float_attr = next((attr for attr in event.attributes if attr.key == "float_attr"), None)
    assert float_attr is not None
    assert float_attr.value is not None
    assert float_attr.value.double_value == 3.14


async def test_otlp_attribute_flattening(
    httpx_client: httpx.AsyncClient, project_with_nested_attributes: None
) -> None:
    resp = await httpx_client.get("v1/projects/nested-attrs/spans/otlpv1")
    assert resp.is_success
    data = resp.json()
    spans = [OtlpSpan.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.attributes is not None
    attr_dict = {attr.key: attr.value for attr in span.attributes}

    assert "simple" in attr_dict
    assert "nested.key" in attr_dict
    assert "nested.deep.deeper" in attr_dict
    assert "mixed.text" in attr_dict

    assert "array" in attr_dict
    assert "mixed.numbers" in attr_dict

    assert attr_dict["simple"] is not None
    assert attr_dict["simple"].string_value == "value"
    assert attr_dict["nested.key"] is not None
    assert attr_dict["nested.key"].string_value == "nested_value"
    assert attr_dict["nested.deep.deeper"] is not None
    assert attr_dict["nested.deep.deeper"].string_value == "deepest"
    assert attr_dict["mixed.text"] is not None
    assert attr_dict["mixed.text"].string_value == "hello"

    assert attr_dict["array"] is not None
    assert attr_dict["array"].array_value is not None
    assert attr_dict["array"].array_value.values is not None
    assert len(attr_dict["array"].array_value.values) == 3
    assert attr_dict["array"].array_value.values[0].int_value == 1
    assert attr_dict["array"].array_value.values[1].int_value == 2
    assert attr_dict["array"].array_value.values[2].int_value == 3

    assert attr_dict["mixed.numbers"] is not None
    assert attr_dict["mixed.numbers"].array_value is not None
    assert attr_dict["mixed.numbers"].array_value.values is not None
    assert len(attr_dict["mixed.numbers"].array_value.values) == 2
    assert attr_dict["mixed.numbers"].array_value.values[0].int_value == 10
    assert attr_dict["mixed.numbers"].array_value.values[1].int_value == 20


async def test_span_search_basic(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp = await httpx_client.get("v1/projects/search-test/spans")
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 3
    for span in spans:
        assert isinstance(span.id, str)
        assert isinstance(span.context.span_id, str)
        assert isinstance(span.context.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time, datetime)
        assert isinstance(span.end_time, datetime)
        assert isinstance(span.attributes, dict)
        assert isinstance(span.status_code, str)


async def test_span_search_time_slice(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    start = "2021-01-01T00:01:00+00:00"
    end = "2021-01-01T00:03:00+00:00"
    resp = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"start_time": start, "end_time": end},
    )
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 2
    for span in spans:
        assert isinstance(span.id, str)
        assert isinstance(span.context.span_id, str)
        assert isinstance(span.context.trace_id, str)
        assert isinstance(span.name, str)
        assert isinstance(span.start_time, datetime)
        assert isinstance(span.end_time, datetime)
        assert isinstance(span.attributes, dict)
        assert isinstance(span.status_code, str)


async def test_span_search_sort_direction(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp_desc = await httpx_client.get("v1/projects/search-test/spans")

    assert resp_desc.is_success
    spans_desc = [Span.model_validate(s) for s in resp_desc.json()["data"]]
    assert len(spans_desc) == 3


async def test_span_search_pagination(
    httpx_client: httpx.AsyncClient, span_search_test_data: None
) -> None:
    resp1 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"limit": 2},
    )
    assert resp1.is_success
    body1 = resp1.json()
    spans1 = [Span.model_validate(s) for s in body1["data"]]
    assert len(spans1) == 2 and body1["next_cursor"]

    cursor = body1["next_cursor"]
    resp2 = await httpx_client.get(
        "v1/projects/search-test/spans",
        params={"cursor": cursor},
    )
    assert resp2.is_success
    body2 = resp2.json()
    spans2 = [Span.model_validate(s) for s in body2["data"]]
    assert len(spans2) == 1 and body2["next_cursor"] is None

    for spans in [spans1, spans2]:
        for span in spans:
            assert isinstance(span.id, str)
            assert isinstance(span.context.span_id, str)
            assert isinstance(span.context.trace_id, str)
            assert isinstance(span.name, str)
            assert isinstance(span.start_time, datetime)
            assert isinstance(span.end_time, datetime)
            assert isinstance(span.attributes, dict)
            assert isinstance(span.status_code, str)


async def test_span_attributes_conversion(
    httpx_client: httpx.AsyncClient, project_with_a_single_trace_and_span: None
) -> None:
    resp = await httpx_client.get("v1/projects/project-name/spans")
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert "input.value" in span.attributes
    assert "output.value" in span.attributes
    assert span.attributes["input.value"] == "chain-span-input-value"
    assert span.attributes["output.value"] == "chain-span-output-value"


async def test_span_events_conversion(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span_with_events: None,
) -> None:
    resp = await httpx_client.get("v1/projects/project-name/spans")
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert len(span.events) == 1

    event = span.events[0]
    assert event.name == "test_event"
    assert isinstance(event.timestamp, datetime)
    assert event.attributes["string_attr"] == "test_value"
    assert event.attributes["bool_attr"] is True
    assert event.attributes["int_attr"] == 42
    assert event.attributes["float_attr"] == 3.14


async def test_phoenix_attribute_flattening(
    httpx_client: httpx.AsyncClient, project_with_nested_attributes: None
) -> None:
    resp = await httpx_client.get("v1/projects/nested-attrs/spans")
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]

    assert "simple" in span.attributes
    assert "nested.key" in span.attributes
    assert "nested.deep.deeper" in span.attributes
    assert "mixed.text" in span.attributes

    assert "array" in span.attributes
    assert "mixed.numbers" in span.attributes

    # Verify values
    assert span.attributes["simple"] == "value"
    assert span.attributes["nested.key"] == "nested_value"
    assert span.attributes["nested.deep.deeper"] == "deepest"
    assert span.attributes["mixed.text"] == "hello"

    assert span.attributes["array"] == [1, 2, 3]
    assert span.attributes["mixed.numbers"] == [10, 20]


async def test_phoenix_openinference_span_kind_extraction(
    httpx_client: httpx.AsyncClient, project_with_nested_attributes: None
) -> None:
    resp = await httpx_client.get("v1/projects/nested-attrs/spans")
    assert resp.is_success
    data = resp.json()
    spans = [Span.model_validate(s) for s in data["data"]]
    assert len(spans) == 1

    span = spans[0]
    assert span.span_kind == "LLM"
    assert "openinference.span.kind" not in span.attributes


@pytest.fixture
async def multi_trace_project(db: DbSessionFactory) -> None:
    """Insert a project with two traces, each containing spans."""
    async with db() as session:
        project = models.Project(name="multi-trace")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")

        trace_a = models.Trace(
            project_rowid=project.id,
            trace_id="traceaaa00000000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=1),
        )
        trace_b = models.Trace(
            project_rowid=project.id,
            trace_id="tracebbb00000000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=1),
        )
        session.add_all([trace_a, trace_b])
        await session.flush()

        span_ids = [
            ["aaa00000", "aaa00001"],
            ["bbb00000", "bbb00001"],
        ]
        for i, trace in enumerate([trace_a, trace_b]):
            for j in range(2):
                session.add(
                    models.Span(
                        trace_rowid=trace.id,
                        span_id=span_ids[i][j],
                        parent_id=None,
                        name=f"span-t{i}-{j}",
                        span_kind="CHAIN",
                        start_time=base_time + timedelta(minutes=j),
                        end_time=base_time + timedelta(minutes=j, seconds=30),
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    )
                )
        await session.flush()


async def test_span_search_filter_by_single_trace_id(
    httpx_client: httpx.AsyncClient, multi_trace_project: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/multi-trace/spans",
        params={"trace_id": "traceaaa00000000"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 2
    assert all(s.context.trace_id == "traceaaa00000000" for s in spans)


async def test_span_search_filter_by_multiple_trace_ids(
    httpx_client: httpx.AsyncClient, multi_trace_project: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/multi-trace/spans",
        params=[("trace_id", "traceaaa00000000"), ("trace_id", "tracebbb00000000")],
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 4


async def test_span_search_filter_by_nonexistent_trace_id(
    httpx_client: httpx.AsyncClient, multi_trace_project: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/multi-trace/spans",
        params={"trace_id": "does-not-exist"},
    )
    assert resp.is_success
    assert resp.json()["data"] == []


async def test_otlp_span_search_filter_by_single_trace_id(
    httpx_client: httpx.AsyncClient, multi_trace_project: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/multi-trace/spans/otlpv1",
        params={"trace_id": "tracebbb00000000"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 2
    assert all(s.trace_id == "tracebbb00000000" for s in spans)


async def test_otlp_span_search_filter_by_multiple_trace_ids(
    httpx_client: httpx.AsyncClient, multi_trace_project: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/multi-trace/spans/otlpv1",
        params=[("trace_id", "traceaaa00000000"), ("trace_id", "tracebbb00000000")],
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 4


@pytest.fixture
async def project_with_parent_spans(db: DbSessionFactory) -> None:
    """Insert a project with a root span and a child span."""
    async with db() as session:
        project = models.Project(name="parent-spans")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="traceparenttest0",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=2),
        )
        session.add(trace)
        await session.flush()

        # Root span (no parent)
        session.add(
            models.Span(
                trace_rowid=trace.id,
                span_id="rootspan0",
                parent_id=None,
                name="root-span",
                span_kind="CHAIN",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=1),
                attributes={"input": {"value": "hello"}},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )
        # Child span
        session.add(
            models.Span(
                trace_rowid=trace.id,
                span_id="childspan",
                parent_id="rootspan0",
                name="child-span",
                span_kind="LLM",
                start_time=base_time + timedelta(seconds=10),
                end_time=base_time + timedelta(seconds=50),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )
        await session.flush()


async def test_span_search_filter_by_parent_id_null(
    httpx_client: httpx.AsyncClient, project_with_parent_spans: None
) -> None:
    """parent_id=null returns only root spans."""
    resp = await httpx_client.get(
        "v1/projects/parent-spans/spans",
        params={"parent_id": "null"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "root-span"
    assert spans[0].parent_id is None


async def test_span_search_filter_by_parent_id_specific(
    httpx_client: httpx.AsyncClient, project_with_parent_spans: None
) -> None:
    """parent_id=<id> returns children of that span."""
    resp = await httpx_client.get(
        "v1/projects/parent-spans/spans",
        params={"parent_id": "rootspan0"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "child-span"
    assert spans[0].parent_id == "rootspan0"


async def test_span_search_no_parent_id_filter(
    httpx_client: httpx.AsyncClient, project_with_parent_spans: None
) -> None:
    """No parent_id param returns all spans."""
    resp = await httpx_client.get("v1/projects/parent-spans/spans")
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 2


async def test_otlp_span_search_filter_by_parent_id_null(
    httpx_client: httpx.AsyncClient, project_with_parent_spans: None
) -> None:
    """parent_id=null returns only root spans (OTLP endpoint)."""
    resp = await httpx_client.get(
        "v1/projects/parent-spans/spans/otlpv1",
        params={"parent_id": "null"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "root-span"
    assert spans[0].parent_span_id is None


async def test_otlp_span_search_filter_by_parent_id_specific(
    httpx_client: httpx.AsyncClient, project_with_parent_spans: None
) -> None:
    """parent_id=<id> returns children (OTLP endpoint)."""
    resp = await httpx_client.get(
        "v1/projects/parent-spans/spans/otlpv1",
        params={"parent_id": "rootspan0"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "child-span"
    assert spans[0].parent_span_id == "rootspan0"


@pytest.fixture
async def project_with_varied_spans(db: DbSessionFactory) -> None:
    """Insert a project with spans of different names, kinds, and statuses."""
    async with db() as session:
        project = models.Project(name="varied-spans")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="tracevaried00000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        spans_data = [
            ("llm-call", "LLM", "OK"),
            ("tool-call", "TOOL", "OK"),
            ("chain-run", "CHAIN", "ERROR"),
            ("embed-call", "EMBEDDING", "UNSET"),
            ("llm-retry", "LLM", "ERROR"),
        ]
        for i, (name, kind, status) in enumerate(spans_data):
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=f"varied{i:04d}",
                    parent_id=None,
                    name=name,
                    span_kind=kind,
                    start_time=base_time + timedelta(minutes=i),
                    end_time=base_time + timedelta(minutes=i, seconds=30),
                    attributes={},
                    events=[],
                    status_code=status,
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()


async def test_span_search_filter_by_name(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"name": "llm-call"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "llm-call"


async def test_span_search_filter_by_multiple_span_kinds(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params=[("span_kind", "LLM"), ("span_kind", "TOOL")],
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 3
    names = {s.name for s in spans}
    assert names == {"llm-call", "tool-call", "llm-retry"}


async def test_span_search_filter_by_status_code(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"status_code": "ERROR"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 2
    assert all(s.status_code == "ERROR" for s in spans)


async def test_span_search_filter_combined(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    """Combined filters: span_kind=LLM AND status_code=ERROR."""
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"span_kind": "LLM", "status_code": "ERROR"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "llm-retry"


async def test_span_search_invalid_span_kind_returns_422(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"span_kind": "INVALID"},
    )
    assert resp.status_code == 422
    assert "Invalid span_kind" in resp.text


async def test_span_search_invalid_status_code_returns_422(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"status_code": "BADVALUE"},
    )
    assert resp.status_code == 422
    assert "Invalid status_code" in resp.text


async def test_span_search_case_insensitive_filters(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    """Filters should be case-insensitive."""
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans",
        params={"span_kind": "llm", "status_code": "ok"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "llm-call"


async def test_otlp_span_search_filter_by_name(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans/otlpv1",
        params={"name": "tool-call"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "tool-call"


async def test_otlp_span_search_filter_by_status_code(
    httpx_client: httpx.AsyncClient, project_with_varied_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/varied-spans/spans/otlpv1",
        params={"status_code": "OK"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 2


# ---------------------------------------------------------------------------
# Attribute filter tests
# ---------------------------------------------------------------------------


@pytest.fixture
async def project_with_attributed_spans(db: DbSessionFactory) -> None:
    """Insert spans with known attributes for attribute tests."""
    async with db() as session:
        project = models.Project(name="attr-filter-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="traceattr0000000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        spans_attrs: list[tuple[str, dict[str, Any]]] = [
            (
                "span-gpt4",
                {
                    "llm": {"model_name": "gpt-4"},
                    "openinference": {"span": {"kind": "LLM"}},
                },
            ),
            (
                "span-gpt35",
                {
                    "llm": {"model_name": "gpt-3.5-turbo"},
                    "openinference": {"span": {"kind": "LLM"}},
                },
            ),
            (
                "span-no-model",
                {
                    "openinference": {"span": {"kind": "CHAIN"}},
                },
            ),
            (
                "span-nested-doc",
                {
                    "retrieval": {
                        "source": {"document": {"id": "doc-42"}},
                    },
                },
            ),
            (
                "span-session-colon",
                {
                    "session": {"id": "sess:abc:123"},
                },
            ),
        ]
        for i, (name, attrs) in enumerate(spans_attrs):
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=f"attr{i:05d}",
                    parent_id=None,
                    name=name,
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(minutes=i),
                    end_time=base_time + timedelta(minutes=i, seconds=30),
                    attributes=attrs,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()


async def test_span_search_filter_by_attribute(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": "llm.model_name:gpt-4"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-gpt4"


async def test_otlp_span_search_filter_by_attribute(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans/otlpv1",
        params={"attribute": "llm.model_name:gpt-4"},
    )
    assert resp.is_success
    spans = [OtlpSpan.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-gpt4"


async def test_span_search_filter_by_multiple_attributes(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Multiple attribute params are ANDed."""
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params=[
            ("attribute", "llm.model_name:gpt-4"),
            ("attribute", "openinference.span.kind:LLM"),
        ],
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-gpt4"


async def test_span_search_filter_by_attribute_malformed(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Missing colon separator should return 422."""
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": "no-colon-here"},
    )
    assert resp.status_code == 422
    assert "expected format" in resp.text


async def test_span_search_filter_by_attribute_empty_key(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Empty key (leading colon) should return 422."""
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": ":some-value"},
    )
    assert resp.status_code == 422
    assert "key must not be empty" in resp.text


async def test_span_search_filter_by_nested_attribute_path(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Verify filtering with a deeply nested attribute path (D6)."""
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": "retrieval.source.document.id:doc-42"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-nested-doc"


async def test_span_search_filter_by_quoted_session_id_with_internal_colons(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Quoted JSON string value with multiple internal colons matches stored string.

    The server performs ``filter_str.split(':', 1)`` so only the FIRST colon is
    treated as the key/value delimiter; the value portion is then parsed with
    ``json.loads()``. A quoted JSON string preserves the full ``sess:abc:123``
    payload and is compared as a string.
    """
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": 'session.id:"sess:abc:123"'},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-session-colon"


async def test_span_search_filter_by_unquoted_session_id_with_internal_colons(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Unquoted colon-bearing value falls back to raw string and still matches.

    ``session.id:sess:abc:123`` splits to key=``session.id`` / value=
    ``sess:abc:123``. ``json.loads('sess:abc:123')`` raises, so the value
    falls back to the raw string and is matched via the string branch.
    """
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans",
        params={"attribute": "session.id:sess:abc:123"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-session-colon"


async def test_otlp_span_search_filter_by_attribute_empty_key(
    httpx_client: httpx.AsyncClient, project_with_attributed_spans: None
) -> None:
    """Empty key (leading colon) on OTLP endpoint should return 422."""
    resp = await httpx_client.get(
        "v1/projects/attr-filter-test/spans/otlpv1",
        params={"attribute": ":some-value"},
    )
    assert resp.status_code == 422
    assert "key must not be empty" in resp.text


# ---------------------------------------------------------------------------
# Forced-string-quoting round-trip + bool-before-int dispatch pinning tests
# ---------------------------------------------------------------------------
#
# These tests pin the current semantics of type-aware dispatch in
# _parse_attribute (spans.py): json.loads(value) drives the code path,
# with bool checked BEFORE int/float/str so `isinstance(True, int) is True`
# does not misroute booleans into the numeric CAST path. For each pinned
# behavior we seed two spans sharing the same key but storing values of
# different JSON types, then assert each filter form matches EXACTLY one span.


@pytest.fixture
async def project_with_dispatch_pinning_spans(db: DbSessionFactory) -> None:
    """Insert pairs of spans sharing a key but storing values of different JSON types.

    - user.id: int 12345 vs string "12345"   -> forced-string-quoting round-trip
    - llm.stream_flag: bool True vs string "true" -> bool-before-int dispatch
    """
    async with db() as session:
        project = models.Project(name="dispatch-pin-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-02-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="tracedispatch000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        spans_attrs: list[tuple[str, dict[str, Any]]] = [
            ("span-user-id-int", {"user": {"id": 12345}}),
            ("span-user-id-str", {"user": {"id": "12345"}}),
            ("span-stream-flag-bool", {"llm": {"stream_flag": True}}),
            ("span-stream-flag-str", {"llm": {"stream_flag": "true"}}),
        ]
        for i, (name, attrs) in enumerate(spans_attrs):
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=f"disp{i:05d}000",
                    parent_id=None,
                    name=name,
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(minutes=i),
                    end_time=base_time + timedelta(minutes=i, seconds=30),
                    attributes=attrs,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()


async def test_attribute_bare_numeric_matches_stored_int_not_string(
    httpx_client: httpx.AsyncClient, project_with_dispatch_pinning_spans: None
) -> None:
    """Bare `user.id:12345` dispatches as int and matches stored int 12345 only."""
    resp = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": "user.id:12345"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-user-id-int"


async def test_attribute_quoted_numeric_matches_stored_string_not_int(
    httpx_client: httpx.AsyncClient, project_with_dispatch_pinning_spans: None
) -> None:
    """Quoted `user.id:"12345"` (forced-string escape hatch) matches stored string "12345" only."""
    resp = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": 'user.id:"12345"'},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-user-id-str"


async def test_attribute_numeric_quoted_vs_unquoted_are_disjoint(
    httpx_client: httpx.AsyncClient, project_with_dispatch_pinning_spans: None
) -> None:
    """Quoted and unquoted numeric filters have disjoint match sets (pin distinct behaviors)."""
    resp_bare = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": "user.id:12345"},
    )
    resp_quoted = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": 'user.id:"12345"'},
    )
    assert resp_bare.is_success
    assert resp_quoted.is_success
    bare_names = {s["name"] for s in resp_bare.json()["data"]}
    quoted_names = {s["name"] for s in resp_quoted.json()["data"]}
    assert bare_names == {"span-user-id-int"}
    assert quoted_names == {"span-user-id-str"}
    assert bare_names.isdisjoint(quoted_names)


async def test_attribute_bare_true_matches_stored_bool_true(
    httpx_client: httpx.AsyncClient, project_with_dispatch_pinning_spans: None
) -> None:
    """Bare `flag:true` dispatches via .as_boolean() and always matches stored bool True.

    Pins that bool is checked BEFORE int/float/str in _parse_attribute —
    otherwise `isinstance(True, int) is True` would misroute booleans into the
    CAST(col AS TEXT) == json.dumps(value) path.

    Note: on postgresql, `.as_boolean()` ALSO coerces stored JSON string "true"
    to bool True (dialect divergence — see the per-dialect pinning test below).
    """
    resp = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": "llm.stream_flag:true"},
    )
    assert resp.is_success
    names = {s["name"] for s in resp.json()["data"]}
    assert "span-stream-flag-bool" in names


async def test_attribute_quoted_true_matches_stored_string_true_only(
    httpx_client: httpx.AsyncClient, project_with_dispatch_pinning_spans: None
) -> None:
    """Quoted `flag:"true"` dispatches as string and matches stored string "true" only.

    Consistent across dialects: CAST(col, Text) == '"true"' is exact on both.
    """
    resp = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": 'llm.stream_flag:"true"'},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-stream-flag-str"


async def test_attribute_bool_vs_bool_string_dispatch_pinned_per_dialect(
    httpx_client: httpx.AsyncClient,
    project_with_dispatch_pinning_spans: None,
    dialect: str,
) -> None:
    """Pin the CURRENT per-dialect behavior of bool-vs-bool-string dispatch.

    - sqlite: `.as_boolean()` does NOT coerce JSON strings — bare `flag:true`
      matches ONLY the stored-bool span; quoted `flag:"true"` matches ONLY the
      stored-string span; the two sets are disjoint.
    - postgresql: `.as_boolean()` coerces the stored JSON string "true" to
      boolean true, so bare `flag:true` matches BOTH the stored-bool span and
      the stored-string span. Quoted `flag:"true"` still matches the
      stored-string span only (CAST(col, Text) is exact).

    This divergence is analogous to the documented JSON-list-subscript skew
    on SQLite and is expected. Pin the behavior so future changes surface it.
    """
    resp_bare = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": "llm.stream_flag:true"},
    )
    resp_quoted = await httpx_client.get(
        "v1/projects/dispatch-pin-test/spans",
        params={"attribute": 'llm.stream_flag:"true"'},
    )
    assert resp_bare.is_success
    assert resp_quoted.is_success
    bare_names = {s["name"] for s in resp_bare.json()["data"]}
    quoted_names = {s["name"] for s in resp_quoted.json()["data"]}

    assert quoted_names == {"span-stream-flag-str"}
    if dialect == "sqlite":
        assert bare_names == {"span-stream-flag-bool"}
        assert bare_names.isdisjoint(quoted_names)
    else:
        assert dialect == "postgresql"
        assert bare_names == {"span-stream-flag-bool", "span-stream-flag-str"}
        assert quoted_names.issubset(bare_names)


@pytest.fixture
async def project_with_float_temperature_span(db: DbSessionFactory) -> None:
    """Insert one span with `{llm: {temperature: 1.0}}` for int-vs-float storage matching."""
    async with db() as session:
        project = models.Project(name="float-temp-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-03-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="tracefloattemp00",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        session.add(
            models.Span(
                trace_rowid=trace.id,
                span_id="floattemp0000",
                parent_id=None,
                name="span-temp-float",
                span_kind="LLM",
                start_time=base_time,
                end_time=base_time + timedelta(seconds=30),
                attributes={"llm": {"temperature": 1.0}},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )
        await session.flush()


async def test_attribute_bare_int_matches_stored_float_whole_number(
    httpx_client: httpx.AsyncClient,
    project_with_float_temperature_span: None,
    dialect: str,
) -> None:
    """Bare `llm.temperature:1` matches a stored float `1.0` on both dialects.

    The int branch of `_parse_attribute` casts the column to TEXT and compares
    against both `'1'` and `'1.0'` so that an int-typed query value matches
    whole-number float storage (a common case for `llm.temperature`).
    """
    resp = await httpx_client.get(
        "v1/projects/float-temp-test/spans",
        params={"attribute": "llm.temperature:1"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-temp-float"


# ---------------------------------------------------------------------------
# Silent-behavior documentation tests
# ---------------------------------------------------------------------------


@pytest.fixture
async def project_with_container_shaped_attributes(db: DbSessionFactory) -> None:
    """Insert spans with list-valued and nested-object stored attributes."""
    async with db() as session:
        project = models.Project(name="container-attr-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="tracecontain0000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        spans_attrs: list[tuple[str, dict[str, Any]]] = [
            (
                "span-list-tags",
                {"tag": {"tags": ["a", "b", "c"]}},
            ),
            (
                "span-nested-metadata",
                {"metadata": {"tier": "premium"}},
            ),
        ]
        for i, (name, attrs) in enumerate(spans_attrs):
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=f"cont{i:05d}",
                    parent_id=None,
                    name=name,
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(minutes=i),
                    end_time=base_time + timedelta(minutes=i, seconds=30),
                    attributes=attrs,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()


async def test_attribute_filter_into_list_valued_attribute_returns_zero_rows(
    httpx_client: httpx.AsyncClient,
    project_with_container_shaped_attributes: None,
) -> None:
    """Filtering into a list-valued stored attribute returns 200 with 0 rows.

    The span stores ``{"tag": {"tags": ["a", "b", "c"]}}``; filtering with
    ``attribute=tag.tags:"a"`` compares ``CAST(list_value AS TEXT)`` (the
    full JSON array text) against ``'"a"'`` (JSON-encoded single string),
    which never matches. This pins the current silent-failure contract —
    documented behavior, not a bug.
    """
    resp = await httpx_client.get(
        "v1/projects/container-attr-test/spans",
        params={"attribute": 'tag.tags:"a"'},
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 0


async def test_attribute_filter_nested_object_path_matches(
    httpx_client: httpx.AsyncClient,
    project_with_container_shaped_attributes: None,
) -> None:
    """Nested-object paths (no array indices) work on both sqlite and postgresql.

    Span stores ``{"metadata": {"tier": "premium"}}``; filter
    ``attribute=metadata.tier:premium`` resolves via dot-path JSON access
    and returns the span on both dialects.
    """
    resp = await httpx_client.get(
        "v1/projects/container-attr-test/spans",
        params={"attribute": "metadata.tier:premium"},
    )
    assert resp.status_code == 200
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert len(spans) == 1
    assert spans[0].name == "span-nested-metadata"


# ---------------------------------------------------------------------------
# Array-indexed attribute path dialect asymmetry
# ---------------------------------------------------------------------------


@pytest.fixture
async def project_with_array_indexed_attributes(db: DbSessionFactory) -> None:
    """Insert a span whose attributes contain a list of objects.

    The stored shape ``{"retrieval": {"documents": [{"document": {"id":
    "doc-42"}}]}}`` requires array indexing (``documents.0``) to reach the
    nested ``id`` field via a dot-path attribute filter.
    """
    async with db() as session:
        project = models.Project(name="array-attr-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="tracearrayidx000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        session.add(
            models.Span(
                trace_rowid=trace.id,
                span_id="arrayidx00000",
                parent_id=None,
                name="span-array-indexed",
                span_kind="CHAIN",
                start_time=base_time,
                end_time=base_time + timedelta(seconds=30),
                attributes={
                    "retrieval": {
                        "documents": [{"document": {"id": "doc-42"}}],
                    },
                },
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
        )
        await session.flush()


async def test_attribute_filter_array_indexed_path_dialect_asymmetry(
    httpx_client: httpx.AsyncClient,
    project_with_array_indexed_attributes: None,
    dialect: str,
) -> None:
    """Array-indexed dot-path filter has divergent behavior by dialect.

    SQLAlchemy's JSON list-subscript generates a dot-path expression. On
    sqlite the ``$.a.b.0.c`` path does NOT treat numeric segments as array
    indices, so the stored list doesn't resolve and zero rows are returned.
    PostgreSQL's ``->`` / ``->>`` operators DO treat a numeric text key as
    an array index, so the filter resolves and returns the seeded row.
    Pinned to document (not fix); if a future change breaks either side,
    this test will flag the divergence.
    """
    resp = await httpx_client.get(
        "v1/projects/array-attr-test/spans",
        params={"attribute": 'retrieval.documents.0.document.id:"doc-42"'},
    )
    assert resp.status_code == 200
    spans = resp.json()["data"]
    if dialect == "sqlite":
        assert len(spans) == 0
    else:
        assert dialect == "postgresql"
        assert [Span.model_validate(s).name for s in spans] == ["span-array-indexed"]


# ---------------------------------------------------------------------------
# OpenInference context-attribute shape coverage
# ---------------------------------------------------------------------------
#
# Single shared fixture seeding ONE span per OpenInference context-attribute
# shape. Each test below targets exactly one OI shape and asserts filter URL
# -> expected row count on both the sqlite and postgresql dialects (via the
# parametrized `dialect` fixture).


@pytest.fixture
async def project_with_oi_context_attributes(db: DbSessionFactory) -> None:
    """Seed one span per OpenInference context-attribute shape.

    Shapes:
    - user.id (string).
    - metadata.* (nested object with mixed types: tier string, count int,
      ratio float, flag bool).
    - tag.tags (list of strings — silent-zero-rows case for direct filtering).
    """
    async with db() as session:
        project = models.Project(name="oi-attr-test")
        session.add(project)
        await session.flush()

        base_time = datetime.fromisoformat("2021-01-01T00:00:00+00:00")
        trace = models.Trace(
            project_rowid=project.id,
            trace_id="traceoictx000000",
            start_time=base_time,
            end_time=base_time + timedelta(minutes=10),
        )
        session.add(trace)
        await session.flush()

        spans_attrs: list[tuple[str, dict[str, Any]]] = [
            ("span-user", {"user": {"id": "user-42"}}),
            (
                "span-metadata",
                {
                    "metadata": {
                        "tier": "premium",
                        "count": 7,
                        "ratio": 0.75,
                        "flag": True,
                    },
                },
            ),
            ("span-tags", {"tag": {"tags": ["a", "b", "c"]}}),
        ]
        for i, (name, attrs) in enumerate(spans_attrs):
            session.add(
                models.Span(
                    trace_rowid=trace.id,
                    span_id=f"oictx{i:05d}",
                    parent_id=None,
                    name=name,
                    span_kind="CHAIN",
                    start_time=base_time + timedelta(minutes=i),
                    end_time=base_time + timedelta(minutes=i, seconds=30),
                    attributes=attrs,
                    events=[],
                    status_code="OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.flush()


async def test_oi_filter_by_user_id_string(
    httpx_client: httpx.AsyncClient, project_with_oi_context_attributes: None
) -> None:
    """user.id (string) filter returns exactly the matching span."""
    resp = await httpx_client.get(
        "v1/projects/oi-attr-test/spans",
        params={"attribute": "user.id:user-42"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert [s.name for s in spans] == ["span-user"]


async def test_oi_filter_by_metadata_nested_int(
    httpx_client: httpx.AsyncClient, project_with_oi_context_attributes: None
) -> None:
    """metadata.count (nested int) matches via type-aware integer dispatch."""
    resp = await httpx_client.get(
        "v1/projects/oi-attr-test/spans",
        params={"attribute": "metadata.count:7"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert [s.name for s in spans] == ["span-metadata"]


async def test_oi_filter_by_metadata_nested_float(
    httpx_client: httpx.AsyncClient, project_with_oi_context_attributes: None
) -> None:
    """metadata.ratio (nested float) matches via type-aware float dispatch."""
    resp = await httpx_client.get(
        "v1/projects/oi-attr-test/spans",
        params={"attribute": "metadata.ratio:0.75"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert [s.name for s in spans] == ["span-metadata"]


async def test_oi_filter_by_metadata_nested_bool(
    httpx_client: httpx.AsyncClient, project_with_oi_context_attributes: None
) -> None:
    """metadata.flag (nested bool) matches via type-aware boolean dispatch."""
    resp = await httpx_client.get(
        "v1/projects/oi-attr-test/spans",
        params={"attribute": "metadata.flag:true"},
    )
    assert resp.is_success
    spans = [Span.model_validate(s) for s in resp.json()["data"]]
    assert [s.name for s in spans] == ["span-metadata"]


async def test_oi_filter_by_tag_tags_list_returns_zero_rows(
    httpx_client: httpx.AsyncClient, project_with_oi_context_attributes: None
) -> None:
    """Filtering into a list-valued stored attribute silently returns no rows.

    Pins the CURRENT contract: ``tag.tags`` is stored as a list, and a
    scalar filter like ``tag.tags:a`` compares the entire JSON list text
    against ``json.dumps("a")`` — which never matches. Behavior is a 200
    with an empty data array, not a 422 and not any of the list-member
    spans.
    """
    resp = await httpx_client.get(
        "v1/projects/oi-attr-test/spans",
        params={"attribute": "tag.tags:a"},
    )
    assert resp.is_success
    assert resp.json()["data"] == []


# ---------------------------------------------------------------------------
# Consolidated 422 coverage for the `attribute` query param
# ---------------------------------------------------------------------------
#
# Pins the six documented 422 cases in `_parse_attribute` (spans.py:79-111) in
# one auditable suite, against the canonical endpoint plus a parity check on
# the OTLP endpoint. Other 422 assertions also exist elsewhere in this file
# (fixture-specific) — this suite is the single place that enumerates every
# case so coverage is visible at a glance.


@pytest.mark.parametrize(
    ("case_name", "attribute_value"),
    [
        ("missing_colon", "no-colon-here"),
        ("empty_key", ":some-value"),
        ("empty_value", "key:"),
        ("list_filter_value", "key:[1,2,3]"),
        ("dict_filter_value", 'key:{"a":1}'),
        ("null_filter_value", "key:null"),
    ],
)
async def test_attribute_filter_returns_422(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: None,
    case_name: str,
    attribute_value: str,
) -> None:
    """Each documented `_parse_attribute` error case returns 422 on /spans.

    Covers spans.py:79-111 — missing colon (split-check), empty key / empty
    value (pre-parse), and null / list / dict filter values (post-json.loads
    type-check).
    """
    resp = await httpx_client.get(
        "v1/projects/project-name/spans",
        params={"attribute": attribute_value},
    )
    assert resp.status_code == 422, f"case={case_name} body={resp.text!r}"


async def test_attribute_filter_dict_value_returns_422_on_otlp(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: None,
) -> None:
    """Parity: dict filter value also returns 422 on /spans/otlpv1.

    Both endpoints share `_parse_attribute`; this asserts that the parity
    holds for a case not already covered by the existing OTLP 422 tests
    (missing colon, empty key).
    """
    resp = await httpx_client.get(
        "v1/projects/project-name/spans/otlpv1",
        params={"attribute": 'key:{"a":1}'},
    )
    assert resp.status_code == 422
