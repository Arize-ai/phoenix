from datetime import datetime, timedelta
from typing import NamedTuple

import pytest
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.ExperimentJob import ExperimentJob
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient

QUERY = """
  query ($jobId: ID!) {
    node(id: $jobId) {
      ... on ExperimentJob {
        lastError {
          message
          level
        }
        errors {
          edges {
            node {
              message
              level
            }
          }
        }
      }
    }
  }
"""


class ExperimentWithLogs(NamedTuple):
    experiment_id: int


@pytest.fixture
async def experiment_with_logs(db: DbSessionFactory) -> ExperimentWithLogs:
    """Create a dataset, experiment, experiment_job, and several experiment logs."""
    t0 = datetime.fromisoformat("2024-01-01T00:00:00+00:00")
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset).values(name="ds", metadata_={}).returning(models.Dataset.id)
        )
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .values(dataset_id=dataset_id, metadata_={})
            .returning(models.DatasetVersion.id)
        )
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="exp1",
                repetitions=1,
                metadata_={},
            )
            .returning(models.Experiment.id)
        )
        await session.execute(
            insert(models.ExperimentJob).values(
                id=experiment_id,
                type="PROMPT",
                status="COMPLETED",
            )
        )
        # Three ERROR logs at different times, plus one INFO log that is newest.
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0,
                category="EXPERIMENT",
                level="ERROR",
                message="old error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=2),
                category="EXPERIMENT",
                level="ERROR",
                message="newest error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=1),
                category="EXPERIMENT",
                level="ERROR",
                message="middle error",
            )
        )
        await session.execute(
            insert(models.ExperimentLog).values(
                experiment_id=experiment_id,
                occurred_at=t0 + timedelta(hours=10),
                category="EXPERIMENT",
                level="INFO",
                message="info log that is newest overall",
            )
        )
        await session.commit()
    assert experiment_id is not None
    return ExperimentWithLogs(experiment_id=experiment_id)


async def test_experiment_job_last_error_and_errors(
    gql_client: AsyncGraphQLClient,
    experiment_with_logs: ExperimentWithLogs,
) -> None:
    job_id = str(
        GlobalID(type_name=ExperimentJob.__name__, node_id=str(experiment_with_logs.experiment_id))
    )
    response = await gql_client.execute(query=QUERY, variables={"jobId": job_id})
    assert not response.errors
    assert response.data is not None
    node = response.data["node"]

    # lastError should be the most recent ERROR, ignoring the newer INFO log
    assert node["lastError"] == {"message": "newest error", "level": "ERROR"}

    # errors should return only ERROR-level logs, most recent first
    messages = [edge["node"]["message"] for edge in node["errors"]["edges"]]
    assert messages == ["newest error", "middle error", "old error"]
    for edge in node["errors"]["edges"]:
        assert edge["node"]["level"] == "ERROR"
