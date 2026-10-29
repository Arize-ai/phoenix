from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_average_latency_ms_resolves_to_float(
    gql_client: AsyncGraphQLClient,
    experiment_with_repeated_runs: int,
) -> None:
    query = """
      query ($baseExperimentId: ID!) {
        compareExperiments(baseExperimentId: $baseExperimentId, compareExperimentIds: []) {
          edges {
            node {
              repeatedRunGroups {
                averageLatencyMs
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "baseExperimentId": str(GlobalID("Experiment", str(experiment_with_repeated_runs))),
        },
    )
    assert not response.errors
    assert response.data == {
        "compareExperiments": {
            "edges": [{"node": {"repeatedRunGroups": [{"averageLatencyMs": 2000.0}]}}]
        }
    }


@pytest.fixture
async def experiment_with_repeated_runs(db: DbSessionFactory) -> int:
    """
    Creates an experiment with one example and two repetitions taking 1.5s and 2.5s.
    """
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).returning(models.Dataset.id).values(name="dataset", metadata_={})
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(dataset_id=dataset_id, metadata_={})
        )
        example_id = await session.scalar(
            insert(models.DatasetExample)
            .returning(models.DatasetExample.id)
            .values(dataset_id=dataset_id)
        )
        revision_id = await session.scalar(
            insert(models.DatasetExampleRevision)
            .returning(models.DatasetExampleRevision.id)
            .values(
                dataset_example_id=example_id,
                dataset_version_id=version_id,
                input={},
                output={},
                metadata_={},
                revision_kind="CREATE",
            )
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment",
                repetitions=2,
                metadata_={},
            )
        )
        await session.execute(
            insert(models.ExperimentDatasetExample).values(
                experiment_id=experiment_id,
                dataset_example_id=example_id,
                dataset_example_revision_id=revision_id,
            )
        )
        start_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
        await session.execute(
            insert(models.ExperimentRun).values(
                [
                    {
                        "experiment_id": experiment_id,
                        "dataset_example_id": example_id,
                        "repetition_number": repetition_number,
                        "output": {"task_output": repetition_number},
                        "start_time": start_time,
                        "end_time": start_time + timedelta(milliseconds=latency_ms),
                    }
                    for repetition_number, latency_ms in ((1, 1500), (2, 2500))
                ]
            )
        )
    assert experiment_id is not None
    return experiment_id
