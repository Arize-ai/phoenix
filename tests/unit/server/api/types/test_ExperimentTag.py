import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def experiment_tag(db: DbSessionFactory) -> tuple[str, str]:
    async with db() as session:
        dataset = models.Dataset(name="tagged-dataset", description=None, metadata_={})
        session.add(dataset)
        await session.flush()
        version = models.DatasetVersion(dataset_id=dataset.id, description=None, metadata_={})
        session.add(version)
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=version.id,
            name="tagged-experiment",
            repetitions=1,
            metadata_={},
            project_name=None,
        )
        session.add(experiment)
        await session.flush()
        tag = models.ExperimentTag(
            dataset_id=dataset.id,
            experiment_id=experiment.id,
            name="baseline",
            description="passed the quality gate",
        )
        session.add(tag)
        await session.flush()
        return (
            str(GlobalID("ExperimentTag", str(tag.id))),
            str(GlobalID("Experiment", str(experiment.id))),
        )


async def test_experiment_tag_resolves_as_a_node(
    gql_client: AsyncGraphQLClient,
    experiment_tag: tuple[str, str],
) -> None:
    tag_id, experiment_id = experiment_tag
    result = await gql_client.execute(
        query="""
          query ExperimentTag($id: ID!) {
            node(id: $id) {
              ... on ExperimentTag {
                id
                experimentId
                name
                description
              }
            }
          }
        """,
        variables={"id": tag_id},
    )

    assert result.data and not result.errors
    assert result.data["node"] == {
        "id": tag_id,
        "experimentId": experiment_id,
        "name": "baseline",
        "description": "passed the quality gate",
    }
