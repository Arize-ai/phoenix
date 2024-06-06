from datetime import datetime

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from sqlalchemy import insert
from strawberry.relay import GlobalID


@pytest.mark.parametrize(
    "example_id, expected_span",
    [
        pytest.param(
            str(GlobalID("DatasetExample", str(1))),
            {
                "context": {
                    "spanId": "c0055a08295841ab946f2a16e5089fad",
                    "traceId": "0f5bb2e69a0640de87b9d424622b9f13",
                },
                "name": "query",
                "spanKind": "chain",
                "startTime": "2023-12-11T17:43:23.306838+00:00",
                "endTime": "2023-12-11T17:43:25.534589+00:00",
                "attributes": '{"openinference": {"span": {"kind": "CHAIN"}}}',
                "events": [],
                "statusCode": "OK",
                "statusMessage": "",
                "cumulativeTokenCountPrompt": 1,
                "cumulativeTokenCountCompletion": 1,
                "cumulativeTokenCountTotal": 2,
            },
            id="returns-span-when-exists",
        ),
        pytest.param(
            str(GlobalID("DatasetExample", str(2))),
            None,
            id="returns-none-when-span-does-not-exist",
        ),
    ],
)
async def test_dataset_example_span_resolver(
    example_id, expected_span, test_client, dataset_with_span_and_nonspan_examples
):
    query = """
      query ($exampleId: GlobalID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            span {
              context {
                spanId
                traceId
              }
              name
              spanKind
              startTime
              endTime
              attributes
              events {
                name
              }
              statusCode
              statusMessage
              cumulativeTokenCountPrompt
              cumulativeTokenCountCompletion
              cumulativeTokenCountTotal
            }
          }
        }
      }
    """
    response = await test_client.post(
        "/graphql",
        json={
            "query": query,
            "variables": {
                "exampleId": example_id,
                "datasetVersionId": str(GlobalID("DatasetVersion", str(2))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    actual_example = response_json["data"]["example"]
    assert actual_example == {
        "id": example_id,
        "span": expected_span,
    }


@pytest.fixture
async def dataset_with_span_and_nonspan_examples(session):
    """
    Dataset with two examples, one that comes from a span and one that does not.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_rowid = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="0f5bb2e69a0640de87b9d424622b9f13",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
            end_time=datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
        )
        .returning(models.Trace.id)
    )
    span_rowid = await session.scalar(
        insert(models.Span)
        .values(
            trace_rowid=trace_rowid,
            span_id="c0055a08295841ab946f2a16e5089fad",
            parent_id=None,
            name="query",
            span_kind="CHAIN",
            start_time=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
            end_time=datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
            attributes={
                "openinference": {"span": {"kind": "CHAIN"}},
            },
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=1,
            cumulative_llm_token_count_completion=1,
        )
        .returning(models.Span.id)
    )
    dataset_id = await session.scalar(
        insert(models.Dataset)
        .values(
            name="dataset-name",
            description="dataset-description",
            metadata_={"metadata": "dataset-metadata"},
        )
        .returning(models.Dataset.id)
    )
    example_1_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            span_rowid=span_rowid,
        )
        .returning(models.DatasetExample.id)
    )
    example_2_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
        )
        .returning(models.DatasetExample.id)
    )
    version_id = await session.scalar(
        insert(models.DatasetVersion)
        .values(
            dataset_id=dataset_id,
            description="dataset-version-description",
            metadata_={"metadata": "dataset-version-metadata"},
        )
        .returning(models.DatasetVersion.id)
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_1_id,
            dataset_version_id=version_id,
            input={"input": "example-1-revision-1-input"},
            output={"output": "example-1-revision-1-output"},
            metadata_={"metadata": "example-1-revision-1-metadata"},
            revision_kind="CREATE",
        )
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_2_id,
            dataset_version_id=version_id,
            input={"input": "example-2-revision-1-input"},
            output={"output": "example-2-revision-1-output"},
            metadata_={"metadata": "example-2-revision-1-metadata"},
            revision_kind="CREATE",
        )
    )
