from datetime import datetime
from statistics import mean
from typing import Any

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_experiment_resolver_returns_sequence_number(
    gql_client: AsyncGraphQLClient,
    interlaced_experiments: list[int],
) -> None:
    query = """
      query ($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            sequenceNumber
            id
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "experimentId": str(
                GlobalID(type_name=Experiment.__name__, node_id=str(interlaced_experiments[5]))
            ),
        },
    )
    assert not response.errors
    assert response.data == {
        "experiment": {"sequenceNumber": 2, "id": str(GlobalID(Experiment.__name__, str(6)))},
    }


async def test_runs_resolver_returns_runs_for_experiment(
    gql_client: AsyncGraphQLClient,
    dataset_with_experiment_runs: Any,
) -> None:
    query = """
      query ($experimentId: ID!) {
        experiment: node(id: $experimentId) {
          ... on Experiment {
            runs {
              edges {
                run: node {
                  id
                  experimentId
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
        variables={
            "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
        },
    )
    assert not response.errors
    assert response.data == {
        "experiment": {
            "runs": {
                "edges": [
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(3))),
                            "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "traceId": None,
                            "output": 12345,
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(2))),
                            "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "traceId": "trace-id",
                            "output": {"run-2-output-key": "run-2-output-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(1))),
                            "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "traceId": None,
                            "output": "run-1-output-value",
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                ]
            }
        }
    }


async def test_run_count_resolver_returns_correct_counts(
    gql_client: AsyncGraphQLClient,
    experiments_with_runs_and_annotations: Any,
) -> None:
    query = """
      query ($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                experiment: node {
                  id
                  runCount
                }
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
        },
    )
    assert not response.errors
    assert response.data == {
        "dataset": {
            "experiments": {
                "edges": [
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(3))),
                            "runCount": 0,
                        }
                    },
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                            "runCount": 4,
                        }
                    },
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "runCount": 6,
                        }
                    },
                ]
            },
        }
    }


async def test_average_run_latency_resolver_returns_correct_values(
    gql_client: AsyncGraphQLClient,
    experiments_with_runs_and_annotations: Any,
) -> None:
    query = """
      query ($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                experiment: node {
                  id
                  averageRunLatencyMs
                }
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
        },
    )
    assert not response.errors
    assert response.data == {
        "dataset": {
            "experiments": {
                "edges": [
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(3))),
                            "averageRunLatencyMs": None,
                        }
                    },
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                            "averageRunLatencyMs": mean((1, 2)) * 1000,
                        }
                    },
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "averageRunLatencyMs": mean((1, 2, 3)) * 1000,
                        }
                    },
                ]
            },
        }
    }


class TestExperimentAnnotationSummaries:
    async def test_experiment_resolver_returns_expected_values(
        self,
        gql_client: AsyncGraphQLClient,
        experiments_with_runs_and_annotations: Any,
    ) -> None:
        query = """
          query ($datasetId: ID!) {
            dataset: node(id: $datasetId) {
              ... on Dataset {
                experiments {
                  edges {
                    experiment: node {
                      id
                      annotationSummaries {
                        annotationName
                        minScore
                        maxScore
                        meanScore
                        count
                        errorCount
                      }
                    }
                  }
                }
              }
            }
          }
        """
        response = await gql_client.execute(
            query=query,
            variables={
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
            },
        )
        assert not response.errors
        assert response.data == {
            "dataset": {
                "experiments": {
                    "edges": [
                        {
                            "experiment": {
                                "id": str(GlobalID(type_name="Experiment", node_id=str(3))),
                                "annotationSummaries": [],
                            }
                        },
                        {
                            "experiment": {
                                "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                                "annotationSummaries": [
                                    {
                                        "annotationName": "annotation-name-1",
                                        "minScore": 1.0,
                                        "maxScore": 1.0,
                                        "meanScore": 1.0,
                                        "count": 2,
                                        "errorCount": 0,
                                    },
                                    {
                                        "annotationName": "annotation-name-3",
                                        "minScore": None,
                                        "maxScore": None,
                                        "meanScore": None,
                                        "count": 4,
                                        "errorCount": 4,
                                    },
                                ],
                            }
                        },
                        {
                            "experiment": {
                                "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                                "annotationSummaries": [
                                    {
                                        "annotationName": "annotation-name-1",
                                        "minScore": 0.0,
                                        "maxScore": 1.0,
                                        "meanScore": 1 / 3,
                                        "count": 6,
                                        "errorCount": 0,
                                    },
                                    {
                                        "annotationName": "annotation-name-2",
                                        "minScore": 0.0,
                                        "maxScore": 1.0,
                                        "meanScore": 2 / 3,
                                        "count": 4,
                                        "errorCount": 1,
                                    },
                                ],
                            }
                        },
                    ]
                },
            }
        }

    async def test_dataset_resolver_returns_expected_values(
        self,
        gql_client: AsyncGraphQLClient,
        experiments_with_runs_and_annotations: Any,
    ) -> None:
        query = """
          query ($datasetId: ID!) {
            dataset: node(id: $datasetId) {
              ... on Dataset {
                experimentAnnotationSummaries {
                  annotationName
                  minScore
                  maxScore
                  meanScore
                  count
                  errorCount
                }
              }
            }
          }
        """
        response = await gql_client.execute(
            query=query,
            variables={
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
            },
        )
        assert not response.errors
        assert response.data == {
            "dataset": {
                "experimentAnnotationSummaries": [
                    {
                        "annotationName": "annotation-name-1",
                        "minScore": 0,
                        "maxScore": 1,
                        "meanScore": 1 / 2,
                        "count": 8,
                        "errorCount": 0,
                    },
                    {
                        "annotationName": "annotation-name-2",
                        "minScore": 0,
                        "maxScore": 1,
                        "meanScore": 2 / 3,
                        "count": 4,
                        "errorCount": 1,
                    },
                    {
                        "annotationName": "annotation-name-3",
                        "minScore": None,
                        "maxScore": None,
                        "meanScore": None,
                        "count": 4,
                        "errorCount": 4,
                    },
                ],
            }
        }


async def test_error_rate_returns_expected_values(
    gql_client: AsyncGraphQLClient,
    experiments_with_runs: Any,
) -> None:
    query = """
      query ($datasetId: ID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                experiment: node {
                  id
                  errorRate
                }
              }
            }
          }
        }
      }
    """
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
        },
    )
    assert not response.errors
    assert response.data == {
        "dataset": {
            "experiments": {
                "edges": [
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                            "errorRate": None,
                        }
                    },
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "errorRate": 1 / 2,
                        }
                    },
                ]
            },
        }
    }


@pytest.fixture
async def dataset_with_experiment_runs(db: DbSessionFactory) -> None:
    """
    A dataset with an associated experiment with three runs: one that has no
    associated trace, one that has an associated trace, and one that has a
    non-existent trace.
    """
    async with db() as session:
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
                name="experiment-name",
                description="experiment-description",
                repetitions=3,
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
                output={"task_output": "run-1-output-value"},
                repetition_number=1,
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
                output={"task_output": {"run-2-output-key": "run-2-output-value"}},
                trace_id="trace-id",
                repetition_number=2,
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
                output={"task_output": 12345},
                trace_id="non-existent-trace-id",
                repetition_number=3,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            )
        )


@pytest.fixture
async def experiments_with_runs_and_annotations(
    db: DbSessionFactory,
) -> None:
    """
    Inserts three experiments, two with runs and annotations and one without.
    """
    async with db() as session:
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

        # insert examples
        example_ids = (
            await session.scalars(
                insert(models.DatasetExample)
                .values(
                    [
                        {
                            "dataset_id": dataset_id,
                            "created_at": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                        }
                        for _ in range(2)
                    ]
                )
                .returning(models.DatasetExample.id)
            )
        ).all()

        # insert version
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(
                dataset_id=dataset_id,
                description="version-description",
                metadata_={},
            )
        )

        # insert revisions
        await session.scalars(
            insert(models.DatasetExampleRevision)
            .returning(models.DatasetExampleRevision.id)
            .values(
                [
                    {
                        "dataset_example_id": example_id,
                        "dataset_version_id": version_id,
                        "input": {"input": "input"},
                        "output": {"output": "output"},
                        "metadata_": {"metadata": "metadata"},
                        "revision_kind": "CREATE",
                    }
                    for example_id in example_ids
                ]
            )
        )

        # insert experiments
        experiment_ids = (
            await session.scalars(
                insert(models.Experiment)
                .returning(models.Experiment.id)
                .values(
                    [
                        {
                            "dataset_id": dataset_id,
                            "dataset_version_id": version_id,
                            "name": "experiment-name",
                            "description": "experiment-description",
                            "repetitions": 1,
                            "metadata_": {},
                        }
                        for _ in range(3)
                    ]
                )
            )
        ).all()

        # insert experiment runs
        run_ids = (
            await session.scalars(
                insert(models.ExperimentRun)
                .returning(models.ExperimentRun.id)
                .values(
                    [
                        # experiment 1 (three repetitions)
                        *[
                            {
                                "experiment_id": experiment_ids[0],
                                "dataset_example_id": example_id,
                                "output": {"output-key": "output-value"},
                                "repetition_number": repetition_number,
                                "start_time": datetime(
                                    year=2020,
                                    month=1,
                                    day=1,
                                    hour=0,
                                    minute=0,
                                    second=0,
                                    tzinfo=pytz.utc,
                                ),
                                "end_time": datetime(
                                    year=2020,
                                    month=1,
                                    day=1,
                                    hour=0,
                                    minute=0,
                                    second=repetition_number,
                                    tzinfo=pytz.utc,
                                ),
                            }
                            for repetition_number in range(1, 4)
                            for example_id in example_ids
                        ],
                        # experiment 2 (two repetitions)
                        *[
                            {
                                "experiment_id": experiment_ids[1],
                                "dataset_example_id": example_id,
                                "output": {"output-key": "output-value"},
                                "repetition_number": repetition_number,
                                "start_time": datetime(
                                    year=2020,
                                    month=1,
                                    day=1,
                                    hour=0,
                                    minute=0,
                                    second=0,
                                    tzinfo=pytz.utc,
                                ),
                                "end_time": datetime(
                                    year=2020,
                                    month=1,
                                    day=1,
                                    hour=0,
                                    minute=0,
                                    second=repetition_number,
                                    tzinfo=pytz.utc,
                                ),
                            }
                            for repetition_number in range(1, 3)
                            for example_id in example_ids
                        ],
                        # experiment 3 (no runs)
                    ]
                )
            )
        ).all()

        # insert experiment annotations
        await session.scalar(
            insert(models.ExperimentRunAnnotation)
            .returning(models.ExperimentRunAnnotation.id)
            .values(
                [
                    # experiment 1, annotation-name-1
                    *[
                        {
                            "experiment_run_id": run_id,
                            "name": "annotation-name-1",
                            "annotator_kind": "CODE",
                            "label": f"label-{score}",
                            "score": score,
                            "explanation": "explanation",
                            "trace_id": None,
                            "error": None,
                            "metadata_": {},
                            "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                            "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                        }
                        for run_id, score in zip(run_ids[:6], [1, 0, 1, 0, 0, 0])
                    ],
                    # experiment 1, annotation-name-2
                    *[
                        {
                            "experiment_run_id": run_id,
                            "name": "annotation-name-2",
                            "annotator_kind": "CODE",
                            "label": f"label-{score}",
                            "score": score,
                            "explanation": "explanation",
                            "trace_id": None,
                            "error": None,
                            "metadata_": {},
                            "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                            "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                        }
                        for run_id, score in zip(run_ids[:3], [0, 1, 1])
                    ],
                    {
                        "experiment_run_id": run_ids[4],
                        "name": "annotation-name-2",
                        "annotator_kind": "CODE",
                        "label": None,
                        "score": None,
                        "explanation": None,
                        "trace_id": None,
                        "error": "failed",
                        "metadata_": {},
                        "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                        "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    },
                    # experiment 2, annotation-name-1
                    *[
                        {
                            "experiment_run_id": run_id,
                            "name": "annotation-name-1",
                            "annotator_kind": "CODE",
                            "label": f"label-{score}",
                            "score": score,
                            "explanation": "explanation",
                            "trace_id": None,
                            "error": None,
                            "metadata_": {},
                            "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                            "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                        }
                        for run_id, score in zip(run_ids[6:8], [1, 1])
                    ],
                    # experiment 2, annotation-name-3
                    *[
                        {
                            "experiment_run_id": run_id,
                            "name": "annotation-name-3",
                            "annotator_kind": "CODE",
                            "label": None,
                            "score": None,
                            "explanation": None,
                            "trace_id": None,
                            "error": "failed",
                            "metadata_": {},
                            "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                            "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                        }
                        for run_id in run_ids[6:]
                    ],
                ]
            )
        )


@pytest.fixture
async def experiments_with_runs(db: DbSessionFactory) -> None:
    """
    Inserts two experiments, the first of which contains one errored run and the
    second of which is empty (i.e., has no runs).
    """
    async with db() as session:
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

        # insert examples
        example_ids = (
            await session.scalars(
                insert(models.DatasetExample)
                .values(
                    [
                        {
                            "dataset_id": dataset_id,
                            "created_at": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                        }
                        for _ in range(2)
                    ]
                )
                .returning(models.DatasetExample.id)
            )
        ).all()

        # insert version
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(
                dataset_id=dataset_id,
                description="version-description",
                metadata_={},
            )
        )

        # insert revisions
        await session.scalars(
            insert(models.DatasetExampleRevision)
            .returning(models.DatasetExampleRevision.id)
            .values(
                [
                    {
                        "dataset_example_id": example_id,
                        "dataset_version_id": version_id,
                        "input": {"input": "input"},
                        "output": {"output": "output"},
                        "metadata_": {"metadata": "metadata"},
                        "revision_kind": "CREATE",
                    }
                    for example_id in example_ids
                ]
            )
        )

        # insert experiments
        experiment_ids = (
            await session.scalars(
                insert(models.Experiment)
                .returning(models.Experiment.id)
                .values(
                    [
                        {
                            "dataset_id": dataset_id,
                            "dataset_version_id": version_id,
                            "name": "experiment-name",
                            "description": "experiment-description",
                            "repetitions": 1,
                            "metadata_": {},
                        }
                        for _ in range(2)
                    ]
                )
            )
        ).all()

        # insert experiment runs
        (
            await session.scalars(
                insert(models.ExperimentRun)
                .returning(models.ExperimentRun.id)
                .values(
                    [
                        {
                            "error": "failed",
                            "experiment_id": experiment_ids[0],
                            "dataset_example_id": example_ids[0],
                            "output": {"output-key-test": "output-value"},
                            "repetition_number": 1,
                            "start_time": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                            "end_time": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                        },
                        {
                            "error": None,
                            "experiment_id": experiment_ids[0],
                            "dataset_example_id": example_ids[1],
                            "output": {"output-key": "output-value"},
                            "repetition_number": 1,
                            "start_time": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                            "end_time": datetime(
                                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                            ),
                        },
                    ]
                )
            )
        ).all()
