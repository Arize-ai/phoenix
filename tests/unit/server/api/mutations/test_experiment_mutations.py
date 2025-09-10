from typing import Any

import pytest
from sqlalchemy import func, insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestDeleteExperiment:
    MUTATION = """
      mutation ($experimentIds: [ID!]!) {
        deleteExperiments(input: {experimentIds: $experimentIds}) {
          experiments {
            id
            name
            description
            metadata
          }
        }
      }
    """

    async def test_deletes_and_returns_experiments(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentIds": [
                    str(GlobalID(type_name="Experiment", node_id=str(1))),
                    str(GlobalID(type_name="Experiment", node_id=str(2))),
                ],
            },
        )
        assert (await session.scalar(func.count(models.Experiment.id))) == 0
        assert not response.errors
        assert response.data == {
            "deleteExperiments": {
                "experiments": [
                    {
                        "id": str(GlobalID(type_name="Experiment", node_id=str(1))),
                        "name": "experiment-1-name",
                        "description": "experiment-1-description",
                        "metadata": {"experiment-1-metadata-key": "experiment-1-metadata-value"},
                    },
                    {
                        "id": str(GlobalID(type_name="Experiment", node_id=str(2))),
                        "name": "experiment-2-name",
                        "description": "experiment-2-description",
                        "metadata": {"experiment-2-metadata-key": "experiment-2-metadata-value"},
                    },
                ]
            }
        }

    async def test_non_existent_experiment_id_results_in_no_deletions_and_returns_error(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        simple_experiments: Any,
    ) -> None:
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "experimentIds": [
                    str(GlobalID(type_name="Experiment", node_id=str(1))),
                    str(GlobalID(type_name="Experiment", node_id=str(3))),
                ],
            },
        )
        async with db() as session:
            assert (await session.scalar(func.count(models.Experiment.id))) == 2
        assert (errors := response.errors)
        assert len(errors) == 1
        assert errors[0].message == (
            "Failed to delete experiment(s), probably due to invalid input experiment ID(s): "
            f"['{str(GlobalID('Experiment', str(3)))}']"
        )


@pytest.fixture
async def simple_experiments(db: DbSessionFactory) -> None:
    """
    A dataset with one example and two experiments.
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

        # insert two experiments
        await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-1-name",
                description="experiment-1-description",
                metadata_={"experiment-1-metadata-key": "experiment-1-metadata-value"},
                repetitions=1,
            )
        )
        await session.scalar(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                dataset_id=dataset_id,
                dataset_version_id=version_id,
                name="experiment-2-name",
                description="experiment-2-description",
                metadata_={"experiment-2-metadata-key": "experiment-2-metadata-value"},
                repetitions=1,
            )
        )
