from datetime import datetime
from typing import Any

import httpx
import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.Span import Span
from phoenix.server.types import DbSessionFactory


async def test_project_resolver_returns_correct_project(
    httpx_client: httpx.AsyncClient,
    project_with_a_single_trace_and_span: Any,
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
    response = await httpx_client.post(
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


async def test_querying_spans_contained_in_datasets(
    httpx_client: httpx.AsyncClient, project_with_a_single_trace_and_span: Any, simple_dataset: Any
) -> None:
    query = """
      query ($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            containedInDataset
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await httpx_client.post(
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
    actual_contained_in_dataset = response_json["data"]["span"]["containedInDataset"]
    assert actual_contained_in_dataset is True


async def test_querying_spans_not_contained_in_datasets(
    httpx_client: httpx.AsyncClient, project_with_a_single_trace_and_span: Any
) -> None:
    query = """
      query ($spanId: GlobalID!) {
        span: node(id: $spanId) {
          ... on Span {
            containedInDataset
          }
        }
      }
    """
    span_id = str(GlobalID(Span.__name__, str(1)))
    response = await httpx_client.post(
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
    actual_contained_in_dataset = response_json["data"]["span"]["containedInDataset"]
    assert actual_contained_in_dataset is False


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


@pytest.fixture
async def simple_dataset(
    db: DbSessionFactory,
) -> None:
    """
    A dataset with one example added in one version
    """
    async with db() as session:
        dataset = models.Dataset(
            id=0,
            name="simple dataset",
            description=None,
            metadata_={"info": "a test dataset"},
        )
        session.add(dataset)
        await session.flush()

        dataset_version_0 = models.DatasetVersion(
            id=0,
            dataset_id=0,
            description="the first version",
            metadata_={"info": "gotta get some test data somewhere"},
        )
        session.add(dataset_version_0)
        await session.flush()

        example_0 = models.DatasetExample(
            id=0,
            dataset_id=0,
            span_rowid=1,
        )
        session.add(example_0)
        await session.flush()

        example_0_revision_0 = models.DatasetExampleRevision(
            id=0,
            dataset_example_id=0,
            dataset_version_id=0,
            input={"in": "foo"},
            output={"out": "bar"},
            metadata_={"info": "the first reivision"},
            revision_kind="CREATE",
        )
        session.add(example_0_revision_0)
        await session.flush()
