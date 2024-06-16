import pytest
from phoenix.db import models
from sqlalchemy import func, insert
from strawberry.relay import GlobalID


class TestDeleteExperiment:
    MUTATION = """
      mutation ($experimentId: GlobalID!) {
        deleteExperiment(input: {experimentId: $experimentId}) {
          experiment {
            id
            name
            description
            metadata
          }
        }
      }
    """

    async def test_deletes_and_returns_experiment(
        self,
        session,
        test_client,
        simple_experiment,
    ) -> None:
        experiment_id = str(GlobalID(type_name="Experiment", node_id=str(1)))
        assert (await session.scalar(func.count(models.Experiment.id))) == 1
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.MUTATION,
                "variables": {
                    "experimentId": experiment_id,
                },
            },
        )
        assert (await session.scalar(func.count(models.Experiment.id))) == 0
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {
            "deleteExperiment": {
                "experiment": {
                    "id": experiment_id,
                    "name": "experiment-name",
                    "description": "experiment-description",
                    "metadata": {"experiment-metadata-key": "experiment-metadata-value"},
                }
            }
        }

    async def test_non_existent_experiment_id_returns_error(
        self,
        session,
        test_client,
        simple_experiment,
    ) -> None:
        experiment_id = str(GlobalID(type_name="Experiment", node_id=str(2)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.MUTATION,
                "variables": {
                    "experimentId": experiment_id,
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert (errors := response_json.get("errors"))
        assert errors[0]["message"] == f"Unknown experiment: {experiment_id}"


@pytest.fixture
async def simple_experiment(session) -> None:
    """
    A dataset with one example and one experiment.
    """

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
    await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_id,
            name="experiment-name",
            description="experiment-description",
            metadata_={"experiment-metadata-key": "experiment-metadata-value"},
        )
    )
