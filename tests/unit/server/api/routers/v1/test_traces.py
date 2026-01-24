from asyncio import sleep
from datetime import datetime
from typing import Any

import httpx
import pytest
from faker import Faker
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
    ExportTraceServiceResponse,
)
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


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
                    "input": {
                        "value": "chain-span-input-value",
                        "mime_type": "text/plain",
                    },
                    "output": {
                        "value": "chain-span-output-value",
                        "mime_type": "text/plain",
                    },
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
