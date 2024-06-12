from datetime import datetime
from typing import List

import pytest
import pytz
from phoenix.db import models
from phoenix.server.api.types.Experiment import Experiment
from sqlalchemy import insert
from strawberry.relay import GlobalID


class TestDatasetExampleNodeInterface:
    QUERY = """
      query ($exampleId: GlobalID!, $datasetVersionId: GlobalID = null) {
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
        test_client,
        dataset_with_patch_revision,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "exampleId": example_id,
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        actual_example = response_json["data"]["example"]
        assert actual_example == {
            "id": example_id,
            "createdAt": "2020-01-01T00:00:00+00:00",
            "revision": {
                "input": {"input": "second-input"},
                "output": {"output": "second-output"},
                "metadata": {},
                "revisionKind": "PATCH",
            },
        }

    async def test_returns_latest_revision_up_to_specified_version(
        self,
        test_client,
        dataset_with_patch_revision,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "exampleId": example_id,
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        actual_example = response_json["data"]["example"]
        assert actual_example == {
            "id": example_id,
            "createdAt": "2020-01-01T00:00:00+00:00",
            "revision": {
                "input": {"input": "first-input"},
                "output": {"output": "first-output"},
                "metadata": {},
                "revisionKind": "CREATE",
            },
        }

    async def test_returns_latest_revision_up_to_version_even_if_version_does_not_change_example(
        self,
        test_client,
        dataset_with_three_versions,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "exampleId": example_id,
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(2))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        actual_example = response_json["data"]["example"]
        assert actual_example == {
            "id": example_id,
            "createdAt": "2020-01-01T00:00:00+00:00",
            "revision": {
                "input": {"input": "first-input"},
                "output": {"output": "first-output"},
                "metadata": {},
                "revisionKind": "CREATE",
            },
        }

    async def test_non_existent_version_id_returns_error(
        self,
        test_client,
        dataset_with_patch_revision,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "exampleId": example_id,
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(100))),  # doesn't exist
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert len(errors := response_json.get("errors")) == 1
        assert errors[0]["message"] == "Could not find revision."

    async def test_deleted_dataset_example_returns_error(
        self,
        test_client,
        dataset_with_deletion,
    ) -> None:
        example_id = str(GlobalID("DatasetExample", str(1)))
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "exampleId": example_id,
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert len(errors := response_json.get("errors")) == 1
        assert errors[0]["message"] == f"Unknown dataset example: {example_id}"


class TestDatasetExampleCountResolver:
    QUERY = """
      query ($datasetId: GlobalID!, $datasetVersionId: GlobalID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            exampleCount(datasetVersionId: $datasetVersionId)
          }
        }
      }
    """  # noqa: E501

    async def test_count_uses_latest_version_when_no_version_is_specified(
        self, test_client, dataset_with_deletion
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {"node": {"exampleCount": 0}}

    async def test_count_uses_specified_version(self, test_client, dataset_with_deletion) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {"node": {"exampleCount": 1}}


class TestDatasetExamplesResolver:
    QUERY = """
      query ($datasetId: GlobalID!, $datasetVersionId: GlobalID = null, $revisionDatasetVersionId: GlobalID = null) {
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
        test_client,
        dataset_with_patch_revision,
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
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
        assert response_json["data"] == {"node": {"examples": {"edges": edges}}}

    async def test_excludes_deleted_examples(self, test_client, dataset_with_deletion) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {"node": {"examples": {"edges": []}}}

    async def test_returns_latest_revisions_up_to_specified_version(
        self, test_client, dataset_with_patch_revision
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
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
        assert response_json["data"] == {"node": {"examples": {"edges": edges}}}

    async def test_returns_latest_revisions_up_to_version_even_if_version_does_not_change_example(
        self, test_client, dataset_with_three_versions
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "datasetVersionId": str(
                        GlobalID("DatasetVersion", str(2))
                    ),  # example is not changed in this version
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {
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
        test_client,
        dataset_with_patch_revision,
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(2))),
                    "revisionDatasetVersionId": str(GlobalID("DatasetVersion", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
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
        assert response_json["data"] == {"node": {"examples": {"edges": edges}}}


class TestDatasetExperimentCountResolver:
    QUERY = """
      query ($datasetId: GlobalID!, $datasetVersionId: GlobalID = null) {
        node(id: $datasetId) {
          ... on Dataset {
            experimentCount(datasetVersionId: $datasetVersionId)
          }
        }
      }
    """  # noqa: E501

    async def test_experiment_count_uses_all_versions_when_no_version_is_specified(
        self, test_client, dataset_with_deletion
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {"node": {"experimentCount": 2}}

    async def test_experiment_count_uses_specified_version(
        self, test_client, dataset_with_deletion
    ) -> None:
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {"node": {"experimentCount": 1}}


class TestDatasetExperimentsResolver:
    QUERY = """
      query ($datasetId: GlobalID!) {
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
        test_client,
        interlaced_experiments: List[int],
    ) -> None:
        variables = {"datasetId": str(GlobalID("Dataset", str(2)))}
        response = await test_client.post(
            "/graphql",
            json={"query": self.QUERY, "variables": variables},
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        edges = [
            {"node": {"sequenceNumber": 4, "id": str(GlobalID(Experiment.__name__, str(11)))}},
            {"node": {"sequenceNumber": 3, "id": str(GlobalID(Experiment.__name__, str(8)))}},
            {"node": {"sequenceNumber": 2, "id": str(GlobalID(Experiment.__name__, str(5)))}},
            {"node": {"sequenceNumber": 1, "id": str(GlobalID(Experiment.__name__, str(2)))}},
        ]
        assert response_json["data"] == {"node": {"experiments": {"edges": edges}}}


@pytest.fixture
async def dataset_with_patch_revision(session):
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    patched.
    """

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
async def dataset_with_three_versions(session):
    """
    A dataset with a single example and three versions. In the first version,
    the dataset example is created. The second version has no associated
    revisions. In the third version, the dataset example is patched.
    """

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

    dataset_version_3 = models.DatasetVersion(
        id=3,
        dataset_id=1,
        description=None,
        metadata_={},
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
async def dataset_with_deletion(session):
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    deleted.
    """

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
            {"dataset_id": 1, "dataset_version_id": 1, "metadata_": {}},
            {"dataset_id": 1, "dataset_version_id": 2, "metadata_": {}},
        ],
    )
