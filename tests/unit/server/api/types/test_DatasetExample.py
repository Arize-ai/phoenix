from collections.abc import Mapping
from datetime import datetime
from typing import Any

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


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
    example_id: str,
    expected_span: Mapping[str, Any],
    gql_client: AsyncGraphQLClient,
    dataset_with_span_and_nonspan_examples: Any,
) -> None:
    query = """
      query ($exampleId: ID!) {
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
    response = await gql_client.execute(
        query=query,
        variables={"exampleId": example_id},
    )
    assert not response.errors
    assert (data := response.data) is not None
    assert data["example"] == {
        "id": example_id,
        "span": expected_span,
    }


async def test_dataset_example_experiment_runs_resolver_returns_relevant_runs(
    gql_client: AsyncGraphQLClient,
    example_with_experiment_runs: Any,
) -> None:
    query = """
      query ($exampleId: ID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            experimentRuns {
              edges {
                run: node {
                  id
                  traceId
                  output
                  startTime
                  endTime
                  error
                }
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={"exampleId": str(GlobalID("DatasetExample", str(1)))},
    )
    assert not response.errors
    assert response.data == {
        "example": {
            "experimentRuns": {
                "edges": [
                    {
                        "run": {
                            "id": str(GlobalID("ExperimentRun", str(2))),
                            "traceId": None,
                            "output": {"output": "experiment-2-run-1-output"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:01:00+00:00",
                            "error": None,
                        }
                    },
                    {
                        "run": {
                            "id": str(GlobalID("ExperimentRun", str(1))),
                            "traceId": None,
                            "output": "experiment-1-run-1-output",
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:01:00+00:00",
                            "error": None,
                        }
                    },
                ]
            }
        }
    }


@pytest.fixture
async def dataset_with_span_and_nonspan_examples(
    db: DbSessionFactory,
) -> None:
    """
    Dataset with two examples, one that comes from a span and one that does not.
    """
    async with db() as session:
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
                span_rowid=span_rowid,  # this example comes from a span
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
                input={"input": "example-1-version-1-input"},
                output={"output": "example-1-version-1-output"},
                metadata_={"metadata": "example-1-version-1-metadata"},
                revision_kind="CREATE",
            )
        )
        await session.execute(
            insert(models.DatasetExampleRevision).values(
                dataset_example_id=example_2_id,
                dataset_version_id=version_id,
                input={"input": "example-2-version-1-input"},
                output={"output": "example-2-version-1-output"},
                metadata_={"metadata": "example-2-version-1-metadata"},
                revision_kind="CREATE",
            )
        )


@pytest.fixture
async def example_with_experiment_runs(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and two experiments that use the example in
    their runs.
    """
    async with db() as session:
        # insert dataset
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(
                name="dataset-name",
                description=None,
                metadata_={},
            )
        )

        # insert example
        example_id = await session.scalar(
            insert(models.DatasetExample)
            .values(
                dataset_id=dataset_id,
            )
            .returning(models.DatasetExample.id)
        )

        # insert version
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(
                dataset_id=dataset_id,
                description="original-description",
                metadata_={"metadata": "original-metadata"},
            )
        )

        # insert revision
        await session.scalar(
            insert(models.DatasetExampleRevision)
            .returning(models.DatasetExampleRevision.id)
            .values(
                dataset_example_id=example_id,
                dataset_version_id=version_id,
                input={"input": "first-input"},
                output={"output": "first-output"},
                metadata_={"metadata": "first-metadata"},
                revision_kind="CREATE",
            )
        )

        # insert an experiment
        experiment_1_id = await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-1",
                description="experiment-1-description",
                repetitions=1,
                metadata_={"metadata": "experiment-1-metadata"},
            )
        )

        # insert an experiment run on the example
        await session.execute(
            insert(models.ExperimentRun).values(
                experiment_id=experiment_1_id,
                dataset_example_id=example_id,
                output={"task_output": "experiment-1-run-1-output"},
                repetition_number=1,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc),
            )
        )

        # insert a second experiment
        experiment_2_id = await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-2",
                description="experiment-2-description",
                repetitions=1,
                metadata_={"metadata": "experiment-2-metadata"},
            )
        )

        # insert another run on the example
        await session.execute(
            insert(models.ExperimentRun).values(
                experiment_id=experiment_2_id,
                dataset_example_id=example_id,
                output={"task_output": {"output": "experiment-2-run-1-output"}},
                repetition_number=1,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc),
            )
        )
