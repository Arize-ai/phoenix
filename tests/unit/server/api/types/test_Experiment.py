from datetime import datetime
from statistics import mean
from typing import Any

import pytest
import pytz
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
                                        "meanScore": 3 / 4,
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
                        "minScore": 0.0,
                        "maxScore": 1.0,
                        "meanScore": 1 / 2,
                        "count": 8,
                        "errorCount": 0,
                    },
                    {
                        "annotationName": "annotation-name-2",
                        "minScore": 0.0,
                        "maxScore": 1.0,
                        "meanScore": 3 / 4,
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
        project = models.Project(name="project-name")
        session.add(project)
        await session.flush()

        trace = models.Trace(
            trace_id="trace-id",
            project_rowid=project.id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        session.add(trace)

        dataset = models.Dataset(
            name="dataset-name",
            description="dataset-description",
            metadata_={"dataset-metadata-key": "dataset-metadata-value"},
        )
        session.add(dataset)
        await session.flush()

        example = models.DatasetExample(
            dataset_id=dataset.id,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(example)
        await session.flush()

        version = models.DatasetVersion(
            dataset_id=dataset.id,
            description="original-description",
            metadata_={"metadata": "original-metadata"},
        )
        session.add(version)
        await session.flush()

        revision = models.DatasetExampleRevision(
            dataset_example_id=example.id,
            dataset_version_id=version.id,
            input={"input": "first-input"},
            output={"output": "first-output"},
            metadata_={"metadata": "first-metadata"},
            revision_kind="CREATE",
        )
        session.add(revision)
        await session.flush()

        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=version.id,
            name="experiment-name",
            description="experiment-description",
            repetitions=3,
            metadata_={"experiment-metadata-key": "experiment-metadata-value"},
        )
        session.add(experiment)
        await session.flush()

        experiment_run_without_trace = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=example.id,
            output={"task_output": "run-1-output-value"},
            repetition_number=1,
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(experiment_run_without_trace)

        experiment_run_with_trace = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=example.id,
            output={"task_output": {"run-2-output-key": "run-2-output-value"}},
            trace_id="trace-id",
            repetition_number=2,
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(experiment_run_with_trace)

        experiment_run_with_missing_trace = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=example.id,
            output={"task_output": 12345},
            trace_id="non-existent-trace-id",
            repetition_number=3,
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(experiment_run_with_missing_trace)
        await session.flush()


@pytest.fixture
async def experiments_with_runs_and_annotations(
    db: DbSessionFactory,
) -> None:
    """
    Inserts three experiments, two with runs and annotations and one without.

    Experiment | Dataset example | Repetition | annotation-name-1 | annotation-name-2 | annotation-name-3
    ---------- | --------------- | ---------- | ----------------- | ----------------- | -----------------
    1          | 1               | 1          | 1                 | 0                 | --
    1          | 1               | 2          | 1                 | 1                 | --
    1          | 1               | 3          | 0                 | --                | --
    1          | 2               | 1          | 0                 | failed            | --
    1          | 2               | 2          | 0                 | 1                 | --
    1          | 2               | 3          | 0                 | --                | --
    2          | 1               | 1          | 1                 | --                | failed
    2          | 1               | 2          | --                | --                | failed
    2          | 2               | 1          | 1                 | --                | failed
    2          | 2               | 2          | --                | --                | failed
    3          | --              | --         | --                | --                | --

    """
    async with db() as session:
        dataset = models.Dataset(
            name="dataset-name",
            description="dataset-description",
            metadata_={"dataset-metadata-key": "dataset-metadata-value"},
        )
        session.add(dataset)
        await session.flush()

        examples = [
            models.DatasetExample(
                dataset_id=dataset.id,
                created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            )
            for _ in range(2)
        ]
        session.add_all(examples)
        await session.flush()

        version = models.DatasetVersion(
            dataset_id=dataset.id,
            description="version-description",
            metadata_={},
        )
        session.add(version)
        await session.flush()

        revisions = [
            models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=version.id,
                input={"input": "input"},
                output={"output": "output"},
                metadata_={"metadata": "metadata"},
                revision_kind="CREATE",
            )
            for example in examples
        ]
        session.add_all(revisions)

        experiments = [
            models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name="experiment-name",
                description="experiment-description",
                repetitions=1,
                metadata_={},
            )
            for _ in range(3)
        ]
        session.add_all(experiments)
        await session.flush()

        first_experiment_runs = [
            models.ExperimentRun(
                experiment_id=experiments[0].id,
                dataset_example_id=example.id,
                output={"output-key": "output-value"},
                repetition_number=repetition_number,
                start_time=datetime(
                    year=2020,
                    month=1,
                    day=1,
                    hour=0,
                    minute=0,
                    second=0,
                    tzinfo=pytz.utc,
                ),
                end_time=datetime(
                    year=2020,
                    month=1,
                    day=1,
                    hour=0,
                    minute=0,
                    second=repetition_number,
                    tzinfo=pytz.utc,
                ),
            )
            for example in examples
            for repetition_number in range(1, 4)
        ]
        session.add_all(first_experiment_runs)
        await session.flush()

        second_experiment_runs = [
            models.ExperimentRun(
                experiment_id=experiments[1].id,
                dataset_example_id=example.id,
                output={"output-key": "output-value"},
                repetition_number=repetition_number,
                start_time=datetime(
                    year=2020,
                    month=1,
                    day=1,
                    hour=0,
                    minute=0,
                    second=0,
                    tzinfo=pytz.utc,
                ),
                end_time=datetime(
                    year=2020,
                    month=1,
                    day=1,
                    hour=0,
                    minute=0,
                    second=repetition_number,
                    tzinfo=pytz.utc,
                ),
            )
            for example in examples
            for repetition_number in range(1, 3)
        ]
        session.add_all(second_experiment_runs)
        await session.flush()

        first_experiment_annotation_name_1_annotations = [
            models.ExperimentRunAnnotation(
                experiment_run_id=run.id,
                name="annotation-name-1",
                annotator_kind="CODE",
                label=f"label-{score}",
                score=score,
                explanation="explanation",
                trace_id=None,
                error=None,
                metadata_={},
                start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
            )
            for run, score in zip(first_experiment_runs, [1, 1, 0, 0, 0, 0])
        ]
        first_experiment_annotation_name_2_annotations = (
            [
                models.ExperimentRunAnnotation(
                    experiment_run_id=run.id,
                    name="annotation-name-2",
                    annotator_kind="CODE",
                    label=f"label-{score}",
                    score=score,
                    explanation="explanation",
                    trace_id=None,
                    error=None,
                    metadata_={},
                    start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                )
                for run, score in zip(first_experiment_runs[:2], [0, 1])
            ]
            + [
                models.ExperimentRunAnnotation(
                    experiment_run_id=first_experiment_runs[3].id,
                    name="annotation-name-2",
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    trace_id=None,
                    error="failed",
                    metadata_={},
                    start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                )
            ]
            + [
                models.ExperimentRunAnnotation(
                    experiment_run_id=first_experiment_runs[4].id,
                    name="annotation-name-2",
                    annotator_kind="CODE",
                    label=None,
                    score=1,
                    explanation=None,
                    trace_id=None,
                    error=None,
                    metadata_={},
                    start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                )
            ]
        )
        second_experiment_annotation_name_1_annotations = [
            models.ExperimentRunAnnotation(
                experiment_run_id=run.id,
                name="annotation-name-1",
                annotator_kind="CODE",
                label=f"label-{score}",
                score=score,
                explanation="explanation",
                trace_id=None,
                error=None,
                metadata_={},
                start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
            )
            for run, score in zip([second_experiment_runs[0], second_experiment_runs[2]], [1, 1])
        ]
        second_experiment_annotation_name_3_annotations = [
            models.ExperimentRunAnnotation(
                experiment_run_id=run.id,
                name="annotation-name-3",
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                trace_id=None,
                error="failed",
                metadata_={},
                start_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                end_time=datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
            )
            for run in second_experiment_runs
        ]
        session.add_all(first_experiment_annotation_name_1_annotations)
        session.add_all(first_experiment_annotation_name_2_annotations)
        session.add_all(second_experiment_annotation_name_1_annotations)
        session.add_all(second_experiment_annotation_name_3_annotations)
        await session.flush()


@pytest.fixture
async def experiments_with_runs(db: DbSessionFactory) -> None:
    """
    Inserts two experiments, the first of which contains one errored run and the
    second of which is empty (i.e., has no runs).
    """
    async with db() as session:
        dataset = models.Dataset(
            name="dataset-name",
            description="dataset-description",
            metadata_={"dataset-metadata-key": "dataset-metadata-value"},
        )
        session.add(dataset)
        await session.flush()

        examples = [
            models.DatasetExample(
                dataset_id=dataset.id,
                created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            )
            for _ in range(2)
        ]
        session.add_all(examples)
        await session.flush()

        version = models.DatasetVersion(
            dataset_id=dataset.id,
            description="version-description",
            metadata_={},
        )
        session.add(version)
        await session.flush()

        revisions = [
            models.DatasetExampleRevision(
                dataset_example_id=example.id,
                dataset_version_id=version.id,
                input={"input": "input"},
                output={"output": "output"},
                metadata_={"metadata": "metadata"},
                revision_kind="CREATE",
            )
            for example in examples
        ]
        session.add_all(revisions)
        await session.flush()

        experiments = [
            models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name="experiment-name",
                description="experiment-description",
                repetitions=1,
                metadata_={},
            )
            for _ in range(2)
        ]
        session.add_all(experiments)
        await session.flush()

        experiment_runs = [
            models.ExperimentRun(
                error="failed",
                experiment_id=experiments[0].id,
                dataset_example_id=examples[0].id,
                output={"output-key-test": "output-value"},
                repetition_number=1,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            ),
            models.ExperimentRun(
                error=None,
                experiment_id=experiments[0].id,
                dataset_example_id=examples[1].id,
                output={"output-key": "output-value"},
                repetition_number=1,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            ),
        ]
        session.add_all(experiment_runs)
        await session.flush()
