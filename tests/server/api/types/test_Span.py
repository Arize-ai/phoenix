from datetime import datetime

import pytest
from phoenix.db import models
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Span import Span
from sqlalchemy import insert
from strawberry.relay import GlobalID


async def test_project_resolver_returns_correct_project(
    test_client, project_with_a_single_trace_and_span
) -> None:
    query = """
      query ($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            project {
              id
              name
            }
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await test_client.post(
        "/graphql",
        json={
            "query": query,
            "variables": {
                "spanId": span_id,
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    actual_project = response_json["data"]["span"]["project"]
    assert actual_project == {
        "id": str(GlobalID(Project.__name__, str(1))),
        "name": "project-name",
    }


@pytest.fixture
async def project_with_a_single_trace_and_span(session) -> None:
    """
    Contains a project with a single trace and a single span.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name="project-name").returning(models.Project.id)
    )
    trace_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="1",
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
            span_id="1",
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
