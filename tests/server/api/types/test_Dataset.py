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
    sort_direction, expected_versions, test_client, dataset_with_three_versions
):
    query = """
      query ($datasetId: GlobalID!, $dir: SortDir!, $col: DatasetVersionColumn!) {
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
    response = await test_client.post(
        "/graphql",
        json={
            "query": query,
            "variables": {
                "datasetId": str(GlobalID("Dataset", str(1))),
                "dir": sort_direction,
                "col": "createdAt",
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert response_json.get("errors") is None
    assert response_json["data"] == {"dataset": {"versions": {"edges": expected_versions}}}


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


class TestDatasetCompareExperiments:
    QUERY = """
      query ($datasetId: GlobalID!, $experimentIds: [GlobalID!]!) {
        dataset: node(id: $datasetId) {
          ... on Dataset {
            compareExperiments(experimentIds: $experimentIds) {
              edges {
                comparison: node {
                  id
                  example {
                    id
                  }
                  runs {
                    ... on ExperimentRun {
                      ...ExperimentRunFields
                    }
                    ... on RepeatedExperimentRuns {
                      runs {
                        ...ExperimentRunFields
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      fragment ExperimentRunFields on ExperimentRun {
        id
        experimentId
        traceId
        output
        startTime
        endTime
        error
      }
    """

    async def test(self, test_client, comparison_experiments):
        response = await test_client.post(
            "/graphql",
            json={
                "query": self.QUERY,
                "variables": {
                    "datasetId": str(GlobalID("Dataset", str(1))),
                    "experimentIds": [
                        str(GlobalID("Experiment", str(2))),
                        str(GlobalID("Experiment", str(1))),
                        str(GlobalID("Experiment", str(3))),
                        str(GlobalID("Experiment", str(4))),
                    ],
                },
            },
        )
        assert response.status_code == 200
        response_json = response.json()
        assert response_json.get("errors") is None
        assert response_json["data"] == {
            "dataset": {
                "compareExperiments": {
                    "edges": [
                        {
                            "comparison": {
                                "id": str(GlobalID("ExperimentComparison", str(1))),
                                "example": {"id": str(GlobalID("DatasetExample", str(1)))},
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(1))),
                                        "experimentId": str(GlobalID("Experiment", str(1))),
                                        "traceId": None,
                                        "output": {
                                            "version-1-experiment-1-example-1-run-output-key": "version-1-experiment-1-example-1-run-output-value"  # noqa: E501
                                        },
                                        "startTime": "2020-01-01T00:00:00+00:00",
                                        "endTime": "2020-01-01T00:00:00+00:00",
                                        "error": None,
                                    },
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(5))),
                                        "experimentId": str(GlobalID("Experiment", str(3))),
                                        "traceId": None,
                                        "output": None,
                                        "startTime": "2020-01-01T00:00:00+00:00",
                                        "endTime": "2020-01-01T00:00:00+00:00",
                                        "error": "version-2-experiment-2-example-1-run-error",
                                    },
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(6))),
                                        "experimentId": str(GlobalID("Experiment", str(4))),
                                        "traceId": None,
                                        "output": {
                                            "version-3-experiment-1-example-1-run-output-key": "version-3-experiment-1-example-1-run-output-value"  # noqa: E501
                                        },
                                        "startTime": "2020-01-01T00:00:00+00:00",
                                        "endTime": "2020-01-01T00:00:00+00:00",
                                        "error": None,
                                    },
                                ],
                            }
                        },
                        {
                            "comparison": {
                                "id": str(GlobalID("ExperimentComparison", str(1))),
                                "example": {"id": str(GlobalID("DatasetExample", str(2)))},
                                "runs": [
                                    {
                                        "id": str(GlobalID("ExperimentRun", str(7))),
                                        "experimentId": str(GlobalID("Experiment", str(4))),
                                        "traceId": None,
                                        "output": {
                                            "version-3-experiment-1-example-2-run-output-key": "version-3-experiment-1-example-2-run-output-value"  # noqa: E501
                                        },
                                        "startTime": "2020-01-01T00:00:00+00:00",
                                        "endTime": "2020-01-01T00:00:00+00:00",
                                        "error": None,
                                    }
                                ],
                            }
                        },
                    ]
                }
            }
        }


@pytest.fixture
async def comparison_experiments(session):
    """
    Creates a dataset with four examples, three versions, and four experiments.

                Version 1   Version 2   Version 3
    Example 1   CREATED     PATCHED     PATCHED
    Example 2               CREATED
    Example 3   CREATED     DELETED
    Example 4                           CREATED

    Experiment 1: V1
    Experiment 2: V2
    Experiment 3: V2 (interrupted by an error)
    Experiment 4: V3
    """

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

    # insert examples
    example_1_id = await session.scalar(
        insert(models.DatasetExample)
        .returning(models.DatasetExample.id)
        .values(
            dataset_id=dataset_id,
        )
    )
    example_2_id = await session.scalar(
        insert(models.DatasetExample)
        .returning(models.DatasetExample.id)
        .values(
            dataset_id=dataset_id,
        )
    )
    example_3_id = await session.scalar(
        insert(models.DatasetExample)
        .returning(models.DatasetExample.id)
        .values(
            dataset_id=dataset_id,
        )
    )
    example_4_id = await session.scalar(
        insert(models.DatasetExample)
        .returning(models.DatasetExample.id)
        .values(
            dataset_id=dataset_id,
        )
    )

    # insert versions
    version_1_id = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="version-1-description",
            metadata_={"version-1-metadata-key": "version-1-metadata-value"},
        )
    )
    version_2_id = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="version-2-description",
            metadata_={"version-2-metadata-key": "version-2-metadata-value"},
        )
    )
    version_3_id = await session.scalar(
        insert(models.DatasetVersion)
        .returning(models.DatasetVersion.id)
        .values(
            dataset_id=dataset_id,
            description="version-3-description",
            metadata_={"version-3-metadata-key": "version-3-metadata-value"},
        )
    )

    # insert revisions for example 1 (created in version 1, patched in versions 2 and 3)
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_1_id,
            dataset_version_id=version_1_id,
            input={
                "example-1-version-1-revision-input-key": "example-1-version-1-revision-input-value"
            },
            output={
                "example-1-version-1-revision-output-key": "example-1-version-1-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-1-version-1-revision-metadata-key": "example-1-version-1-revision-metadata-value"  # noqa: E501
            },
            revision_kind="CREATE",
        )
    )
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_1_id,
            dataset_version_id=version_2_id,
            input={
                "example-1-version-2-revision-input-key": "example-1-version-2-revision-input-value"
            },
            output={
                "example-1-version-2-revision-output-key": "example-1-version-2-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-1-version-2-revision-metadata-key": "example-1-version-2-revision-metadata-value"  # noqa: E501
            },
            revision_kind="PATCH",
        )
    )
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_1_id,
            dataset_version_id=version_3_id,
            input={
                "example-1-version-3-revision-input-key": "example-1-version-3-revision-input-value"
            },
            output={
                "example-1-version-3-revision-output-key": "example-1-version-3-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-1-version-3-revision-metadata-key": "example-1-version-3-revision-metadata-value"  # noqa: E501
            },
            revision_kind="PATCH",
        )
    )

    # insert revisions for example 2 (created in version 2)
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_2_id,
            dataset_version_id=version_2_id,
            input={
                "example-2-version-2-revision-input-key": "example-2-version-2-revision-input-value"
            },
            output={
                "example-2-version-2-revision-output-key": "example-2-version-2-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-2-version-2-revision-metadata-key": "example-2-version-2-revision-metadata-value"  # noqa: E501
            },
            revision_kind="CREATE",
        )
    )

    # insert revisions for example 3 (created in version 1, deleted in version 2)
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_3_id,
            dataset_version_id=version_1_id,
            input={
                "example-3-version-1-revision-input-key": "example-3-version-1-revision-input-value"
            },
            output={
                "example-3-version-1-revision-output-key": "example-3-version-1-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-3-version-1-revision-metadata-key": "example-3-version-1-revision-metadata-value"  # noqa: E501
            },
            revision_kind="CREATE",
        )
    )
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_3_id,
            dataset_version_id=version_2_id,
            input={},
            output={},
            metadata_={},
            revision_kind="DELETE",
        )
    )

    # insert revisions for example 4 (created in version 3)
    await session.scalar(
        insert(models.DatasetExampleRevision)
        .returning(models.DatasetExampleRevision.id)
        .values(
            dataset_example_id=example_4_id,
            dataset_version_id=version_3_id,
            input={
                "example-4-version-3-revision-input-key": "example-4-version-3-revision-input-value"
            },
            output={
                "example-4-version-3-revision-output-key": "example-4-version-3-revision-output-value"  # noqa: E501
            },
            metadata_={
                "example-4-version-3-revision-metadata-key": "example-4-version-3-revision-metadata-value"  # noqa: E501
            },
            revision_kind="CREATE",
        )
    )

    # insert an experiment for version 1
    version_1_experiment_1_id = await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_1_id,
            description="version-1-experiment-1-description",
            metadata_={
                "version-1-experiment-1-metadata-key": "version-1-experiment-1-metadata-value"
            },
        )
    )

    # insert two experiments for version 2
    version_2_experiment_1_id = await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_2_id,
            description="version-2-experiment-1-description",
            metadata_={
                "version-2-experiment-1-metadata-key": "version-2-experiment-1-metadata-value"
            },
        )
    )
    version_2_experiment_2_id = await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_2_id,
            description="version-2-experiment-2-description",
            metadata_={
                "version-2-experiment-2-metadata-key": "version-2-experiment-2-metadata-value"
            },
        )
    )

    # insert an experiment for version 3
    version_3_experiment_1_id = await session.scalar(
        insert(models.Experiment)
        .returning(models.Experiment.id)
        .values(
            dataset_id=dataset_id,
            dataset_version_id=version_1_id,
            description="version-3-experiment-1-description",
            metadata_={
                "version-3-experiment-1-metadata-key": "version-3-experiment-1-metadata-value"
            },
        )
    )

    # insert runs for version 1 experiment 1
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_1_experiment_1_id,
            dataset_example_id=example_1_id,
            trace_id=None,
            output={
                "version-1-experiment-1-example-1-run-output-key": "version-1-experiment-1-example-1-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_1_experiment_1_id,
            dataset_example_id=example_3_id,
            trace_id=None,
            output={
                "version-1-experiment-1-example-3-run-output-key": "version-1-experiment-1-example-3-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )

    # insert runs for version 2 experiment 1
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_2_experiment_1_id,
            dataset_example_id=example_1_id,
            trace_id=None,
            output={
                "version-2-experiment-1-example-1-run-output-key": "version-2-experiment-1-example-1-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_2_experiment_1_id,
            dataset_example_id=example_2_id,
            trace_id=None,
            output={
                "version-2-experiment-1-example-2-run-output-key": "version-2-experiment-1-example-2-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )

    # insert run for version 2 experiment 2
    # one run has an error and is missing output
    # no run was created for subsequent examples since it failed out
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_2_experiment_2_id,
            dataset_example_id=example_1_id,
            trace_id=None,
            output=None,
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error="version-2-experiment-2-example-1-run-error",
        )
    )

    # insert run for version 3 experiment 1
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_3_experiment_1_id,
            dataset_example_id=example_1_id,
            trace_id=None,
            output={
                "version-3-experiment-1-example-1-run-output-key": "version-3-experiment-1-example-1-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_3_experiment_1_id,
            dataset_example_id=example_2_id,
            trace_id=None,
            output={
                "version-3-experiment-1-example-2-run-output-key": "version-3-experiment-1-example-2-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )
    await session.scalar(
        insert(models.ExperimentRun)
        .returning(models.ExperimentRun.id)
        .values(
            experiment_id=version_3_experiment_1_id,
            dataset_example_id=example_4_id,
            trace_id=None,
            output={
                "version-3-experiment-1-example-4-run-output-key": "version-3-experiment-1-example-4-run-output-value"  # noqa: E501
            },
            start_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            end_time=datetime(year=2020, month=1, day=1, hour=0, minute=0, tzinfo=pytz.utc),
            error=None,
        )
    )


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
            {"dataset_id": 1, "dataset_version_id": 1, "name": "exp-1", "metadata_": {}},
            {"dataset_id": 1, "dataset_version_id": 2, "name": "exp-2", "metadata_": {}},
        ],
    )
