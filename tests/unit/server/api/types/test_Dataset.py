from collections.abc import Mapping
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptStringTemplate,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.experiment_tags import BASELINE_EXPERIMENT_TAG_NAME
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

    async def test_count_is_zero_when_version_belongs_to_another_dataset(
        self,
        gql_client: AsyncGraphQLClient,
        many_datasets_with_examples: Mapping[str, int],
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(2))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"exampleCount": 0}}

    async def test_bulk_query_returns_count_for_every_dataset(
        self,
        gql_client: AsyncGraphQLClient,
        many_datasets_with_examples: Mapping[str, int],
    ) -> None:
        query = """
          query {
            datasets(first: 50) {
              edges {
                node {
                  id
                  exampleCount
                }
              }
            }
          }
        """
        response = await gql_client.execute(query=query)
        assert not response.errors
        assert response.data
        counts = {
            edge["node"]["id"]: edge["node"]["exampleCount"]
            for edge in response.data["datasets"]["edges"]
        }
        assert counts == dict(many_datasets_with_examples)

    async def test_count_with_split_filter(
        self,
        gql_client: AsyncGraphQLClient,
        many_datasets_with_examples: Mapping[str, int],
    ) -> None:
        query = """
          query ($datasetId: ID!, $splitIds: [ID!]) {
            node(id: $datasetId) {
              ... on Dataset {
                exampleCount(splitIds: $splitIds)
              }
            }
          }
        """
        response = await gql_client.execute(
            query=query,
            variables={
                "datasetId": str(GlobalID("Dataset", str(3))),
                "splitIds": [str(GlobalID("DatasetSplit", str(1)))],
            },
        )
        assert not response.errors
        assert response.data == {"node": {"exampleCount": 2}}


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
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
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
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
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
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "first-input"},
                        "output": {"output": "first-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
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
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
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
                    "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                    "revision": {
                        "input": {"input": "second-input"},
                        "output": {"output": "second-output"},
                        "metadata": {},
                    },
                    "createdAt": "2020-01-01T00:00:00+00:00",
                }
            },
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

    FILTER_IDS_QUERY = """
      query ($datasetId: ID!, $filterIds: [ID!]) {
        node(id: $datasetId) {
          ... on Dataset {
            examples(filterIds: $filterIds) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    """

    async def test_filter_ids_returns_only_requested_examples(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(2)))
        response = await gql_client.execute(
            query=self.FILTER_IDS_QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filterIds": [example_id],
            },
        )
        assert not response.errors
        assert response.data == {"node": {"examples": {"edges": [{"node": {"id": example_id}}]}}}

    async def test_filter_ids_excludes_examples_from_other_datasets(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        # An example ID that exists nowhere (or in another dataset) yields no edges
        # rather than leaking rows from outside the dataset in view.
        response = await gql_client.execute(
            query=self.FILTER_IDS_QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filterIds": [str(GlobalID("DatasetExample", str(999)))],
            },
        )
        assert not response.errors
        assert response.data == {"node": {"examples": {"edges": []}}}

    async def test_filter_ids_rejects_ids_of_wrong_type(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_patch_revision: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.FILTER_IDS_QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "filterIds": [str(GlobalID("Dataset", str(1)))],
            },
        )
        assert response.errors


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
    QUERY_WITHOUT_OPTIONAL_ARGS = """
      query ($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            experimentCount
          }
        }
      }
    """

    QUERY = """
      query ($datasetId: ID!, $datasetVersionId: ID = null, $includeEphemeral: Boolean = false) {
        node(id: $datasetId) {
          ... on Dataset {
            experimentCount(datasetVersionId: $datasetVersionId, includeEphemeral: $includeEphemeral)
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

    async def test_experiment_count_handles_omitted_optional_args(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_deletion: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY_WITHOUT_OPTIONAL_ARGS,
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

    async def test_experiment_count_excludes_ephemeral_by_default(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_ephemeral_experiment: Any,
    ) -> None:
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data == {"node": {"experimentCount": 1}}

    async def test_experiment_count_includes_ephemeral_when_true(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_ephemeral_experiment: Any,
    ) -> None:
        """includeEphemeral=true means include ephemeral in the count (all experiments)."""
        response = await gql_client.execute(
            query=self.QUERY,
            variables={
                "datasetId": str(GlobalID("Dataset", str(1))),
                "includeEphemeral": True,
            },
        )
        assert not response.errors
        assert response.data == {"node": {"experimentCount": 2}}


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


class TestDatasetBaselineExperimentResolver:
    QUERY = """
      query ($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            baselineExperiment {
              id
              name
              sequenceNumber
              isBaseline
            }
          }
        }
      }
    """

    async def test_returns_null_when_no_baseline_is_set(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, _ = await _create_dataset_with_experiments(db, experiment_count=3)
        response = await gql_client.execute(
            query=self.QUERY,
            variables={"datasetId": str(GlobalID("Dataset", str(dataset_id)))},
        )

        assert not response.errors
        assert response.data == {"node": {"baselineExperiment": None}}

    async def test_returns_baseline_experiment_with_sequence_number(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, experiment_ids = await _create_dataset_with_experiments(
            db,
            experiment_count=4,
            baseline_experiment_index=3,
        )
        response = await gql_client.execute(
            query=self.QUERY,
            variables={"datasetId": str(GlobalID("Dataset", str(dataset_id)))},
        )

        assert not response.errors
        assert response.data == {
            "node": {
                "baselineExperiment": {
                    "id": str(GlobalID(Experiment.__name__, str(experiment_ids[2]))),
                    "name": "experiment-3",
                    "sequenceNumber": 3,
                    "isBaseline": True,
                }
            }
        }

    async def test_sequence_number_skips_ephemeral_experiments(
        self,
        gql_client: AsyncGraphQLClient,
        db: DbSessionFactory,
    ) -> None:
        dataset_id, experiment_ids = await _create_dataset_with_experiments(
            db,
            experiment_count=3,
            baseline_experiment_index=2,
            create_ephemeral_experiment_first=True,
        )
        response = await gql_client.execute(
            query=self.QUERY,
            variables={"datasetId": str(GlobalID("Dataset", str(dataset_id)))},
        )

        assert not response.errors
        assert response.data == {
            "node": {
                "baselineExperiment": {
                    "id": str(GlobalID(Experiment.__name__, str(experiment_ids[1]))),
                    "name": "experiment-2",
                    "sequenceNumber": 2,
                    "isBaseline": True,
                }
            }
        }


class TestDatasetExperimentAnnotationMetricsResolver:
    async def test_returns_bounded_metrics_for_baseline_and_recent_experiments(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        now = datetime.now(timezone.utc)
        async with db() as session:
            dataset = models.Dataset(name="metrics-dataset", metadata_={})
            session.add(dataset)
            await session.flush()
            version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            session.add(version)
            await session.flush()
            example = models.DatasetExample(dataset_id=dataset.id)
            session.add(example)
            await session.flush()
            session.add(
                models.DatasetExampleRevision(
                    dataset_example_id=example.id,
                    dataset_version_id=version.id,
                    input={"question": "example"},
                    output={"answer": "example"},
                    metadata_={},
                    revision_kind="CREATE",
                )
            )

            baseline_labels = ["label-00"] * 10 + [f"label-{index:02d}" for index in range(1, 15)]
            candidate_labels = [f"label-{index:02d}" for index in range(15)]
            latest_only_labels = ["latest-label-14"] * 2 + [
                f"latest-label-{index:02d}" for index in range(13)
            ]
            experiments: list[models.Experiment] = []
            for experiment_name, quality_labels in (
                ("baseline", baseline_labels),
                ("candidate", candidate_labels),
            ):
                experiment = models.Experiment(
                    dataset_id=dataset.id,
                    dataset_version_id=version.id,
                    name=experiment_name,
                    repetitions=len(quality_labels) + (experiment_name == "candidate"),
                    metadata_={},
                )
                session.add(experiment)
                await session.flush()
                experiments.append(experiment)
                for repetition_number, quality_label in enumerate(quality_labels, start=1):
                    run = models.ExperimentRun(
                        experiment_id=experiment.id,
                        dataset_example_id=example.id,
                        output={"answer": "example"},
                        repetition_number=repetition_number,
                        start_time=now,
                        end_time=now,
                    )
                    session.add(run)
                    await session.flush()
                    session.add(
                        models.ExperimentRunAnnotation(
                            experiment_run_id=run.id,
                            name="quality",
                            annotator_kind="CODE",
                            label=quality_label,
                            score=None,
                            explanation=None,
                            trace_id=None,
                            error=None,
                            metadata_={},
                            start_time=now,
                            end_time=now,
                        )
                    )
                    if experiment_name == "candidate":
                        session.add(
                            models.ExperimentRunAnnotation(
                                experiment_run_id=run.id,
                                name="latest-only",
                                annotator_kind="CODE",
                                label=latest_only_labels[repetition_number - 1],
                                score=None,
                                explanation=None,
                                trace_id=None,
                                error=None,
                                metadata_={},
                                start_time=now,
                                end_time=now,
                            )
                        )
                if experiment_name == "candidate":
                    score_only_run = models.ExperimentRun(
                        experiment_id=experiment.id,
                        dataset_example_id=example.id,
                        output={"answer": "example"},
                        repetition_number=len(quality_labels) + 1,
                        start_time=now,
                        end_time=now,
                    )
                    session.add(score_only_run)
                    await session.flush()
                    session.add(
                        models.ExperimentRunAnnotation(
                            experiment_run_id=score_only_run.id,
                            name="quality",
                            annotator_kind="CODE",
                            label=None,
                            score=0.8,
                            explanation=None,
                            trace_id=None,
                            error=None,
                            metadata_={},
                            start_time=now,
                            end_time=now,
                        )
                    )
            session.add(
                models.ExperimentTag(
                    experiment_id=experiments[0].id,
                    dataset_id=dataset.id,
                    name=BASELINE_EXPERIMENT_TAG_NAME,
                    description=None,
                )
            )

        query = """
          query ($datasetId: ID!) {
            dataset: node(id: $datasetId) {
              ... on Dataset {
                experimentAnnotationMetrics(first: 1) {
                  names
                  baselineExperiment { ...dataPoint }
                  recentExperiments { ...dataPoint }
                }
              }
            }
          }

          fragment dataPoint on ExperimentAnnotationMetricsDataPoint {
            experiment { id name sequenceNumber isBaseline }
            annotationSummaries {
              name
              count
              scoreCount
              labelCount
              meanScore
              labelFractions { label fraction }
            }
          }
        """
        response = await gql_client.execute(
            query=query,
            variables={"datasetId": str(GlobalID("Dataset", str(dataset.id)))},
        )

        assert not response.errors
        assert response.data is not None
        metrics = response.data["dataset"]["experimentAnnotationMetrics"]
        assert metrics["names"] == ["latest-only", "quality"]
        assert metrics["baselineExperiment"]["experiment"] == {
            "id": str(GlobalID("Experiment", str(experiments[0].id))),
            "name": "baseline",
            "sequenceNumber": 1,
            "isBaseline": True,
        }
        assert [point["experiment"]["id"] for point in metrics["recentExperiments"]] == [
            str(GlobalID("Experiment", str(experiments[1].id)))
        ]
        candidate_summaries = {
            summary["name"]: summary
            for summary in metrics["recentExperiments"][0]["annotationSummaries"]
        }
        quality = candidate_summaries["quality"]
        expected_quality_labels = [f"label-{index:02d}" for index in range(12)]
        assert quality["count"] == 16
        assert quality["scoreCount"] == 1
        assert quality["labelCount"] == 15
        assert quality["meanScore"] == pytest.approx(0.8)
        assert [item["label"] for item in quality["labelFractions"]] == (expected_quality_labels)
        assert sum(item["fraction"] for item in quality["labelFractions"]) == pytest.approx(12 / 16)
        latest_only = candidate_summaries["latest-only"]
        assert [item["label"] for item in latest_only["labelFractions"]] == [
            "latest-label-14",
            *[f"latest-label-{index:02d}" for index in range(11)],
        ]

    @pytest.mark.parametrize("first", [0, 51])
    async def test_rejects_an_unbounded_experiment_window(
        self,
        first: int,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        response = await gql_client.execute(
            query="""
              query ($datasetId: ID!, $first: Int!) {
                dataset: node(id: $datasetId) {
                  ... on Dataset {
                    experimentAnnotationMetrics(first: $first) { names }
                  }
                }
              }
            """,
            variables={
                "datasetId": str(GlobalID("Dataset", "1")),
                "first": first,
            },
        )
        assert response.errors
        assert response.errors[0].message == "first must be between 1 and 50"


async def _create_dataset_with_experiments(
    db: DbSessionFactory,
    *,
    experiment_count: int,
    baseline_experiment_index: int | None = None,
    create_ephemeral_experiment_first: bool = False,
) -> tuple[int, list[int]]:
    async with db() as session:
        dataset_id = await session.scalar(
            insert(models.Dataset)
            .returning(models.Dataset.id)
            .values(name="baseline-test-dataset", metadata_={})
        )
        assert dataset_id is not None
        dataset_version_id = await session.scalar(
            insert(models.DatasetVersion)
            .returning(models.DatasetVersion.id)
            .values(dataset_id=dataset_id, metadata_={})
        )
        assert dataset_version_id is not None

        if create_ephemeral_experiment_first:
            await session.execute(
                insert(models.Experiment).values(
                    dataset_id=dataset_id,
                    dataset_version_id=dataset_version_id,
                    name="playground",
                    is_ephemeral=True,
                    repetitions=1,
                    metadata_={},
                )
            )

        experiment_ids = list(
            await session.scalars(
                insert(models.Experiment).returning(models.Experiment.id),
                [
                    {
                        "dataset_id": dataset_id,
                        "dataset_version_id": dataset_version_id,
                        "name": f"experiment-{index + 1}",
                        "repetitions": 1,
                        "metadata_": {},
                    }
                    for index in range(experiment_count)
                ],
            )
        )

        if baseline_experiment_index is not None:
            await session.execute(
                insert(models.ExperimentTag).values(
                    experiment_id=experiment_ids[baseline_experiment_index - 1],
                    dataset_id=dataset_id,
                    name=BASELINE_EXPERIMENT_TAG_NAME,
                    description=None,
                )
            )

    return dataset_id, experiment_ids


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


async def test_experiments_excludes_ephemeral_by_default(
    gql_client: AsyncGraphQLClient,
    dataset_with_ephemeral_experiment: Any,
) -> None:
    query = """
      query ($datasetId: ID!) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments {
              edges {
                node {
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
    assert response.data == {
        "node": {"experiments": {"edges": [{"node": {"name": "persisted-exp"}}]}}
    }


async def test_experiments_includes_ephemeral_when_true(
    gql_client: AsyncGraphQLClient,
    dataset_with_ephemeral_experiment: Any,
) -> None:
    """includeEphemeral=true means include ephemeral in the list (all experiments)."""
    query = """
      query ($datasetId: ID!, $includeEphemeral: Boolean = false) {
        node(id: $datasetId) {
          ... on Dataset {
            experiments(includeEphemeral: $includeEphemeral) {
              edges {
                node {
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
        variables={
            "datasetId": str(GlobalID("Dataset", str(1))),
            "includeEphemeral": True,
        },
    )
    assert not response.errors
    # Both experiments returned (order by id desc: playground then persisted-exp)
    assert response.data == {
        "node": {
            "experiments": {
                "edges": [
                    {"node": {"name": "playground"}},
                    {"node": {"name": "persisted-exp"}},
                ]
            }
        }
    }


class TestDatasetsEvaluatorsResolver:
    async def test_returns_associated_dataset_evaluators(
        self,
        gql_client: AsyncGraphQLClient,
        dataset_with_evaluators: Any,
    ) -> None:
        """Test that dataset evaluators associated with a dataset are returned."""
        query = """
          query ($datasetId: ID!) {
            node(id: $datasetId) {
              ... on Dataset {
                datasetEvaluators {
                  edges {
                    node {
                      id
                      name
                      evaluator {
                        ... on LLMEvaluator {
                          name
                          kind
                          description
                        }
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
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        )
        assert not response.errors
        assert response.data is not None

        # Should return 2 evaluators
        edges = response.data["node"]["datasetEvaluators"]["edges"]
        assert len(edges) == 2
        assert edges[0]["node"]["evaluator"]["name"] == "evaluator-1"
        assert edges[0]["node"]["evaluator"]["kind"] == "LLM"
        assert edges[1]["node"]["evaluator"]["name"] == "evaluator-2"
        assert edges[1]["node"]["evaluator"]["kind"] == "LLM"


@pytest.fixture
async def dataset_with_evaluators(db: DbSessionFactory) -> None:
    """
    Creates a dataset with two evaluators associated via the dataset_evaluators junction table.
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
            name=Identifier("evaluator-1"),
            description="First evaluator",
            output_configs=[
                CategoricalOutputConfig(
                    type="CATEGORICAL",
                    name="goodness",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                    description="goodness description",
                    values=[
                        CategoricalAnnotationValue(label="good", score=1.0),
                        CategoricalAnnotationValue(label="bad", score=0.0),
                    ],
                )
            ],
            prompt_id=prompt.id,
        )
        evaluator_2 = models.LLMEvaluator(
            name=Identifier("evaluator-2"),
            description="Second evaluator",
            output_configs=[
                CategoricalOutputConfig(
                    type="CATEGORICAL",
                    name="correctness",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                    description="correctness description",
                    values=[
                        CategoricalAnnotationValue(label="correct", score=1.0),
                        CategoricalAnnotationValue(label="incorrect", score=0.0),
                    ],
                )
            ],
            prompt_id=prompt.id,
        )
        session.add_all([evaluator_1, evaluator_2])
        await session.flush()

        # Associate evaluators with dataset via junction table
        dataset_evaluator_1 = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator_1.id,
            name=Identifier(root="evaluator-1"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[],
            project=models.Project(
                name=f"{dataset.name}/evaluator-1", description="Project for evaluator-1"
            ),
        )
        dataset_evaluator_2 = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator_2.id,
            name=Identifier(root="evaluator-2"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[],
            project=models.Project(
                name=f"{dataset.name}/evaluator-2", description="Project for evaluator-2"
            ),
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
                            year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc
                        ),
                    },
                    {
                        "dataset_id": datasets[0].id,
                        "created_at": datetime(
                            year=2020, month=2, day=2, hour=0, minute=0, tzinfo=timezone.utc
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
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
        )
        session.add(dataset_example)
        await session.flush()

        dataset_version_1 = models.DatasetVersion(
            id=1,
            dataset_id=1,
            description="version-1-description",
            metadata_={"version-1-metadata-key": "version-1-metadata-value"},
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
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
                year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc
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
                year=2020, month=1, day=1, hour=0, minute=1, tzinfo=timezone.utc
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
async def many_datasets_with_examples(db: DbSessionFactory) -> Mapping[str, int]:
    """
    Twelve datasets where dataset i contains i active examples plus one deleted
    example that must not be counted. The first two examples of dataset 3 are
    assigned to dataset split 1. Returns a mapping from dataset global ID to its
    expected active example count.
    """
    expected_counts: dict[str, int] = {}
    async with db() as session:
        split = models.DatasetSplit(
            id=1,
            name="train",
            description=None,
            color="#0000FF",
            metadata_={},
        )
        session.add(split)
        example_id = 0
        revision_id = 0
        for dataset_index in range(1, 13):
            session.add(
                models.Dataset(
                    id=dataset_index,
                    name=f"dataset-{dataset_index}",
                    description=None,
                    metadata_={},
                )
            )
            await session.flush()
            session.add(
                models.DatasetVersion(
                    id=dataset_index,
                    dataset_id=dataset_index,
                    description=None,
                    metadata_={},
                )
            )
            await session.flush()
            for example_index in range(dataset_index):
                example_id += 1
                session.add(models.DatasetExample(id=example_id, dataset_id=dataset_index))
                await session.flush()
                revision_id += 1
                session.add(
                    models.DatasetExampleRevision(
                        id=revision_id,
                        dataset_example_id=example_id,
                        dataset_version_id=dataset_index,
                        input={},
                        output={},
                        metadata_={},
                        revision_kind="CREATE",
                    )
                )
                if dataset_index == 3 and example_index < 2:
                    session.add(
                        models.DatasetSplitDatasetExample(
                            dataset_split_id=1,
                            dataset_example_id=example_id,
                        )
                    )
            session.add(
                models.DatasetVersion(
                    id=dataset_index + 100,
                    dataset_id=dataset_index,
                    description=None,
                    metadata_={},
                )
            )
            example_id += 1
            session.add(models.DatasetExample(id=example_id, dataset_id=dataset_index))
            await session.flush()
            for version_id, revision_kind in (
                (dataset_index, "CREATE"),
                (dataset_index + 100, "DELETE"),
            ):
                revision_id += 1
                session.add(
                    models.DatasetExampleRevision(
                        id=revision_id,
                        dataset_example_id=example_id,
                        dataset_version_id=version_id,
                        input={},
                        output={},
                        metadata_={},
                        revision_kind=revision_kind,
                    )
                )
            await session.flush()
            expected_counts[str(GlobalID("Dataset", str(dataset_index)))] = dataset_index
    return expected_counts


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
            created_at=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=timezone.utc),
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
async def dataset_with_ephemeral_experiment(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(
            models.Dataset(
                id=1,
                name="dataset-name",
                description=None,
                metadata_={},
            )
        )
        await session.flush()

        session.add(
            models.DatasetVersion(
                id=1,
                dataset_id=1,
                description=None,
                metadata_={},
            )
        )
        await session.flush()

        await session.execute(
            insert(models.Experiment).returning(models.Experiment.id),
            [
                {
                    "dataset_id": 1,
                    "dataset_version_id": 1,
                    "name": "persisted-exp",
                    "repetitions": 1,
                    "metadata_": {},
                },
                {
                    "dataset_id": 1,
                    "dataset_version_id": 1,
                    "name": "playground",
                    "is_ephemeral": True,
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


@pytest.fixture
async def dataset_created_and_updated_by_different_users(db: DbSessionFactory) -> dict[str, str]:
    """
    A dataset owned by one user whose latest version was authored by another, plus a dataset with
    no owner and an unattributed version. Returns the expected creator and last editor usernames.
    """
    async with db() as session:
        user_role_id = await session.scalar(
            select(models.UserRole.id).where(models.UserRole.name == "MEMBER")
        )
        assert user_role_id is not None

        def _user(username: str) -> models.User:
            return models.User(
                user_role_id=user_role_id,
                username=username,
                email=f"{token_hex(4)}@test.com",
                password_hash=b"hash",
                password_salt=b"salt",
                reset_password=False,
                auth_method="LOCAL",
            )

        owner, editor = _user("owner"), _user("editor")
        session.add_all([owner, editor])
        await session.flush()

        collaborative = models.Dataset(name="collaborative-dataset", metadata_={})
        collaborative.user_id = owner.id
        unattributed = models.Dataset(name="unattributed-dataset", metadata_={})
        session.add_all([collaborative, unattributed])
        await session.flush()

        # The latest version's author is the editor, not the dataset's owner.
        for author_id in (owner.id, editor.id):
            session.add(
                models.DatasetVersion(dataset_id=collaborative.id, metadata_={}, user_id=author_id)
            )
            await session.flush()

        session.add(models.DatasetVersion(dataset_id=unattributed.id, metadata_={}))
        await session.commit()

        return {"createdBy": "owner", "updatedBy": "editor"}


async def test_dataset_created_by_is_its_owner_and_updated_by_is_its_latest_version_author(
    gql_client: AsyncGraphQLClient,
    dataset_created_and_updated_by_different_users: dict[str, str],
) -> None:
    query = """
      query {
        datasets {
          edges {
            node {
              name
              createdBy { username }
              updatedBy { username }
            }
          }
        }
      }
    """
    response = await gql_client.execute(query=query)
    assert not response.errors
    assert response.data
    nodes = {edge["node"]["name"]: edge["node"] for edge in response.data["datasets"]["edges"]}

    expected = dataset_created_and_updated_by_different_users
    collaborative = nodes["collaborative-dataset"]
    assert collaborative["createdBy"]["username"] == expected["createdBy"]
    assert collaborative["updatedBy"]["username"] == expected["updatedBy"]

    unattributed = nodes["unattributed-dataset"]
    assert unattributed["createdBy"] is None
    assert unattributed["updatedBy"] is None
