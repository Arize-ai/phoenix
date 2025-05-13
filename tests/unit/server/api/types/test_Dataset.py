from collections.abc import Mapping
from datetime import datetime
from typing import Any

import pytest
import pytz
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
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

    async def test_deleted_dataset_example_returns_error(
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
        assert response.errors
        assert response.errors[0].message == f"Unknown dataset example: {example_id}"


class TestDatasetExampleCountResolver:
    QUERY = """
      query ($datasetId: ID!, $datasetVersionId: ID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            exampleCount(datasetVersionId: $datasetVersionId)
          }
        }
      }
    """  # noqa: E501

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
      query ($datasetId: ID!, $datasetVersionId: ID = null, $revisionDatasetVersionId: ID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            examples(datasetVersionId: $datasetVersionId) {
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
    """  # noqa: E501

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
    """  # noqa: E501

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
    """  # noqa: E501

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
            input={"input": "first-input"},
            output={"output": "first-output"},
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
