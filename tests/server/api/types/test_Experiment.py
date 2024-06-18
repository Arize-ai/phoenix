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
    interlaced_experiments: List[int],
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
    variables = {
        "experimentId": str(
            GlobalID(type_name=Experiment.__name__, node_id=str(interlaced_experiments[5]))
        ),
    }
    response = await test_client.post("/graphql", json={"query": query, "variables": variables})
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    assert response_json["data"] == {
        "experiment": {"sequenceNumber": 2, "id": str(GlobalID(Experiment.__name__, str(6)))},
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
    assert response_json.get("errors") is None
    assert response_json["data"] == {
        "experiment": {
            "runs": {
                "edges": [
                    {
                        "run": {
                            "id": str(GlobalID(type_name="ExperimentRun", node_id=str(3))),
                            "experimentId": str(GlobalID(type_name="Experiment", node_id=str(1))),
                            "traceId": None,
                            "output": {"run-3-output-key": "run-3-output-value"},
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
                            "output": {"run-1-output-key": "run-1-output-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:00:00+00:00",
                            "error": None,
                        }
                    },
                ]
            }
        }
    }


async def test_annotation_summaries_and_names_return_expected_values(
    test_client, experiments_with_runs_and_annotations
) -> None:
    query = """
      query ($datasetId: GlobalID!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            experimentAnnotationNames
            experiments {
              edges {
                experiment: node {
                  id
                  annotationSummaries {
                    annotationName
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
    response = await test_client.post(
        "/graphql",
        json={
            "query": query,
            "variables": {
                "datasetId": str(GlobalID(type_name="Dataset", node_id=str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    assert response_json["data"] == {
        "dataset": {
            "experimentAnnotationNames": [
                "annotation-name-1",
                "annotation-name-2",
                "annotation-name-3",
            ],
            "experiments": {
                "edges": [
                    {
                        "experiment": {
                            "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                            "annotationSummaries": [
                                {
                                    "annotationName": "annotation-name-3",
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
                                    "meanScore": 1 / 3,
                                    "count": 6,
                                    "errorCount": 0,
                                },
                                {
                                    "annotationName": "annotation-name-2",
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
            output={"run-1-output-key": "run-1-output-value"},
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
            output={"run-2-output-key": "run-2-output-value"},
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
            output={"run-3-output-key": "run-3-output-value"},
            trace_id="non-existent-trace-id",
            repetition_number=3,
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
    )


@pytest.fixture
async def experiments_with_runs_and_annotations(session):
    """
    Inserts two experiments, each with runs and annotations.
    """
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
    run_ids = (
        await session.scalars(
            insert(models.ExperimentRun)
            .returning(models.ExperimentRun.id)
            .values(
                [
                    {
                        "experiment_id": experiment_id,
                        "dataset_example_id": example_id,
                        "output": {"output-key": "output-value"},
                        "repetition_number": 1,
                        "start_time": datetime(
                            year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                        ),
                        "end_time": datetime(
                            year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                        ),
                    }
                    for experiment_id in experiment_ids
                    for example_id in example_ids
                ]
            )
        )
    ).all()

    # insert experiment annotations
    await session.scalar(
        insert(models.ExperimentAnnotation)
        .returning(models.ExperimentAnnotation.id)
        .values(
            [
                # experiment 1, annotation-name-1 (three repetitions)
                {
                    "experiment_run_id": run_ids[0],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-1",
                    "score": 1,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[0],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-0",
                    "score": 0,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[0],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-1",
                    "score": 1,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[1],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-0",
                    "score": 0,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[1],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-0",
                    "score": 0,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[1],
                    "name": "annotation-name-1",
                    "annotator_kind": "CODE",
                    "label": "label-0",
                    "score": 0,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                # experiment 1, annotation-name-2 (two repetitions)
                {
                    "experiment_run_id": run_ids[0],
                    "name": "annotation-name-2",
                    "annotator_kind": "CODE",
                    "label": "label-0",
                    "score": 0,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[0],
                    "name": "annotation-name-2",
                    "annotator_kind": "CODE",
                    "label": "label-1",
                    "score": 1,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[1],
                    "name": "annotation-name-2",
                    "annotator_kind": "CODE",
                    "label": "label-1",
                    "score": 1,
                    "explanation": "explanation",
                    "trace_id": None,
                    "error": None,
                    "metadata_": {},
                    "start_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                    "end_time": datetime(2020, 1, 1, 0, 0, tzinfo=pytz.UTC),
                },
                {
                    "experiment_run_id": run_ids[1],
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
                # experiment 2, annotation-name-3 (two repetitions)
                {
                    "experiment_run_id": run_ids[2],
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
                },
                {
                    "experiment_run_id": run_ids[2],
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
                },
                {
                    "experiment_run_id": run_ids[3],
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
                },
                {
                    "experiment_run_id": run_ids[3],
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
                },
            ]
        )
    )
