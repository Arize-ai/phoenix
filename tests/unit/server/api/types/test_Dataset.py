from collections.abc import Mapping
from datetime import datetime
from secrets import token_hex
from typing import Any

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.types import DbSessionFactory
from tests.unit.graphql import AsyncGraphQLClient


class TestDatasetExampleNodeInterface:
    QUERY = """
      query ($exampleId: ID!, $datasetVersionId: ID = null) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            createdAt
            revision(datasetVersionId: $datasetVersionId) {
              input
              output
              metadata
              revisionKind
            }
          }
        }
      }
    """

    async def test_unspecified_version_returns_latest_revision(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "exampleId": example_id,
            },
        )
        assert not response.errors
        assert response.data == {
            "example": {
                "id": example_id,
                "createdAt": "2020-01-01T00:00:00+00:00",
                "revision": {
                    "input": {"input": "second-input"},
                    "output": {"output": "second-output"},
                    "metadata": {},
                    "revisionKind": "PATCH",
                },
            }
        }

    async def test_returns_latest_revision_up_to_specified_version(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "exampleId": example_id,
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {
            "example": {
                "id": example_id,
                "createdAt": "2020-01-01T00:00:00+00:00",
                "revision": {
                    "input": {"input": "first-input"},
                    "output": {"output": "first-output"},
                    "metadata": {},
                    "revisionKind": "CREATE",
                },
            }
        }

    async def test_returns_latest_revision_up_to_version_even_if_version_does_not_change_example(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_three_versions: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "exampleId": example_id,
                "datasetVersionId": str(GlobalID("DatasetVersion", str(2))),
            },
        )
        assert not response.errors
        assert response.data == {
            "example": {
                "id": example_id,
                "createdAt": "2020-01-01T00:00:00+00:00",
                "revision": {
                    "input": {"input": "first-input"},
                    "output": {"output": "first-output"},
                    "metadata": {},
                    "revisionKind": "CREATE",
                },
            }
        }

    async def test_non_existent_version_id_returns_error(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "exampleId": example_id,
                "datasetVersionId": str(GlobalID("DatasetVersion", str(100))),  # doesn't exist
            },
        )
        assert response.errors
        assert response.errors[0].message == "Could not find revision."

    async def test_deleted_dataset_example_is_returned(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "exampleId": example_id,
            },
        )
        assert not response.errors
        assert response.data == {
            "example": {
                "id": example_id,
                "createdAt": "2020-01-01T00:00:00+00:00",
                "revision": {
                    "input": {},
                    "output": {},
                    "metadata": {},
                    "revisionKind": "DELETE",
                },
            }
        }


class TestDatasetExampleCountResolver:
    QUERY = """
      query ($datasetId: ID!, $datasetVersionId: ID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            exampleCount(datasetVersionId: $datasetVersionId)
          }
        }
      }
    """

    async def test_count_uses_latest_version_when_no_version_is_specified(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"exampleCount": 0}}

    async def test_count_uses_specified_version(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"exampleCount": 1}}


class TestDatasetExamplesResolver:
    QUERY = """
      query ($datasetId: ID!, $datasetVersionId: ID = null, $revisionDatasetVersionId: ID = null, $filter: String = null) {
        node(id: $datasetId) {
          ... on Dataset {
            examples(datasetVersionId: $datasetVersionId, filter: $filter) {
              edges {
                node {
                  id
                  revision(datasetVersionId: $revisionDatasetVersionId) {
                    input
                    output
                    metadata
                  }
                  createdAt
                }
              }
            }
          }
        }
      }
    """

    async def test_returns_latest_revisions_when_no_version_is_specified(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        edges = [
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-02-02T00:00:00+00:00",
                }
            },
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
        ]
        assert response.data == {"node": {"examples": {"edges": edges}}}

    async def test_excludes_deleted_examples(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"examples": {"edges": []}}}

    async def test_returns_latest_revisions_up_to_specified_version(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        edges = [
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-02-02T00:00:00+00:00",
                }
            },
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
        ]
        assert response.data == {"node": {"examples": {"edges": edges}}}

    async def test_returns_latest_revisions_up_to_version_even_if_version_does_not_change_example(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_three_versions: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(
                    GlobalID("DatasetVersion", str(2))
                ),  # example is not changed in this version
            },
        )
        assert not response.errors
        assert response.data == {
            "node": {
                "examples": {
                    "edges": [
                        {
                            "node": {
                                "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                                "revision": {
                                    "input": {"input": "first-input"},
                                    "output": {"output": "first-output"},
                                    "metadata": {},
                                },
                                "createdAt": "2020-01-01T00:00:00+00:00",
                            }
                        }
                    ]
                }
            }
        }

    async def test_version_id_on_revision_resolver_takes_precedence(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(2))),
                "revisionDatasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        edges = [
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-02-02T00:00:00+00:00",
                }
            },
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
        ]
        assert response.data == {"node": {"examples": {"edges": edges}}}

    async def test_filter_examples_by_content(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        # Test filtering examples by content in input field
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filter": "second-input",
            },
        )
        assert not response.errors
        edges = [
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-02-02T00:00:00+00:00",
                }
            },
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
        ]
        assert response.data == {"node": {"examples": {"edges": edges}}}

    async def test_filter_examples_by_output_content(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        # Test filtering examples by content in output field
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filter": "second-output",
            },
        )
        assert not response.errors
        edges = [
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-02-02T00:00:00+00:00",
                }
            },
            {
                "node": {
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
        ]
        assert response.data == {"node": {"examples": {"edges": edges}}}

    async def test_filter_examples_returns_empty_when_no_match(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        # Test filtering examples with content that doesn't exist
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filter": "nonexistent-content",
            },
        )
        assert not response.errors
        assert response.data == {"node": {"examples": {"edges": []}}}


@pytest.mark.parametrize(
    "sort_direction, expected_versions",
    [
        pytest.param(
            "asc",
            [
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(1))),
                        "description": "version-1-description",
                        "metadata": {"version-1-metadata-key": "version-1-metadata-value"},
                    }
                },
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(2))),
                        "description": "version-2-description",
                        "metadata": {"version-2-metadata-key": "version-2-metadata-value"},
                    }
                },
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(3))),
                        "description": "version-3-description",
                        "metadata": {"version-3-metadata-key": "version-3-metadata-value"},
                    }
                },
            ],
            id="ascending",
        ),
        pytest.param(
            "desc",
            [
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(3))),
                        "description": "version-3-description",
                        "metadata": {"version-3-metadata-key": "version-3-metadata-value"},
                    }
                },
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(2))),
                        "description": "version-2-description",
                        "metadata": {"version-2-metadata-key": "version-2-metadata-value"},
                    }
                },
                {
                    "version": {
                        "id": str(GlobalID("DatasetVersion", str(1))),
                        "description": "version-1-description",
                        "metadata": {"version-1-metadata-key": "version-1-metadata-value"},
                    }
                },
            ],
            id="descending",
        ),
    ],
)
async def test_versions_resolver_returns_versions_in_correct_order(
    sort_direction: str,
    expected_versions: Mapping[str, Any],
    gql_client: AsyncGraphQLClient,
    dataset_with_three_versions: Any,
) -> None:
    query = """
      query ($datasetId: ID!, $dir: SortDir!, $col: DatasetVersionColumn!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            versions(sort: {dir: $dir, col: $col}) {
              edges {
                version: node {
                  id
                  description
                  metadata
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
            "datasetId": str(GlobalID("Dataset", str(1))),
            "dir": sort_direction,
            "col": "createdAt",
        },
    )
    assert not response.errors
    assert response.data == {"dataset": {"versions": {"edges": expected_versions}}}


class TestDatasetExperimentCountResolver:
    QUERY = """
      query ($datasetId: ID!, $datasetVersionId: ID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            experimentCount(datasetVersionId: $datasetVersionId)
          }
        }
      }
    """

    async def test_experiment_count_uses_all_versions_when_no_version_is_specified(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"experimentCount": 2}}

    async def test_experiment_count_uses_specified_version(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"experimentCount": 1}}


class TestDatasetExperimentsResolver:
    QUERY = """
      query ($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                node {
                  sequenceNumber
                  id
                }
              }
            }
          }
        }
      }
    """

    async def test_experiments_have_sequence_number(
        self,
        gql_client: AsyncGraphQLClient,
        interlaced_experiments: list[int],
    ) -> None:
        variables = {"datasetId": str(GlobalID("Dataset", str(2)))}
        response = await gql_client.execute(
            query=self.QUERY,
            variables=variables,
        )
        assert not response.errors
        edges = [
            {"node": {"sequenceNumber": 4, "id": str(GlobalID(Experiment.__name__, str(11)))}},
            {"node": {"sequenceNumber": 3, "id": str(GlobalID(Experiment.__name__, str(8)))}},
            {"node": {"sequenceNumber": 2, "id": str(GlobalID(Experiment.__name__, str(5)))}},
            {"node": {"sequenceNumber": 1, "id": str(GlobalID(Experiment.__name__, str(2)))}},
        ]
        assert response.data == {"node": {"experiments": {"edges": edges}}}


@pytest.fixture
async def experiments_for_filtering(db: DbSessionFactory) -> None:
    """
    Creates a dataset with a few experiments with specific names and descriptions for
    filtering tests.
    """
    async with db() as session:
        # Insert dataset
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(
                name="filter-test-dataset",
                description="dataset-description",
                metadata_={"dataset-metadata-key": "dataset-metadata-value"},
            )
        )

        # Insert dataset version
        version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(
                dataset_id=dataset_id,
                description="version-description",
                metadata_={"version-metadata-key": "version-metadata-value"},
            )
        )

        # Insert experiments with specific names and descriptions
        await session.scalars(
            insert(models.Experiment)
            .returning(models.Experiment.id)
            .values(
                [
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": version_id,
                        "name": "test-experiment-one",
                        "description": "first test experiment description",
                        "repetitions": 1,
                        "metadata_": {"meta": "one"},
                    },
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": version_id,
                        "name": "test-experiment-two",
                        "description": "second test experiment description",
                        "repetitions": 1,
                        "metadata_": {"meta": "two"},
                    },
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": version_id,
                        "name": "production-experiment",
                        "description": "production ready experiment",
                        "repetitions": 1,
                        "metadata_": {"meta": "prod"},
                    },
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": version_id,
                        "name": "demo-experiment",
                        "description": "demo experiment for testing",
                        "repetitions": 1,
                        "metadata_": {"meta": "demo"},
                    },
                ]
            )
        )


async def test_experiments_filter_by_search_term(
    gql_client: AsyncGraphQLClient,
    experiments_for_filtering: Any,
) -> None:
    """Test that experiments can be filtered by search term across name and description."""
    query = """
      query ($datasetId: ID!, $filterCondition: String) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments(filterCondition: $filterCondition) {
              edges {
                node {
                  id
                  name
                  description
                }
              }
            }
          }
        }
      }
    """

    # Test filtering by partial name match
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID("Dataset", str(1))),
            "filterCondition": "test-experiment",
        },
    )
    assert not response.errors
    assert response.data is not None
    data = response.data
    # Should find test-experiment-one and test-experiment-two (matches name)
    assert len(data["node"]["experiments"]["edges"]) == 2
    names = [edge["node"]["name"] for edge in data["node"]["experiments"]["edges"]]
    assert "test-experiment-one" in names
    assert "test-experiment-two" in names

    # Test filtering with no matches
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID("Dataset", str(1))),
            "filterCondition": "nonexistent",
        },
    )
    assert not response.errors
    assert response.data == {"node": {"experiments": {"edges": []}}}


async def test_experiments_filter_by_description_search(
    gql_client: AsyncGraphQLClient,
    experiments_for_filtering: Any,
) -> None:
    """Test that experiments can be found by searching their description."""
    query = """
      query ($datasetId: ID!, $filterCondition: String) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments(filterCondition: $filterCondition) {
              edges {
                node {
                  id
                  name
                  description
                }
              }
            }
          }
        }
      }
    """

    # Test filtering by partial description match
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID("Dataset", str(1))),
            "filterCondition": "production ready",
        },
    )
    assert not response.errors
    assert response.data is not None
    data = response.data
    assert len(data["node"]["experiments"]["edges"]) == 1
    assert data["node"]["experiments"]["edges"][0]["node"]["name"] == "production-experiment"

    # Test searching for "demo" which appears in both name and description
    response = await gql_client.execute(
        query=query,
        variables={
            "datasetId": str(GlobalID("Dataset", str(1))),
            "filterCondition": "demo",
        },
    )
    assert not response.errors
    assert response.data is not None
    data = response.data
    assert len(data["node"]["experiments"]["edges"]) == 1
    assert data["node"]["experiments"]["edges"][0]["node"]["name"] == "demo-experiment"


async def test_experiments_without_filter(
    gql_client: AsyncGraphQLClient,
    experiments_for_filtering: Any,
) -> None:
    """Test that all experiments are returned when no filter is applied."""
    query = """
      query ($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    """

    response = await gql_client.execute(
        query=query,
        variables={"datasetId": str(GlobalID("Dataset", str(1)))},
    )
    assert not response.errors
    assert response.data is not None
    data = response.data
    # experiments_for_filtering fixture creates 4 experiments for dataset 1
    assert len(data["node"]["experiments"]["edges"]) == 4


@pytest.mark.xfail(reason="Temporarily associating builtin evaluators with all datasets as well")
class TestDatasetsEvaluatorsResolver:
    async def test_returns_associated_evaluators(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_evaluators: Any,
    ) -> None:
        """Test that evaluators associated with a dataset are returned."""
        query = """
          query ($datasetId: ID!) {
            node(id: $datasetId) {
              ... on Dataset {
                evaluators {
                  edges {
                    node {
                      id
                      name
                      kind
                      description
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
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data is not None

        # Should return 2 evaluators in descending ID order
        edges = response.data["node"]["evaluators"]["edges"]
        assert len(edges) == 2
        assert edges[0]["node"]["name"] == "evaluator-1"
        assert edges[0]["node"]["kind"] == "LLM"
        assert edges[1]["node"]["name"] == "evaluator-2"
        assert edges[1]["node"]["kind"] == "LLM"


@pytest.fixture
async def dataset_with_evaluators(db: DbSessionFactory) -> None:
    """
    Creates a dataset with two evaluators associated via the datasets_evaluators junction table.
    """
    async with db() as session:
        # Create dataset
        dataset = models.Dataset(
            id=1,
            name="test-dataset",
            description="Dataset for testing evaluators",
            metadata_={},
        )
        session.add(dataset)
        await session.flush()

        # Create a prompt for the evaluators
        prompt = models.Prompt(name=Identifier(token_hex(4)))
        session.add(prompt)
        await session.flush()

        # Create a prompt version
        prompt_version = models.PromptVersion(
            prompt_id=prompt.id,
            template_type=PromptTemplateType.STRING,
            template_format=PromptTemplateFormat.F_STRING,
            template=PromptStringTemplate(type="string", template="Test template: {input}"),
            invocation_parameters=PromptOpenAIInvocationParameters(
                type="openai", openai=PromptOpenAIInvocationParametersContent()
            ),
            tools=None,
            response_format=None,
            model_provider=ModelProvider.OPENAI,
            model_name="gpt-4",
            metadata_={},
        )
        session.add(prompt_version)
        await session.flush()

        # Create two evaluators
        evaluator_1 = models.LLMEvaluator(
            id=1,
            name=Identifier("evaluator-1"),
            description="First evaluator",
            prompt_id=prompt.id,
            annotation_name="goodness",
            output_config=CategoricalAnnotationConfig(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                description="goodness description",
                values=[
                    CategoricalAnnotationValue(label="good", score=1.0),
                    CategoricalAnnotationValue(label="bad", score=0.0),
                ],
            ),
        )
        evaluator_2 = models.LLMEvaluator(
            id=2,
            name=Identifier("evaluator-2"),
            description="Second evaluator",
            prompt_id=prompt.id,
            annotation_name="correctness",
            output_config=CategoricalAnnotationConfig(
                type="CATEGORICAL",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                description="correctness description",
                values=[
                    CategoricalAnnotationValue(label="correct", score=1.0),
                    CategoricalAnnotationValue(label="incorrect", score=0.0),
                ],
            ),
        )
        session.add_all([evaluator_1, evaluator_2])
        await session.flush()

        # Associate evaluators with dataset via junction table
        dataset_evaluator_1 = models.DatasetsEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator_1.id,
            input_config={},
        )
        dataset_evaluator_2 = models.DatasetsEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator_2.id,
            input_config={},
        )
        session.add_all([dataset_evaluator_1, dataset_evaluator_2])


@pytest.fixture
async def dataset_with_patch_revision(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    patched.
    """
    async with db() as session:
        datasets = list(
            await session.scalars(
                insert(models.Dataset).returning(models.Dataset),
                [{"name": "dataset-name", "metadata_": {}}],
            )
        )

        dataset_versions = list(
            await session.scalars(
                insert(models.DatasetVersion).returning(models.DatasetVersion),
                [
                    {"dataset_id": datasets[0].id, "metadata_": {}},
                    {"dataset_id": datasets[0].id, "metadata_": {}},
                ],
            )
        )

        dataset_examples = list(
            await session.scalars(
                insert(models.DatasetExample).returning(models.DatasetExample),
                [
                    {
                        "dataset_id": datasets[0].id,
                        "created_at": datetime(
                            year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
                        ),
                    },
                    {
                        "dataset_id": datasets[0].id,
                        "created_at": datetime(
                            year=2020, month=2, day=2, hour=0, minute=0, tzinfo=pytz.utc
                        ),
                    },
                ],
            )
        )

        await session.scalars(
            insert(models.DatasetExampleRevision).returning(models.DatasetExampleRevision),
            [
                {
                    "dataset_example_id": dataset_examples[0].id,
                    "dataset_version_id": dataset_versions[0].id,
                    "input": {"input": "first-input"},
                    "output": {"output": "first-output"},
                    "metadata_": {},
                    "revision_kind": "CREATE",
                },
                {
                    "dataset_example_id": dataset_examples[1].id,
                    "dataset_version_id": dataset_versions[0].id,
                    "input": {"input": "first-input"},
                    "output": {"output": "first-output"},
                    "metadata_": {},
                    "revision_kind": "CREATE",
                },
                {
                    "dataset_example_id": dataset_examples[0].id,
                    "dataset_version_id": dataset_versions[1].id,
                    "input": {"input": "second-input"},
                    "output": {"output": "second-output"},
                    "metadata_": {},
                    "revision_kind": "PATCH",
                },
                {
                    "dataset_example_id": dataset_examples[1].id,
                    "dataset_version_id": dataset_versions[1].id,
                    "input": {"input": "second-input"},
                    "output": {"output": "second-output"},
                    "metadata_": {},
                    "revision_kind": "PATCH",
                },
            ],
        )


@pytest.fixture
async def dataset_with_three_versions(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and three versions. In the first version,
    the dataset example is created. The second version has no associated
    revisions. In the third version, the dataset example is patched.
    """
    async with db() as session:
        dataset = models.Dataset(
            id=1,
            name="dataset-name",
            description=None,
            metadata_={},
        )
        session.add(dataset)
        await session.flush()

        dataset_example = models.DatasetExample(
            id=1,
            dataset_id=1,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(dataset_example)
        await session.flush()

        dataset_version_1 = models.DatasetVersion(
            id=1,
            dataset_id=1,
            description="version-1-description",
            metadata_={"version-1-metadata-key": "version-1-metadata-value"},
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(dataset_version_1)
        await session.flush()

        dataset_example_revision_1 = models.DatasetExampleRevision(
            id=1,
            dataset_example_id=1,
            dataset_version_id=1,
            input={"input": "first-input"},
            output={"output": "first-output"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(dataset_example_revision_1)
        await session.flush()

        dataset_version_2 = models.DatasetVersion(
            id=2,
            dataset_id=1,
            description="version-2-description",
            metadata_={"version-2-metadata-key": "version-2-metadata-value"},
            created_at=datetime(
                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc
            ),  # same created_at as version 1
        )
        session.add(dataset_version_2)
        await session.flush()

        dataset_version_3 = models.DatasetVersion(
            id=3,
            dataset_id=1,
            description="version-3-description",
            metadata_={"version-3-metadata-key": "version-3-metadata-value"},
            created_at=datetime(
                year=2020, month=1, day=1, hour=0, minute=1, tzinfo=pytz.utc
            ),  # created one minute after version 2
        )
        session.add(dataset_version_3)
        await session.flush()

        dataset_example_revision_3 = models.DatasetExampleRevision(
            id=3,
            dataset_example_id=1,
            dataset_version_id=3,
            input={"input": "third-input"},
            output={"output": "third-output"},
            metadata_={},
            revision_kind="PATCH",
        )
        session.add(dataset_example_revision_3)
        await session.flush()


@pytest.fixture
async def dataset_with_deletion(db: DbSessionFactory) -> None:
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    deleted.
    """

    async with db() as session:
        dataset = models.Dataset(
            id=1,
            name="dataset-name",
            description=None,
            metadata_={},
        )
        session.add(dataset)
        await session.flush()

        dataset_example = models.DatasetExample(
            id=1,
            dataset_id=1,
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
        )
        session.add(dataset_example)
        await session.flush()

        dataset_version_1 = models.DatasetVersion(
            id=1,
            dataset_id=1,
            description=None,
            metadata_={},
        )
        session.add(dataset_version_1)
        await session.flush()

        dataset_example_revision_1 = models.DatasetExampleRevision(
            id=1,
            dataset_example_id=1,
            dataset_version_id=1,
            input={"input": "first-input"},
            output={"output": "first-output"},
            metadata_={},
            revision_kind="CREATE",
        )
        session.add(dataset_example_revision_1)
        await session.flush()

        dataset_version_2 = models.DatasetVersion(
            id=2,
            dataset_id=1,
            description=None,
            metadata_={},
        )
        session.add(dataset_version_2)
        await session.flush()

        dataset_example_revision_2 = models.DatasetExampleRevision(
            id=2,
            dataset_example_id=1,
            dataset_version_id=2,
            input={},
            output={},
            metadata_={},
            revision_kind="DELETE",
        )
        session.add(dataset_example_revision_2)
        await session.flush()

        await session.execute(
            insert(models.Experiment).returning(models.Experiment.id),
            [
                {
                    "dataset_id": 1,
                    "dataset_version_id": 1,
                    "name": "exp-1",
                    "repetitions": 1,
                    "metadata_": {},
                },
                {
                    "dataset_id": 1,
                    "dataset_version_id": 2,
                    "name": "exp-2",
                    "repetitions": 1,
                    "metadata_": {},
                },
            ],
        )


@pytest.fixture
async def datasets_for_filtering(db: DbSessionFactory) -> None:
    """
    Creates three datasets with specific names for testing filtering functionality.
    """
    async with db() as session:
        for name in ["test_dataset", "dataset_test", "other_name"]:
            dataset = models.Dataset(name=name)
            session.add(dataset)
        await session.commit()


@pytest.mark.parametrize(
    "filter_value, expected_names",
    [
        pytest.param(
            "dataset",
            ["test_dataset", "dataset_test"],
            id="filter-matches-all",
        ),
        pytest.param(
            "test",
            ["test_dataset", "dataset_test"],
            id="filter-matches-partial",
        ),
        pytest.param(
            "TEST",
            ["test_dataset", "dataset_test"],
            id="filter-case-insensitive",
        ),
        pytest.param(
            "nomatch",
            [],
            id="filter-no-matches",
        ),
    ],
)
async def test_dataset_filter(
    filter_value: str,
    expected_names: list[str],
    gql_client: AsyncGraphQLClient,
    datasets_for_filtering: None,
) -> None:
    """Test dataset filtering capabilities."""
    query = """
        query ($filter: DatasetFilter) {
            datasets(filter: $filter) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    """

    variables = {"filter": {"col": "name", "value": filter_value}}
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    datasets = data["datasets"]
    dataset_names = [edge["node"]["name"] for edge in datasets["edges"]]
    assert sorted(dataset_names) == sorted(expected_names)


@pytest.mark.parametrize(
    "sort, filter_value, expected_names",
    [
        pytest.param(
            {"col": "name", "dir": "asc"},
            "test",
            ["dataset_test", "test_dataset"],
            id="filter-and-sort-asc",
        ),
        pytest.param(
            {"col": "name", "dir": "desc"},
            "test",
            ["test_dataset", "dataset_test"],
            id="filter-and-sort-desc",
        ),
    ],
)
async def test_dataset_filter_and_sort(
    sort: dict[str, str],
    filter_value: str,
    expected_names: list[str],
    gql_client: AsyncGraphQLClient,
    datasets_for_filtering: None,
) -> None:
    """Test combining dataset filtering and sorting."""
    query = """
        query ($sort: DatasetSort, $filter: DatasetFilter) {
            datasets(sort: $sort, filter: $filter) {
                edges {
                    node {
                        name
                    }
                }
            }
        }
    """

    variables = {
        "sort": sort,
        "filter": {"col": "name", "value": filter_value},
    }
    response = await gql_client.execute(query=query, variables=variables)
    assert not response.errors
    assert (data := response.data) is not None
    datasets = data["datasets"]
    dataset_names = [edge["node"]["name"] for edge in datasets["edges"]]
    assert dataset_names == expected_names
