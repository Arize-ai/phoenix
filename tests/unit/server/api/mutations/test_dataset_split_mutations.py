import pytest
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


@pytest.fixture
async def datasets_with_splits_and_labels(db: DbSessionFactory) -> None:
    """Two datasets (1 and 2): dataset 1 owns examples 1 and 2, dataset 2 owns
    example 3. Two splits: "train" (id 1, containing example 1) and "test"
    (id 2, empty). Two labels: "alpha" and "beta"."""
    async with db() as session:
        for name in ("dataset-1", "dataset-2"):
            await session.execute(
                insert(models.Dataset).values(name=name, description=None, metadata_={})
            )
        for dataset_id in (1, 1, 2):
            await session.execute(insert(models.DatasetExample).values(dataset_id=dataset_id))
        for name in ("train", "test"):
            await session.execute(
                insert(models.DatasetSplit).values(
                    name=name,
                    description=f"{name}-description",
                    color="#ffffff",
                    metadata_={},
                )
            )
        await session.execute(
            insert(models.DatasetSplitDatasetExample).values(
                dataset_split_id=1, dataset_example_id=1
            )
        )
        for name in ("alpha", "beta"):
            await session.execute(
                insert(models.DatasetLabel).values(name=name, description=None, color="#000000")
            )


async def _split_memberships(db: DbSessionFactory) -> set[tuple[int, int]]:
    async with db() as session:
        rows = await session.execute(
            select(
                models.DatasetSplitDatasetExample.dataset_split_id,
                models.DatasetSplitDatasetExample.dataset_example_id,
            )
        )
        return {(row.dataset_split_id, row.dataset_example_id) for row in rows}


class TestSetDatasetExamplesSplits:
    MUTATION = """
      mutation ($input: SetDatasetExamplesSplitsInput!) {
        setDatasetExamplesSplits(input: $input) {
          examples {
            id
          }
        }
      }
    """

    async def test_replaces_membership_for_all_examples(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
        db: DbSessionFactory,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "exampleIds": [
                        str(GlobalID("DatasetExample", "1")),
                        str(GlobalID("DatasetExample", "2")),
                    ],
                    "datasetSplitIds": [str(GlobalID("DatasetSplit", "2"))],
                    "datasetId": str(GlobalID("Dataset", "1")),
                }
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert {example["id"] for example in data["setDatasetExamplesSplits"]["examples"]} == {
            str(GlobalID("DatasetExample", "1")),
            str(GlobalID("DatasetExample", "2")),
        }
        # Example 1 left "train" and both examples joined "test".
        assert await _split_memberships(db) == {(2, 1), (2, 2)}

    async def test_rejects_examples_outside_scoped_dataset_without_writing(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
        db: DbSessionFactory,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "exampleIds": [
                        str(GlobalID("DatasetExample", "1")),
                        str(GlobalID("DatasetExample", "3")),  # belongs to dataset 2
                    ],
                    "datasetSplitIds": [str(GlobalID("DatasetSplit", "2"))],
                    "datasetId": str(GlobalID("Dataset", "1")),
                }
            },
        )
        assert response.errors
        assert "do not belong" in response.errors[0].message
        assert await _split_memberships(db) == {(1, 1)}

    async def test_rejects_missing_examples_without_writing(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
        db: DbSessionFactory,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "exampleIds": [
                        str(GlobalID("DatasetExample", "1")),
                        str(GlobalID("DatasetExample", "999")),
                    ],
                    "datasetSplitIds": [str(GlobalID("DatasetSplit", "2"))],
                }
            },
        )
        assert response.errors
        assert "not found" in response.errors[0].message
        assert await _split_memberships(db) == {(1, 1)}

    async def test_rejects_missing_splits_without_writing(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
        db: DbSessionFactory,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "exampleIds": [str(GlobalID("DatasetExample", "1"))],
                    "datasetSplitIds": [str(GlobalID("DatasetSplit", "999"))],
                }
            },
        )
        assert response.errors
        assert "not found" in response.errors[0].message
        assert await _split_memberships(db) == {(1, 1)}


class TestPatchDatasetSplit:
    MUTATION = """
      mutation ($input: PatchDatasetSplitInput!) {
        patchDatasetSplit(input: $input) {
          datasetSplit {
            name
            description
            color
          }
        }
      }
    """

    async def test_null_description_clears_it(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "datasetSplitId": str(GlobalID("DatasetSplit", "1")),
                    "description": None,
                }
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert data["patchDatasetSplit"]["datasetSplit"] == {
            "name": "train",
            "description": None,
            "color": "#ffffff",
        }

    async def test_omitted_fields_are_left_unchanged(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "datasetSplitId": str(GlobalID("DatasetSplit", "1")),
                    "color": "#123456",
                }
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert data["patchDatasetSplit"]["datasetSplit"] == {
            "name": "train",
            "description": "train-description",
            "color": "#123456",
        }

    async def test_empty_description_is_treated_as_a_clear(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "datasetSplitId": str(GlobalID("DatasetSplit", "1")),
                    "description": "",
                }
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert data["patchDatasetSplit"]["datasetSplit"]["description"] is None

    async def test_empty_color_is_rejected(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "datasetSplitId": str(GlobalID("DatasetSplit", "1")),
                    "color": "  ",
                }
            },
        )
        assert response.errors
        assert "Color cannot be empty" in response.errors[0].message

    async def test_null_is_ignored_for_non_nullable_fields(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.MUTATION,
            variables={
                "input": {
                    "datasetSplitId": str(GlobalID("DatasetSplit", "1")),
                    "name": None,
                    "color": None,
                }
            },
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert data["patchDatasetSplit"]["datasetSplit"] == {
            "name": "train",
            "description": "train-description",
            "color": "#ffffff",
        }


class TestVocabularyNamesFilter:
    SPLITS_QUERY = """
      query ($names: [String!]) {
        datasetSplits(names: $names) {
          edges {
            node {
              name
            }
          }
        }
      }
    """

    LABELS_QUERY = """
      query ($names: [String!]) {
        datasetLabels(names: $names) {
          edges {
            node {
              name
            }
          }
        }
      }
    """

    async def test_dataset_splits_filter_by_exact_names(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.SPLITS_QUERY,
            variables={"names": ["train", "nonexistent"]},
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert [edge["node"]["name"] for edge in data["datasetSplits"]["edges"]] == ["train"]

    async def test_dataset_labels_filter_by_exact_names(
        self,
        gql_client: AsyncGraphQLClient,
        datasets_with_splits_and_labels: None,
    ) -> None:
        response = await gql_client.execute(
            query=self.LABELS_QUERY,
            variables={"names": ["beta", "nonexistent"]},
        )
        assert not response.errors
        assert (data := response.data) is not None
        assert [edge["node"]["name"] for edge in data["datasetLabels"]["edges"]] == ["beta"]
