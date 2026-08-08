import pytest

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def dataset_labels_with_usages(db: DbSessionFactory) -> None:
    """Three labels: "used-twice" on two datasets, "used-once" on one, "unused" on none."""
    async with db() as session:
        used_twice = models.DatasetLabel(name="used-twice", color="#ff0000")
        used_once = models.DatasetLabel(name="used-once", color="#00ff00")
        unused = models.DatasetLabel(name="unused", color="#0000ff")
        session.add_all([used_twice, used_once, unused])
        await session.flush()

        datasets = [
            models.Dataset(name=f"dataset-{i}", description=None, metadata_={}) for i in range(2)
        ]
        session.add_all(datasets)
        await session.flush()

        session.add_all(
            [
                models.DatasetsDatasetLabel(
                    dataset_id=datasets[0].id, dataset_label_id=used_twice.id
                ),
                models.DatasetsDatasetLabel(
                    dataset_id=datasets[1].id, dataset_label_id=used_twice.id
                ),
                models.DatasetsDatasetLabel(
                    dataset_id=datasets[0].id, dataset_label_id=used_once.id
                ),
            ]
        )


async def test_usage_count_resolver_returns_correct_counts(
    gql_client: AsyncGraphQLClient,
    dataset_labels_with_usages: None,
) -> None:
    query = """
      query {
        datasetLabels {
          edges {
            node {
              name
              usageCount
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data
    usage_counts = {
        edge["node"]["name"]: edge["node"]["usageCount"]
        for edge in response.data["datasetLabels"]["edges"]
    }
    assert usage_counts == {
        "used-twice": 2,
        "used-once": 1,
        "unused": 0,
    }
