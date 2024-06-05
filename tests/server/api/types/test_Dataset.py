from datetime import datetime

import pytest
import pytz
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
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


class TestDatasetExampleSpanResolver:
    QUERY = """
      query ($exampleId: GlobalID!) {
        example: node(id: $exampleId) {
          ... on DatasetExample {
            id
            span {
              name
              spanKind
              startTime
              endTime
              attributes
              events {
                name
              }
              statusCode
              statusMessage
              cumulativeTokenCountPrompt
              cumulativeTokenCountCompletion
              cumulativeTokenCountTotal
            }
          }
        }
      }
    """

    async def test_returns_span_when_exists(
        self, test_client, dataset_with_span_and_nonspan_examples
    ):
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

    async def test_returns_none_when_does_not_exist(self):
        assert False


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
        assert response_json["data"] == {
            "node": {
                "examples": {
                    "edges": [
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
                        }
                    ]
                }
            }
        }

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


@pytest.fixture
async def dataset_with_patch_revision(session):
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    patched.
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
        input={"input": "second-input"},
        output={"output": "second-output"},
        metadata_={},
        revision_kind="PATCH",
    )
    session.add(dataset_example_revision_2)
    await session.flush()


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


@pytest.fixture
async def dataset_with_span_and_nonspan_examples(session):
    """
    Dataset with two examples, one that comes from a span and one that does not.
    """
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_rowid = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="0f5bb2e69a0640de87b9d424622b9f13",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
            end_time=datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
        )
        .returning(models.Trace.id)
    )
    span_rowid = await session.scalar(
        insert(models.Span)
        .values(
            trace_rowid=trace_rowid,
            span_id="c0055a08295841ab946f2a16e5089fad",
            parent_id=None,
            name="query",
            span_kind="CHAIN",
            start_time=datetime.fromisoformat("2023-12-11T17:43:23.306838+00:00"),
            end_time=datetime.fromisoformat("2023-12-11T17:43:25.534589+00:00"),
            attributes={
                "openinference": {"span": {"kind": "CHAIN"}},
                "output": {
                    "value": "To use the SDK to upload a ranking model, you can follow the documentation provided by the SDK. The documentation will guide you through the necessary steps to upload the model and integrate it into your system. Make sure to carefully follow the instructions to ensure a successful upload and integration process."  # noqa: E501
                },
                "input": {"value": "How do I use the SDK to upload a ranking model?"},
            },
            events=[],
            status_code="OK",
            status_message="",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=240,
            cumulative_llm_token_count_completion=56,
        )
        .returning(models.Span.id)
    )
    dataset_id = await session.scalar(
        insert(models.Dataset)
        .values(
            name="dataset-name",
            description="dataset-description",
            metadata_={"metadata": "dataset-metadata"},
        )
        .returning(models.Dataset.id)
    )
    example_1_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
            span_rowid=span_rowid,
        )
        .returning(models.DatasetExample.id)
    )
    example_2_id = await session.scalar(
        insert(models.DatasetExample)
        .values(
            dataset_id=dataset_id,
        )
        .returning(models.DatasetExample.id)
    )
    version_id = await session.scalar(
        insert(models.DatasetVersion)
        .values(
            dataset_id=dataset_id,
            description="dataset-version-description",
            metadata_={"metadata": "dataset-version-metadata"},
        )
        .returning(models.DatasetVersion.id)
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_1_id,
            dataset_version_id=version_id,
            input={"input": "example-1-revision-1-input"},
            output={"output": "example-1-revision-1-output"},
            metadata_={"metadata": "example-1-revision-1-metadata"},
            revision_kind="CREATE",
        )
    )
    await session.execute(
        insert(models.DatasetExampleRevision).values(
            dataset_example_id=example_2_id,
            dataset_version_id=version_id,
            input={"input": "example-2-revision-1-input"},
            output={"output": "example-2-revision-1-output"},
            metadata_={"metadata": "example-2-revision-1-metadata"},
            revision_kind="CREATE",
        )
    )
