from datetime import datetime
from typing import Any

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


async def test_annotations_resolver_returns_annotations_for_run(
    gql_client: AsyncGraphQLClient,
    experiment_run_with_annotations: Any,
) -> None:
    query = """
      query ($runId: ID!) {
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
    response = await gql_client.execute(
        query=query,
        variables={
            "runId": str(GlobalID(type_name="ExperimentRun", node_id=str(1))),
        },
    )
    assert not response.errors
    assert response.data == {
        "run": {
            "annotations": {
                "edges": [
                    {
                        "annotation": {
                            "id": str(
                                GlobalID(type_name="ExperimentRunAnnotation", node_id=str(2))
                            ),
                            "name": "annotation-2-name",
                            "annotatorKind": "LLM",
                            "label": "annotation-2-label",
                            "score": 0.2,
                            "explanation": "annotation-2-explanation",
                            "error": "annotation-2-error",
                            "metadata": {
                                "annotation-2-metadata-key": "annotation-2-metadata-value"
                            },
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:01:00+00:00",
                        }
                    },
                    {
                        "annotation": {
                            "id": str(
                                GlobalID(type_name="ExperimentRunAnnotation", node_id=str(1))
                            ),
                            "name": "annotation-1-name",
                            "annotatorKind": "LLM",
                            "label": "annotation-1-label",
                            "score": 0.2,
                            "explanation": "annotation-1-explanation",
                            "error": "annotation-1-error",
                            "metadata": {
                                "annotation-1-metadata-key": "annotation-1-metadata-value"
                            },
                            "startTime": "2020-01-01T00:00:00+00:00",
                            "endTime": "2020-01-01T00:01:00+00:00",
                        }
                    },
                ]
            }
        }
    }


@pytest.fixture
async def experiment_run_with_annotations(
    db: DbSessionFactory,
) -> None:
    """
    An experiment run with two annotations.
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

        # insert experiment
        experiment_id = await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-name",
                description="experiment-description",
                repetitions=1,
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
                repetition_number=1,
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            )
        )

        # insert annotations
        await session.scalar(
            insert(models.ExperimentRunAnnotation)
            .returning(models.ExperimentRunAnnotation.id)
            .values(
                experiment_run_id=run_id,
                name="annotation-1-name",
                annotator_kind="LLM",
                label="annotation-1-label",
                score=0.2,
                explanation="annotation-1-explanation",
                trace_id=None,
                error="annotation-1-error",
                metadata_={"annotation-1-metadata-key": "annotation-1-metadata-value"},
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc),
            )
        )

        await session.scalar(
            insert(models.ExperimentRunAnnotation)
            .returning(models.ExperimentRunAnnotation.id)
            .values(
                experiment_run_id=run_id,
                name="annotation-2-name",
                annotator_kind="LLM",
                label="annotation-2-label",
                score=0.2,
                explanation="annotation-2-explanation",
                trace_id=None,
                error="annotation-2-error",
                metadata_={"annotation-2-metadata-key": "annotation-2-metadata-value"},
                start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
                end_time=datetime(year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc),
            )
        )
