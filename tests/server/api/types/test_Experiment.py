from datetime import datetime
from typing import List

import pytest
import pytz
from phoenix.db import models
from phoenix.server.api.types.Experiment import Experiment
from sqlalchemy import insert
from strawberry.relay import GlobalID


async def test_experiment_resolver_returns_sequence_number(
    test_client,
    dataset_with_interlaced_experiments,
):
    query = """
      query ($experimentId: GlobalID!) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            sequenceNumber
            id
          }
        }
      }
    """
    node_id = str(dataset_with_interlaced_experiments[8])
    experiment_id = str(GlobalID(type_name=Experiment.__name__, node_id=node_id))
    variables = {"experimentId": experiment_id}
    response = await test_client.post("/graphql", json={"query": query, "variables": variables})
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    assert response_json["data"] == {
        "experiment": {"sequenceNumber": 3, "id": str(GlobalID(Experiment.__name__, str(9)))}
    }


async def test_runs_resolver_returns_runs_for_experiment(test_client, dataset_with_experiment_runs):
    query = """
      query ($experimentId: GlobalID!) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            runs {
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
    response = await test_client.post(
        "/graphql",
        json={
            "query": query,
            "variables": {
                "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json["data"] == {
        "experiment": {
            "runs": {
                "edges": [
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(1))),
                            "traceId": None,
                            "output": {"run-1-output-key": "run-1-output-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(2))),
                            "traceId": "trace-id",
                            "output": {"run-2-output-key": "run-2-output-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(3))),
                            "traceId": None,
                            "output": {"run-3-output-key": "run-3-output-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                ]
            }
        }
    }


@pytest.fixture
async def dataset_with_interlaced_experiments(session) -> List[int]:
    dataset_ids = list(
        await session.scalars(
            insert(models.Dataset).returning(models.Dataset.id),
            [{"name": f"{i}", "metadata_": {}} for i in range(3)],
        )
    )
    dataset_version_ids = {
        dataset_id: dataset_version_id
        for dataset_id, dataset_version_id in await session.execute(
            insert(models.DatasetVersion).returning(
                models.DatasetVersion.dataset_id,
                models.DatasetVersion.id,
            ),
            [{"dataset_id": dataset_id, "metadata_": {}} for dataset_id in dataset_ids],
        )
    }
    return list(
        await session.scalars(
            insert(models.Experiment).returning(models.Experiment.id),
            [
                {
                    "dataset_id": dataset_id,
                    "dataset_version_id": dataset_version_ids[dataset_id],
                    "metadata_": {},
                }
                for _ in range(3)
                for dataset_id in dataset_ids
            ],
        )
    )


@pytest.fixture
async def dataset_with_experiment_runs(session):
    """
    A dataset with an associated experiment with three runs: one that has no
    associated trace, one that has an associated trace, and one that has a
    non-existent trace.
    """

    # insert project
    project_id = await session.scalar(
        insert(models.Project).values(name="project-name").returning(models.Project.id)
    )

    # insert trace
    await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="trace-id",
            project_rowid=project_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )

    # insert dataset
    dataset_id = await session.scalar(
        insert(models.Dataset)
        .returning(models.Dataset.id)
        .values(
            name="dataset-name",
            description="dataset-description",
            metadata_={"dataset-metadata-key": "dataset-metadata-value"},
        )
    )

    # insert example
    example_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
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

    # insert experiment
    experiment_id = await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_id,
            description="experiment-description",
            metadata_={"experiment-metadata-key": "experiment-metadata-value"},
        )
    )

    # insert experiment run without associated trace
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=experiment_id,
            dataset_example_id=example_id,
            output={"run-1-output-key": "run-1-output-value"},
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
    )

    # insert experiment run with associated trace
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=experiment_id,
            dataset_example_id=example_id,
            output={"run-2-output-key": "run-2-output-value"},
            trace_id="trace-id",
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
    )

    # insert experiment run with non-existent trace
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=experiment_id,
            dataset_example_id=example_id,
            output={"run-3-output-key": "run-3-output-value"},
            trace_id="non-existent-trace-id",
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
    )
