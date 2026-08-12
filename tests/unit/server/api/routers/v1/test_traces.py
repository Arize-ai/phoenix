from asyncio import sleep
from datetime import datetime
from typing import Any
from uuid import UUID

import httpx
import opentelemetry.proto.trace.v1.trace_pb2 as otlp
import pytest
from faker import Faker
from openinference.semconv.resource import ResourceAttributes
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from opentelemetry.proto.common.v1.common_pb2 import AnyValue, KeyValue
from opentelemetry.proto.resource.v1.resource_pb2 import Resource
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, ScopeSpans
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.eval_work import SESSION_CONTENT_INCOMPLETE_ERROR
from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import (
    _add_live_session_work_unit,
    _add_project,
    _add_project_session,
    _add_span,
    _add_trace,
)


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
                trace_id="82c6c9c33ccc586e0d3bdf46b20db309",
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
                span_id="f0d808aedd5591b6",
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


@pytest.mark.parametrize("sync", [False, True])
async def test_rest_trace_annotation(
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
                "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
                "name": name,
                "annotator_kind": "HUMAN",
                "result": {
                    "label": "True",
                    "score": 0.95,
                    "explanation": "This is a test annotation.",
                },
                "metadata": {},
                "identifier": "identifier-name",
            }
        ]
    }

    response = await httpx_client.post(f"v1/trace_annotations?sync={sync}", json=request_body)
    assert response.status_code == 200
    if not sync:
        await sleep(0.1)
    async with db() as session:
        orm_annotation = await session.scalar(
            select(models.TraceAnnotation).where(models.TraceAnnotation.name == name)
        )

    assert orm_annotation is not None
    assert orm_annotation.name == name
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.label == "True"
    assert orm_annotation.score == 0.95
    assert orm_annotation.explanation == "This is a test annotation."
    assert orm_annotation.metadata_ == dict()
    assert orm_annotation.identifier == "identifier-name"
    assert orm_annotation.source == "API"
    assert orm_annotation.user_id is None


async def test_rest_trace_annotation_rejects_note_name(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
) -> None:
    request_body = {
        "data": [
            {
                "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
                "name": "note",
                "annotator_kind": "HUMAN",
                "result": {
                    "explanation": "This should fail",
                },
                "metadata": {},
            }
        ]
    }

    response = await httpx_client.post("v1/trace_annotations?sync=true", json=request_body)
    assert response.status_code == 400
    assert (
        "The name 'note' is reserved for trace and span notes. Use POST /v1/trace_notes instead."
    ) in response.text


async def test_rest_create_trace_note(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    note_text = fake.pystr()
    request_body = {
        "data": {
            "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
            "note": note_text,
        }
    }

    response = await httpx_client.post("v1/trace_notes", json=request_body)
    assert response.status_code == 200

    response_data = response.json()
    assert "data" in response_data
    assert "id" in response_data["data"]

    async with db() as session:
        orm_annotation = await session.scalar(
            select(models.TraceAnnotation).where(
                models.TraceAnnotation.name == "note",
                models.TraceAnnotation.explanation == note_text,
            )
        )

    assert orm_annotation is not None
    assert orm_annotation.name == "note"
    assert orm_annotation.annotator_kind == "HUMAN"
    assert orm_annotation.explanation == note_text
    assert orm_annotation.source == "API"
    assert orm_annotation.identifier.startswith("px-trace-note:")
    assert UUID(orm_annotation.identifier.removeprefix("px-trace-note:")).version == 4
    assert orm_annotation.label is None
    assert orm_annotation.score is None
    assert orm_annotation.metadata_ == dict()


async def test_rest_create_trace_note_not_found(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
) -> None:
    request_body = {
        "data": {
            "trace_id": "nonexistent-trace-id",
            "note": "This should fail",
        }
    }

    response = await httpx_client.post("v1/trace_notes", json=request_body)
    assert response.status_code == 404
    assert "not found" in response.text.lower()


async def test_rest_create_multiple_trace_notes(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    note_texts = [fake.pystr() for _ in range(3)]

    for note_text in note_texts:
        request_body = {
            "data": {
                "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
                "note": note_text,
            }
        }
        response = await httpx_client.post("v1/trace_notes", json=request_body)
        assert response.status_code == 200

    async with db() as session:
        result = await session.execute(
            select(models.TraceAnnotation).where(models.TraceAnnotation.name == "note")
        )
        annotations = list(result.scalars().all())

    assert len(annotations) == 3
    explanations = {annotation.explanation for annotation in annotations}
    assert explanations == set(note_texts)

    identifiers = [annotation.identifier for annotation in annotations]
    assert len(identifiers) == len(set(identifiers))
    assert all(
        UUID(identifier.removeprefix("px-trace-note:")).version == 4 for identifier in identifiers
    )


async def test_rest_create_trace_note_blank_text_rejected(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
) -> None:
    request_body = {
        "data": {
            "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
            "note": "   ",
        }
    }

    response = await httpx_client.post("v1/trace_notes", json=request_body)
    assert response.status_code == 422


async def test_rest_create_trace_note_with_identifier_upserts(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
    fake: Faker,
) -> None:
    identifier = "px-coding-session:test-upsert"
    first_note, second_note = fake.pystr(), fake.pystr()

    for note_text in (first_note, second_note):
        response = await httpx_client.post(
            "v1/trace_notes",
            json={
                "data": {
                    "trace_id": "82c6c9c33ccc586e0d3bdf46b20db309",
                    "note": note_text,
                    "identifier": identifier,
                }
            },
        )
        assert response.status_code == 200

    async with db() as session:
        annotations = list(
            (
                await session.scalars(
                    select(models.TraceAnnotation).where(models.TraceAnnotation.name == "note")
                )
            ).all()
        )

    assert len(annotations) == 1
    assert annotations[0].identifier == identifier
    assert annotations[0].explanation == second_note


async def test_traces_endpoint_otlp_compliance(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Test that /traces endpoint returns protobuf response when protobuf request is sent"""
    request = ExportTraceServiceRequest()
    request_data = request.SerializeToString()

    response = await httpx_client.post(
        "v1/traces",
        content=request_data,
        headers={"Content-Type": "application/x-protobuf"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-protobuf"

    response_message = ExportTraceServiceResponse()
    response_message.ParseFromString(response.content)


async def test_delete_trace_by_trace_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    project_with_a_single_trace_and_span: None,
) -> None:
    """
    Test deleting a trace by trace_id.

    This test verifies that:
    1. The DELETE /traces/{trace_id} endpoint returns a 204 status code
    2. The trace and all its spans are successfully removed from the database
    3. Database CASCADE deletion works correctly
    """
    # Get the trace and span data from the test fixture
    async with db() as session:
        # Get the trace that was created by the fixture
        trace_result = await session.execute(
            select(models.Trace).join(models.Project).where(models.Project.name == "project-name")
        )
        trace = trace_result.scalar_one()
        trace_id = trace.trace_id
        trace_row_id = trace.id

    # Delete the trace via the API
    url = f"v1/traces/{trace_id}"
    response = await httpx_client.delete(url)

    # Should return 204 No Content
    assert response.status_code == 204, (
        f"DELETE /traces/{trace_id} should return 204 status code, got {response.status_code}"
    )
    assert response.text == ""  # No content in response body

    # Verify the trace was actually deleted from the database
    async with db() as session:
        deleted_trace = await session.get(models.Trace, trace_row_id)
        assert deleted_trace is None, f"Trace {trace_row_id} should be deleted from database"


async def test_delete_trace_stands_down_the_sessions_evaluations(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        trace = await _add_trace(session, project, project_session)
        await _add_span(session, trace)
        await _add_trace(session, project, project_session)
        work_unit_id = (await _add_live_session_work_unit(session, project_session)).id
        project_session_id = project_session.id
        trace_id = trace.trace_id

    response = await httpx_client.delete(f"v1/traces/{trace_id}")
    assert response.status_code == 204

    async with db() as session:
        remaining_session = await session.get(models.ProjectSession, project_session_id)
        assert remaining_session is not None
        assert remaining_session.content_complete is False
        work_unit = await session.get(models.EvalSessionWorkUnit, work_unit_id)
        assert work_unit is not None
        assert work_unit.status == "EXPIRED"
        assert work_unit.error == SESSION_CONTENT_INCOMPLETE_ERROR


async def test_delete_trace_not_found(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: None,
) -> None:
    """
    Test deleting a non-existent trace.

    This test verifies that:
    1. The DELETE endpoint returns a 404 status code for non-existent traces
    2. The error message is descriptive
    """
    non_existent_trace_id = "nonexistent123456789abcdef"
    url = f"v1/traces/{non_existent_trace_id}"

    response = await httpx_client.delete(url)
    assert response.status_code == 404
    assert f"Trace with trace_id '{non_existent_trace_id}' not found" in response.text


async def test_delete_trace_with_multiple_spans(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """
    Test deleting a trace that contains multiple spans.

    This test verifies that:
    1. All spans in the trace are deleted via CASCADE
    2. Parent-child span relationships don't prevent deletion
    """
    # Create a trace with multiple spans (parent and child)
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name="multi-span-project").returning(models.Project.id)
        )
        trace_row_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="multispantrace123456789abcdef",
                project_rowid=project_row_id,
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
            )
            .returning(models.Trace.id)
        )

        # Create parent span
        parent_span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_row_id,
                span_id="parentspan123456",
                parent_id=None,
                name="parent span",
                span_kind="CHAIN",
                start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
                attributes={"type": "parent"},
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        # Create child span
        child_span_id = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_row_id,
                span_id="childspan1234567",
                parent_id="parentspan123456",
                name="child span",
                span_kind="LLM",
                start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
                end_time=datetime.fromisoformat("2021-01-01T00:00:25.000+00:00"),
                attributes={"type": "child"},
                events=[],
                status_code="OK",
                status_message="okay",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )

        await session.commit()

    # Delete the trace
    url = "v1/traces/multispantrace123456789abcdef"
    response = await httpx_client.delete(url)
    assert response.status_code == 204

    # Verify trace and all spans are deleted
    async with db() as session:
        deleted_trace = await session.get(models.Trace, trace_row_id)
        assert deleted_trace is None, "Trace should be deleted"

        deleted_parent = await session.get(models.Span, parent_span_id)
        assert deleted_parent is None, "Parent span should be deleted via CASCADE"

        deleted_child = await session.get(models.Span, child_span_id)
        assert deleted_child is None, "Child span should be deleted via CASCADE"


async def test_delete_trace_by_relay_global_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    project_with_a_single_trace_and_span: None,
) -> None:
    """
    Test deleting a trace by relay GlobalID.

    This test verifies that:
    1. The DELETE /traces/{relay_id} endpoint returns a 204 status code
    2. The trace and all its spans are successfully removed from the database
    3. Relay GlobalID identifier type is handled correctly
    """
    # Get the trace and span data from the test fixture
    async with db() as session:
        # Get the trace that was created by the fixture
        trace_result = await session.execute(
            select(models.Trace).join(models.Project).where(models.Project.name == "project-name")
        )
        trace = trace_result.scalar_one()
        trace_row_id = trace.id

        # Get the spans in this trace
        span_result = await session.execute(
            select(models.Span).where(models.Span.trace_rowid == trace_row_id)
        )
        spans = span_result.scalars().all()
        span_row_ids = [span.id for span in spans]

    # Create relay GlobalID for the trace
    trace_global_id = GlobalID(type_name="Trace", node_id=str(trace_row_id))

    # Delete the trace via the API using relay GlobalID
    url = f"v1/traces/{trace_global_id}"
    response = await httpx_client.delete(url)

    # Should return 204 No Content
    assert response.status_code == 204, (
        f"DELETE /traces/{trace_global_id} should return 204 status code, got {response.status_code}"
    )
    assert response.text == ""  # No content in response body

    # Verify the trace was actually deleted from the database
    async with db() as session:
        deleted_trace = await session.get(models.Trace, trace_row_id)
        assert deleted_trace is None, f"Trace {trace_row_id} should be deleted from database"

        # Verify all spans in the trace were also deleted via CASCADE
        for span_row_id in span_row_ids:
            deleted_span = await session.get(models.Span, span_row_id)
            assert deleted_span is None, f"Span {span_row_id} should be deleted via CASCADE"


async def test_delete_trace_by_relay_id_not_found(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: None,
) -> None:
    """
    Test deleting a non-existent trace by relay GlobalID.

    This test verifies that:
    1. The DELETE endpoint returns a 404 status code for non-existent relay IDs
    2. The error message mentions relay ID
    """
    # Create a relay GlobalID for a non-existent trace
    non_existent_global_id = GlobalID(type_name="Trace", node_id="999999")
    url = f"v1/traces/{non_existent_global_id}"

    response = await httpx_client.delete(url)
    assert response.status_code == 404
    assert f"Trace with relay ID '{non_existent_global_id}' not found" in response.text


def _make_otlp_request(
    *,
    project_resource_attr: str | None = None,
) -> ExportTraceServiceRequest:
    """Build a minimal OTLP ExportTraceServiceRequest with one span.

    Args:
        project_resource_attr: If provided, sets the ``openinference.project.name``
            resource attribute on the ResourceSpans.
    """
    resource_attrs: list[KeyValue] = []
    if project_resource_attr is not None:
        resource_attrs.append(
            KeyValue(
                key=ResourceAttributes.PROJECT_NAME,
                value=AnyValue(string_value=project_resource_attr),
            )
        )

    span = otlp.Span(
        trace_id=bytes.fromhex("a" * 32),
        span_id=bytes.fromhex("b" * 16),
        name="test-span",
        start_time_unix_nano=1_000_000_000,
        end_time_unix_nano=2_000_000_000,
    )
    resource_spans = ResourceSpans(
        resource=Resource(attributes=resource_attrs),
        scope_spans=[ScopeSpans(spans=[span])],
    )
    return ExportTraceServiceRequest(resource_spans=[resource_spans])


async def test_post_traces_project_header_overrides_resource_attribute(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """The x-project-name header takes precedence over the resource attribute."""
    req = _make_otlp_request(project_resource_attr="resource-project")

    response = await httpx_client.post(
        "v1/traces",
        content=req.SerializeToString(),
        headers={
            "Content-Type": "application/x-protobuf",
            "x-project-name": "header-project",
        },
    )
    assert response.status_code == 200

    # Allow the background task to complete
    await sleep(0.1)

    async with db() as session:
        header_project = await session.scalar(
            select(models.Project).where(models.Project.name == "header-project")
        )
        resource_project = await session.scalar(
            select(models.Project).where(models.Project.name == "resource-project")
        )

    assert header_project is not None, "Project named by the header should be created"
    assert resource_project is None, "Resource attribute project should NOT be created"


async def test_post_traces_resource_attribute_used_when_no_header(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """When no header is sent, the openinference.project.name resource attribute is used."""
    req = _make_otlp_request(project_resource_attr="attr-project")

    response = await httpx_client.post(
        "v1/traces",
        content=req.SerializeToString(),
        headers={"Content-Type": "application/x-protobuf"},
    )
    assert response.status_code == 200

    await sleep(0.1)

    async with db() as session:
        project = await session.scalar(
            select(models.Project).where(models.Project.name == "attr-project")
        )

    assert project is not None, "Project from resource attribute should be created"


# ---------------------------------------------------------------------------
# POST /v1/traces/transfer
# ---------------------------------------------------------------------------


async def _project_with_traces(
    db: DbSessionFactory,
    project_name: str,
    num_traces: int,
    trace_id_prefix: str,
) -> tuple[int, list[int]]:
    """Create a project with `num_traces` traces; return (project_rowid, trace_rowids)."""
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_name).returning(models.Project.id)
        )
        trace_rowids: list[int] = []
        for i in range(num_traces):
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=f"{trace_id_prefix}{i:04d}",
                    project_rowid=project_rowid,
                    start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
                    end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
                )
                .returning(models.Trace.id)
            )
            assert trace_rowid is not None
            trace_rowids.append(trace_rowid)
    assert project_rowid is not None
    return project_rowid, trace_rowids


async def test_transfer_traces_moves_traces_to_destination(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    source_rowid, trace_rowids = await _project_with_traces(db, "src-proj", 2, "aaaa")
    dest_rowid, _ = await _project_with_traces(db, "dst-proj", 1, "bbbb")

    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [str(GlobalID("Trace", str(rowid))) for rowid in trace_rowids],
            "destination_project_identifier": "dst-proj",
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["transferred_trace_count"] == 2
    assert data["destination_project_id"] == str(GlobalID("Project", str(dest_rowid)))

    async with db() as session:
        moved = (
            await session.scalars(
                select(models.Trace.project_rowid).where(models.Trace.id.in_(trace_rowids))
            )
        ).all()
    assert set(moved) == {dest_rowid}, "traces should be re-parented to the destination"
    assert source_rowid not in set(moved)


async def test_transfer_traces_accepts_project_global_id(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    _, trace_rowids = await _project_with_traces(db, "src-gid", 1, "cccc")
    dest_rowid, _ = await _project_with_traces(db, "dst-gid", 1, "dddd")

    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [str(GlobalID("Trace", str(trace_rowids[0])))],
            "destination_project_identifier": str(GlobalID("Project", str(dest_rowid))),
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["transferred_trace_count"] == 1


async def test_transfer_traces_deduplicates_repeated_ids(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    _, trace_rowids = await _project_with_traces(db, "src-dupe", 1, "eeee")
    await _project_with_traces(db, "dst-dupe", 1, "ffff")
    trace_gid = str(GlobalID("Trace", str(trace_rowids[0])))

    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [trace_gid, trace_gid],
            "destination_project_identifier": "dst-dupe",
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["transferred_trace_count"] == 1


async def test_transfer_traces_rejects_multiple_source_projects(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    _, traces_a = await _project_with_traces(db, "multi-a", 1, "1111")
    _, traces_b = await _project_with_traces(db, "multi-b", 1, "2222")
    await _project_with_traces(db, "multi-dst", 1, "3333")

    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [
                str(GlobalID("Trace", str(traces_a[0]))),
                str(GlobalID("Trace", str(traces_b[0]))),
            ],
            "destination_project_identifier": "multi-dst",
        },
    )
    assert response.status_code == 422


async def test_transfer_traces_empty_trace_identifiers(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    await _project_with_traces(db, "empty-dst", 1, "4444")
    response = await httpx_client.post(
        "v1/traces/transfer",
        json={"trace_identifiers": [], "destination_project_identifier": "empty-dst"},
    )
    assert response.status_code == 422


async def test_transfer_traces_unknown_trace(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    await _project_with_traces(db, "unknown-dst", 1, "5555")
    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [str(GlobalID("Trace", "99999"))],
            "destination_project_identifier": "unknown-dst",
        },
    )
    assert response.status_code == 404


async def test_transfer_traces_unknown_destination_project(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    _, trace_rowids = await _project_with_traces(db, "src-nodst", 1, "6666")
    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": [str(GlobalID("Trace", str(trace_rowids[0])))],
            "destination_project_identifier": "does-not-exist",
        },
    )
    assert response.status_code == 404


async def test_transfer_traces_accepts_otel_trace_ids(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    source_rowid, trace_rowids = await _project_with_traces(db, "src-otel", 2, "abcd")
    dest_rowid, _ = await _project_with_traces(db, "dst-otel", 1, "beef")

    # Mix an OpenTelemetry trace_id with a GlobalID in a single request.
    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": ["abcd0000", str(GlobalID("Trace", str(trace_rowids[1])))],
            "destination_project_identifier": "dst-otel",
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["transferred_trace_count"] == 2

    async with db() as session:
        moved = (
            await session.scalars(
                select(models.Trace.project_rowid).where(models.Trace.id.in_(trace_rowids))
            )
        ).all()
    assert set(moved) == {dest_rowid}


async def test_transfer_traces_unparseable_identifier(
    db: DbSessionFactory,
    httpx_client: httpx.AsyncClient,
) -> None:
    await _project_with_traces(db, "malformed-dst", 1, "7777")
    # An identifier that is not a GlobalID is treated as an OpenTelemetry trace_id;
    # when no trace has it, the request is a 404.
    response = await httpx_client.post(
        "v1/traces/transfer",
        json={
            "trace_identifiers": ["not-a-global-id"],
            "destination_project_identifier": "malformed-dst",
        },
    )
    assert response.status_code == 404
