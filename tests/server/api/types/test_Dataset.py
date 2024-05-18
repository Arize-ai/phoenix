from datetime import datetime

import pytest
import pytz
from phoenix.db import models
from strawberry.relay import GlobalID


async def test_dataset_examples_resolver_returns_latest_revisions(
    test_client,
    dataset_with_patch_revision,
) -> None:
    response = await test_client.post(
        "/graphql",
        json={
            "query": DATASET_EXAMPLES_QUERY,
            "variables": {
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {
        "node": {
            "examples": {
                "edges": [
                    {
                        "node": {
                            "id": str(GlobalID(type_name="DatasetExample", node_id=str(2))),
                            "input": {"input": "second-input"},
                            "output": {"output": "second-output"},
                            "createdAt": "2020-01-01T00:00:00+00:00",
                        }
                    }
                ]
            }
        }
    }


async def test_dataset_examples_resolver_returns_latest_example_revisions_up_to_dataset_version(
    test_client,
    dataset_with_patch_revision,
) -> None:
    response = await test_client.post(
        "/graphql",
        json={
            "query": DATASET_EXAMPLES_QUERY,
            "variables": {
                "datasetId": str(GlobalID("Dataset", str(1))),
                "datasetVersionId": str(GlobalID("DatasetVersion", str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {
        "node": {
            "examples": {
                "edges": [
                    {
                        "node": {
                            "id": str(GlobalID(type_name="DatasetExample", node_id=str(1))),
                            "input": {"input": "first-input"},
                            "output": {"output": "first-output"},
                            "createdAt": "2020-01-01T00:00:00+00:00",
                        }
                    }
                ]
            }
        }
    }


async def test_dataset_examples_resolver_excludes_deleted_examples(
    test_client, dataset_with_deletion
) -> None:
    response = await test_client.post(
        "/graphql",
        json={
            "query": DATASET_EXAMPLES_QUERY,
            "variables": {
                "datasetId": str(GlobalID("Dataset", str(1))),
            },
        },
    )
    assert response.status_code == 200
    response_json = response.json()
    assert (errors := response_json.get("errors")) is None, errors
    assert response_json["data"] == {"node": {"examples": {"edges": []}}}


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
        description="this dataset changes over time",
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
async def dataset_with_deletion(session):
    """
    A dataset with a single example and two versions. In the first version, the
    dataset example is created. In the second version, the dataset example is
    deleted.
    """

    dataset = models.Dataset(
        id=1,
        name="dataset-name",
        description="this dataset changes over time",
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


DATASET_EXAMPLES_QUERY = """
query($datasetId: GlobalID!, $datasetVersionId: GlobalID) {
	node(id:$datasetId) {
    ...on Dataset {
      examples(datasetVersionId: $datasetVersionId) {
        edges {
          node {
            id
            input
            output
            createdAt
          }
        }
      }
    }
  }
}
"""
