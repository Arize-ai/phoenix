from datetime import datetime

import pytest
import pytz
from phoenix.db import models
from sqlalchemy import insert
from strawberry.relay import GlobalID


async def test_annotations_resolver_returns_annotations_for_run(
    test_client, experiment_run_with_annotations
):
    query = """
      query ($runId: GlobalID!) {
        run: node(id: $runId) {
          ... on ExperimentRun {
            annotations {
              edges {
                annotation: node {
                  id
                  name
                  annotatorKind
                  label
                  score
                  explanation
                  error
                  metadata
                  startTime
                  endTime
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
                "runId": str(GlobalID(type_name="ExperimentRun", node_id=str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    assert response_json["data"] == {
        "run": {
            "annotations": {
                "edges": [
                    {
                        "annotation": {
                            "id": str(
                                GlobalID(type_name="ExperimentRunAnnotation", node_id=str(1))
                            ),
                            "name": "annotation-name",
                            "annotatorKind": "LLM",
                            "label": "annotation-label",
                            "score": 0.2,
                            "explanation": "annotation-explanation",
                            "error": "annotation-error",
                            "metadata": {"annotation-metadata-key": "annotation-metadata-value"},
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:01:00+00:00",
                        }
                    }
                ]
            }
        }
    }


@pytest.fixture
async def experiment_run_with_annotations(session):
    """
    An experiment run with an annotation.
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

    # insert experiment run
    run_id = await session.scalar(
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

    # insert annotation
    await session.scalar(
        insert(models.ExperimentAnnotation)
        .returning(models.ExperimentAnnotation.id)
        .values(
            experiment_run_id=run_id,
            name="annotation-name",
            annotator_kind="LLM",
            label="annotation-label",
            score=0.2,
            explanation="annotation-explanation",
            trace_id=None,
            error="annotation-error",
            metadata_={"annotation-metadata-key": "annotation-metadata-value"},
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc),
        )
    )
