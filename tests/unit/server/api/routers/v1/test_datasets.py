import gzip
import inspect
import io
import json
from datetime import datetime, timezone
from io import BytesIO, StringIO
from typing import Any

import httpx
import pandas as pd
import pyarrow as pa
import pytest
from httpx import HTTPStatusError
from pandas.testing import assert_frame_equal
from sqlalchemy import insert, select
from sqlalchemy.orm import joinedload
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.insertion.dataset import ExampleContent
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion as DatasetVersionType
from phoenix.server.types import DbSessionFactory


async def test_get_simple_dataset(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    response = await httpx_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()["data"]

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values = {
        "id": str(global_id),
        "name": "simple dataset",
        "description": None,
        "metadata": {"info": "a test dataset"},
        "example_count": 1,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())


async def test_get_empty_dataset(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(1))
    response = await httpx_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()["data"]

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values = {
        "id": str(global_id),
        "name": "empty dataset",
        "description": "emptied after two revisions",
        "metadata": {},
        "example_count": 0,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())


async def test_get_dataset_with_revisions(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()["data"]

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values = {
        "id": str(global_id),
        "name": "revised dataset",
        "description": "this dataset grows over time",
        "metadata": {},
        "example_count": 3,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())


async def test_list_datasets(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
    empty_dataset: Any,
    dataset_with_revisions: Any,
) -> None:
    response = await httpx_client.get("/v1/datasets")
    assert response.status_code == 200
    datasets_json = response.json()

    assert datasets_json["next_cursor"] is None, "no next cursor when all datasets are returned"

    datasets = datasets_json["data"]
    assert len(datasets) == 3

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values: dict[str, Any] = {
        "id": str(GlobalID("Dataset", str(2))),
        "name": "revised dataset",
        "description": "this dataset grows over time",
        "metadata": {},
    }
    assert all(item in datasets[0].items() for item in fixture_values.items())

    assert "created_at" in datasets[1]
    assert "updated_at" in datasets[1]
    fixture_values = {
        "id": str(GlobalID("Dataset", str(1))),
        "name": "empty dataset",
        "description": "emptied after two revisions",
        "metadata": {},
    }
    assert all(item in datasets[1].items() for item in fixture_values.items())

    assert "created_at" in datasets[2]
    assert "updated_at" in datasets[2]
    fixture_values = {
        "id": str(GlobalID("Dataset", str(0))),
        "name": "simple dataset",
        "description": None,
        "metadata": {"info": "a test dataset"},
    }
    assert all(item in datasets[2].items() for item in fixture_values.items())


async def test_list_fewer_datasets(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
    empty_dataset: Any,
) -> None:
    response = await httpx_client.get("/v1/datasets")
    assert response.status_code == 200
    datasets_json = response.json()

    assert datasets_json["next_cursor"] is None, "no next cursor when all datasets are returned"

    datasets = datasets_json["data"]
    assert len(datasets) == 2

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values: dict[str, Any] = {
        "id": str(GlobalID("Dataset", str(1))),
        "name": "empty dataset",
        "description": "emptied after two revisions",
        "metadata": {},
    }
    assert all(item in datasets[0].items() for item in fixture_values.items())

    assert "created_at" in datasets[1]
    assert "updated_at" in datasets[1]
    fixture_values = {
        "id": str(GlobalID("Dataset", str(0))),
        "name": "simple dataset",
        "description": None,
        "metadata": {"info": "a test dataset"},
    }
    assert all(item in datasets[1].items() for item in fixture_values.items())


async def test_list_datasets_with_cursor(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
    empty_dataset: Any,
    dataset_with_revisions: Any,
) -> None:
    response = await httpx_client.get("/v1/datasets", params={"limit": 2})
    assert response.status_code == 200
    datasets_json = response.json()

    next_cursor = datasets_json["next_cursor"]
    assert next_cursor, "next_cursor supplied when datasets remain"

    datasets = datasets_json["data"]
    assert len(datasets) == 2, "only return two datasets when limit is set to 2"

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values: dict[str, Any] = {
        "id": str(GlobalID("Dataset", str(2))),
        "name": "revised dataset",
        "description": "this dataset grows over time",
        "metadata": {},
    }
    assert all(item in datasets[0].items() for item in fixture_values.items())

    assert "created_at" in datasets[1]
    assert "updated_at" in datasets[1]
    fixture_values = {
        "id": str(GlobalID("Dataset", str(1))),
        "name": "empty dataset",
        "description": "emptied after two revisions",
        "metadata": {},
    }
    assert all(item in datasets[1].items() for item in fixture_values.items())

    second_page = await httpx_client.get("/v1/datasets", params={"limit": 2, "cursor": next_cursor})
    assert second_page.status_code == 200

    second_page_json = second_page.json()
    assert second_page_json["next_cursor"] is None, "no next cursor after all datasets are returned"

    second_page_datasets = second_page_json["data"]
    assert len(second_page_datasets) == 1, "only return one dataset on the second page"

    assert "created_at" in second_page_datasets[0]
    assert "updated_at" in second_page_datasets[0]
    fixture_values = {
        "id": str(GlobalID("Dataset", str(0))),
        "name": "simple dataset",
        "description": None,
        "metadata": {"info": "a test dataset"},
    }
    assert all(item in second_page_datasets[0].items() for item in fixture_values.items())


async def test_get_dataset_versions(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/versions?limit=2")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/json"
    assert response.json() == {
        "next_cursor": f"{GlobalID('DatasetVersion', str(7))}",
        "data": [
            {
                "version_id": str(GlobalID("DatasetVersion", str(9))),
                "description": "datum gets deleted",
                "metadata": {},
                "created_at": "2024-05-28T00:00:09+00:00",
            },
            {
                "version_id": str(GlobalID("DatasetVersion", str(8))),
                "description": "datum gets created",
                "metadata": {},
                "created_at": "2024-05-28T00:00:08+00:00",
            },
        ],
    }


async def test_get_dataset_versions_with_cursor(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/versions?limit=2"
        f"&cursor={GlobalID('DatasetVersion', str(4))}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/json"
    assert response.json() == {
        "next_cursor": None,
        "data": [
            {
                "version_id": str(GlobalID("DatasetVersion", str(4))),
                "created_at": "2024-05-28T00:00:04+00:00",
                "description": "data gets added",
                "metadata": {"info": "gotta get some test data somewhere"},
            },
        ],
    }


async def test_get_dataset_versions_with_nonexistent_cursor(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/versions?limit=1"
        f"&cursor={GlobalID('DatasetVersion', str(1))}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/json"
    assert response.json() == {"next_cursor": None, "data": []}


async def test_get_dataset_download_empty_dataset(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(1))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/csv")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''empty%20dataset.csv"
    )
    with pytest.raises(Exception):
        pd.read_csv(StringIO(response.content.decode()))


async def test_get_dataset_download_nonexistent_version(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(1))
    dataset_version_global_id = GlobalID("DatasetVersion", str(4))  # Version for Dataset id=2
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/csv?version_id={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''empty%20dataset.csv"
    )
    with pytest.raises(Exception):
        pd.read_csv(StringIO(response.content.decode()))


async def test_get_dataset_download_latest_version(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/csv")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''revised%20dataset.csv"
    )
    actual = pd.read_csv(StringIO(response.content.decode())).sort_index(axis=1)
    example_3_gid = str(GlobalID("DatasetExample", "3"))
    example_4_gid = str(GlobalID("DatasetExample", "4"))
    example_5_gid = str(GlobalID("DatasetExample", "5"))
    expected = pd.read_csv(
        StringIO(
            "id,node_id,input.in,metadata.info,output.out\n"
            f"{example_3_gid},{example_3_gid},foo,first revision,bar\n"
            f"{example_4_gid},{example_4_gid},updated foofoo,updating revision,updated barbar\n"
            f"{example_5_gid},{example_5_gid},look at me,a new example,i have all the answers\n"
        )
    ).sort_index(axis=1)
    assert_frame_equal(actual, expected)


async def test_get_dataset_download_specific_version(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    dataset_version_global_id = GlobalID("DatasetVersion", str(8))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/csv?version_id={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''revised%20dataset.csv"
    )
    actual = pd.read_csv(StringIO(response.content.decode())).sort_index(axis=1)
    example_3_gid = str(GlobalID("DatasetExample", "3"))
    example_4_gid = str(GlobalID("DatasetExample", "4"))
    example_5_gid = str(GlobalID("DatasetExample", "5"))
    example_7_gid = str(GlobalID("DatasetExample", "7"))
    expected = pd.read_csv(
        StringIO(
            "id,node_id,input.in,metadata.info,output.out\n"
            f"{example_3_gid},{example_3_gid},foo,first revision,bar\n"
            f"{example_4_gid},{example_4_gid},updated foofoo,updating revision,updated barbar\n"
            f"{example_5_gid},{example_5_gid},look at me,a new example,i have all the answers\n"
            f"{example_7_gid},{example_7_gid},look at me,a newer example,i have all the answers\n"
        )
    ).sort_index(axis=1)
    assert_frame_equal(actual, expected)


async def test_get_dataset_jsonl_openai_ft(
    httpx_client: httpx.AsyncClient,
    dataset_with_messages: tuple[int, int],
) -> None:
    dataset_id, dataset_version_id = dataset_with_messages
    dataset_global_id = GlobalID(Dataset.__name__, str(dataset_id))
    dataset_version_global_id = GlobalID(DatasetVersionType.__name__, str(dataset_version_id))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/jsonl/openai_ft?version_id={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/plain; charset=utf-8"
    assert response.headers.get("content-encoding") == "gzip"
    assert response.headers.get("content-disposition") == "attachment; filename*=UTF-8''xyz.jsonl"
    json_lines = io.StringIO(response.text).readlines()
    assert len(json_lines) == 2
    assert json.loads(json_lines[0]) == {
        "messages": [
            {"role": "system", "content": "x"},
            {"role": "user", "content": "y"},
            {"role": "assistant", "content": "z"},
        ]
    }
    assert json.loads(json_lines[1]) == {
        "messages": [
            {"role": "system", "content": "xx"},
            {"role": "user", "content": "yy"},
            {"role": "assistant", "content": "zz"},
        ]
    }


async def test_get_dataset_jsonl_openai_evals(
    httpx_client: httpx.AsyncClient, dataset_with_messages: tuple[int, int]
) -> None:
    dataset_id, dataset_version_id = dataset_with_messages
    dataset_global_id = GlobalID(Dataset.__name__, str(dataset_id))
    dataset_version_global_id = GlobalID(DatasetVersionType.__name__, str(dataset_version_id))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/jsonl/openai_evals?version_id={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/plain; charset=utf-8"
    assert response.headers.get("content-encoding") == "gzip"
    assert response.headers.get("content-disposition") == "attachment; filename*=UTF-8''xyz.jsonl"
    json_lines = io.StringIO(response.text).readlines()
    assert len(json_lines) == 2
    assert json.loads(json_lines[0]) == {
        "messages": [{"role": "system", "content": "x"}, {"role": "user", "content": "y"}],
        "ideal": "z",
    }
    assert json.loads(json_lines[1]) == {
        "messages": [{"role": "system", "content": "xx"}, {"role": "user", "content": "yy"}],
        "ideal": "zz",
    }


async def test_get_dataset_jsonl_empty_dataset(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(1))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/jsonl")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/plain; charset=utf-8"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''empty%20dataset.jsonl"
    )
    assert response.text.strip() == ""


async def test_get_dataset_jsonl_latest_version(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/jsonl")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/plain; charset=utf-8"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition")
        == "attachment; filename*=UTF-8''revised%20dataset.jsonl"
    )
    json_lines = [json.loads(line) for line in response.text.strip().splitlines()]
    assert len(json_lines) == 3
    for line in json_lines:
        assert set(line.keys()) == {"id", "node_id", "input", "output", "metadata", "splits"}
    example_3_gid = str(GlobalID("DatasetExample", "3"))
    assert json_lines[0]["id"] == example_3_gid
    assert json_lines[0]["node_id"] == example_3_gid
    assert json_lines[0]["input"] == {"in": "foo"}
    assert json_lines[0]["output"] == {"out": "bar"}
    assert json_lines[0]["metadata"] == {"info": "first revision"}
    assert json_lines[0]["splits"] == []
    assert json_lines[1]["input"] == {"in": "updated foofoo"}
    assert json_lines[2]["input"] == {"in": "look at me"}


async def test_get_dataset_jsonl_specific_version(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    dataset_global_id = GlobalID("Dataset", str(2))
    dataset_version_global_id = GlobalID("DatasetVersion", str(8))
    response = await httpx_client.get(
        f"/v1/datasets/{dataset_global_id}/jsonl?version_id={dataset_version_global_id}"
    )
    assert response.status_code == 200
    json_lines = [json.loads(line) for line in response.text.strip().splitlines()]
    assert len(json_lines) == 4


async def test_get_dataset_jsonl_with_splits(
    httpx_client: httpx.AsyncClient,
    dataset_with_splits: tuple[int, int],
) -> None:
    dataset_id, _ = dataset_with_splits
    dataset_global_id = GlobalID("Dataset", str(dataset_id))
    response = await httpx_client.get(f"/v1/datasets/{dataset_global_id}/jsonl")
    assert response.status_code == 200
    json_lines = [json.loads(line) for line in response.text.strip().splitlines()]
    assert len(json_lines) == 3
    for line in json_lines:
        assert set(line.keys()) == {"id", "node_id", "input", "output", "metadata", "splits"}
    by_id = {line["id"]: line for line in json_lines}
    # Example 100 has external_id "ext-1" and is in train split
    assert by_id["ext-1"]["splits"] == ["train"]
    assert by_id["ext-1"]["input"] == {"question": "hello"}
    assert by_id["ext-1"]["output"] == {"answer": "world"}
    assert by_id["ext-1"]["metadata"] == {"source": "test"}
    # node_id is the Phoenix GlobalID regardless of external_id
    assert by_id["ext-1"]["node_id"] == str(GlobalID("DatasetExample", str(100)))
    # Example 101 has no external_id (uses GlobalID) and is in train+test splits
    example_101_gid = str(GlobalID("DatasetExample", str(101)))
    assert sorted(by_id[example_101_gid]["splits"]) == ["test", "train"]
    assert by_id[example_101_gid]["node_id"] == example_101_gid
    # Example 102 has no splits
    example_102_gid = str(GlobalID("DatasetExample", str(102)))
    assert by_id[example_102_gid]["splits"] == []
    assert by_id[example_102_gid]["metadata"] == {"note": "no splits"}
    assert by_id[example_102_gid]["node_id"] == example_102_gid


async def test_post_dataset_upload_json_create_then_append(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"a": 1, "b": 2, "c": 3}],
            "outputs": [{"b": "2", "c": "3", "d": "4"}],
            "metadata": [{"c": 3, "d": 4, "e": 5}],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    assert data["new_version_created"] is True
    assert data["num_created_examples"] == 1
    assert data["num_patched_examples"] == 0
    assert data["num_deleted_examples"] == 0
    del response, data
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"a": 11, "b": 22, "c": 33}],
            "outputs": [{"b": "22", "c": "33", "d": "44"}],
            "metadata": [],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert dataset_id == data.get("dataset_id")
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    assert data["new_version_created"] is True
    assert data["num_created_examples"] == 1
    assert data["num_patched_examples"] == 0
    assert data["num_deleted_examples"] == 0
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    assert revisions[0].input == {"a": 1, "b": 2, "c": 3}
    assert revisions[0].output == {"b": "2", "c": "3", "d": "4"}
    assert revisions[0].metadata_ == {"c": 3, "d": 4, "e": 5}
    assert revisions[1].input == {"a": 11, "b": 22, "c": 33}
    assert revisions[1].output == {"b": "22", "c": "33", "d": "44"}
    assert revisions[1].metadata_ == {}

    # Verify the DatasetVersion from the response
    db_dataset_version = await session.get(models.DatasetVersion, int(version_global_id.node_id))
    assert db_dataset_version is not None
    assert db_dataset_version.dataset_id == int(GlobalID.from_id(dataset_id).node_id)


async def test_post_dataset_upload_json_reupload_reports_no_changes(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    body = {
        "action": "update",
        "name": name,
        "inputs": [{"a": 1}, {"a": 2}],
        "outputs": [{"b": 1}, {"b": 2}],
        "metadata": [{}, {}],
    }
    first_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=body,
    )
    assert first_response.status_code == 200
    first_data = first_response.json()["data"]
    assert first_data["new_version_created"] is True
    assert first_data["num_created_examples"] == 2

    second_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=body,
    )
    assert second_response.status_code == 200
    second_data = second_response.json()["data"]
    assert second_data["dataset_id"] == first_data["dataset_id"]
    assert second_data["version_id"] == first_data["version_id"]
    assert second_data["new_version_created"] is False
    assert second_data["num_created_examples"] == 0
    assert second_data["num_patched_examples"] == 0
    assert second_data["num_deleted_examples"] == 0


async def test_post_dataset_upload_create_conflicts_with_existing_name(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    body = {
        "action": "create",
        "name": name,
        "inputs": [{"a": 1}],
        "outputs": [{"b": 1}],
        "metadata": [{}],
    }
    first_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=body,
    )
    assert first_response.status_code == 200

    conflict_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=body,
    )
    assert conflict_response.status_code == 409
    assert name in conflict_response.text

    # action=update converges instead of conflicting on the existing name.
    update_body = {**body, "action": "update"}
    update_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=update_body,
    )
    assert update_response.status_code == 200


async def test_post_dataset_upload_update_diffs_against_latest_version(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    first_body = {
        "action": "update",
        "name": name,
        "inputs": [{"a": 1}, {"a": 2}, {"a": 3}],
        "outputs": [{"b": 1}, {"b": 2}, {"b": 3}],
        "metadata": [{}, {}, {}],
        "example_ids": ["x", "y", "z"],
    }
    first_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=first_body,
    )
    assert first_response.status_code == 200
    first_data = first_response.json()["data"]
    assert first_data["new_version_created"] is True
    assert first_data["num_created_examples"] == 3
    assert first_data["num_patched_examples"] == 0
    assert first_data["num_deleted_examples"] == 0

    # Re-post the same payload — no-op.
    noop_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=first_body,
    )
    assert noop_response.status_code == 200
    noop_data = noop_response.json()["data"]
    assert noop_data["new_version_created"] is False
    assert noop_data["num_created_examples"] == 0
    assert noop_data["num_patched_examples"] == 0
    assert noop_data["num_deleted_examples"] == 0
    assert noop_data["version_id"] == first_data["version_id"]

    # One patch (y's output changes), one delete (z is missing), one create (w is new).
    mixed_body = {
        "action": "update",
        "name": name,
        "inputs": [{"a": 1}, {"a": 2}, {"a": 4}],
        "outputs": [{"b": 1}, {"b": 222}, {"b": 4}],
        "metadata": [{}, {}, {}],
        "example_ids": ["x", "y", "w"],
    }
    mixed_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json=mixed_body,
    )
    assert mixed_response.status_code == 200
    mixed_data = mixed_response.json()["data"]
    assert mixed_data["new_version_created"] is True
    assert mixed_data["num_created_examples"] == 1
    assert mixed_data["num_patched_examples"] == 1
    assert mixed_data["num_deleted_examples"] == 1


async def test_post_dataset_upload_update_auto_creates_missing_dataset(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "update",
            "name": name,
            "inputs": [{"a": 1}, {"a": 2}],
            "outputs": [{"b": 1}, {"b": 2}],
            "metadata": [{}, {}],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["new_version_created"] is True
    assert data["num_created_examples"] == 2


async def test_post_dataset_upload_csv_create_then_append(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    file = gzip.compress(b"a,b,c,d,e,f\n1,2,3,4,5,6\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    del response, file, data
    file = gzip.compress(b"a,b,c,d,e,f\n11,22,33,44,55,66\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "append",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert dataset_id == data.get("dataset_id")
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    assert revisions[0].input == {"a": "1", "b": "2", "c": "3"}
    assert revisions[0].output == {"b": "2", "c": "3", "d": "4"}
    assert revisions[0].metadata_ == {"c": "3", "d": "4", "e": "5"}
    assert revisions[1].input == {"a": "11", "b": "22", "c": "33"}
    assert revisions[1].output == {"b": "22", "c": "33", "d": "44"}
    assert revisions[1].metadata_ == {"c": "33", "d": "44", "e": "55"}

    # Verify the DatasetVersion from the response
    db_dataset_version = await session.get(models.DatasetVersion, int(version_global_id.node_id))
    assert db_dataset_version is not None
    assert db_dataset_version.dataset_id == int(GlobalID.from_id(dataset_id).node_id)


async def test_post_dataset_upload_jsonl_create_then_append(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    # JSONL format: each line is a JSON object
    jsonl_content = b'{"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    del response, file, data
    jsonl_content = b'{"a": 11, "b": 22, "c": 33, "d": 44, "e": 55, "f": 66}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "append",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert dataset_id == data.get("dataset_id")
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    assert revisions[0].input == {"a": 1, "b": 2, "c": 3}
    assert revisions[0].output == {"b": 2, "c": 3, "d": 4}
    assert revisions[0].metadata_ == {"c": 3, "d": 4, "e": 5}
    assert revisions[1].input == {"a": 11, "b": 22, "c": 33}
    assert revisions[1].output == {"b": 22, "c": 33, "d": 44}
    assert revisions[1].metadata_ == {"c": 33, "d": 44, "e": 55}

    # Verify the DatasetVersion from the response
    db_dataset_version = await session.get(models.DatasetVersion, int(version_global_id.node_id))
    assert db_dataset_version is not None
    assert db_dataset_version.dataset_id == int(GlobalID.from_id(dataset_id).node_id)


async def test_post_dataset_upload_jsonl_preserves_per_row_keys(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Each JSONL example should retain only the keys present in its source row.

    Regression: when rows have disjoint top-level keys, the backend was filling
    missing keys with None, producing the union of keys across every example.
    """
    name = inspect.stack()[0][3]
    jsonl_content = b'{"a": "foo", "x": "m"}\n{"b": "bar", "y": "n"}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b"],
            "output_keys[]": ["x", "y"],
        },
    )
    assert response.status_code == 200
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    assert revisions[0].input == {"a": "foo"}
    assert revisions[0].output == {"x": "m"}
    assert revisions[1].input == {"b": "bar"}
    assert revisions[1].output == {"y": "n"}


async def test_post_dataset_upload_jsonl_preserves_explicit_null(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """An explicit null in a JSONL row must be preserved, distinct from a missing key."""
    name = inspect.stack()[0][3]
    jsonl_content = b'{"a": null, "b": "x"}\n{"b": "y"}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b"],
        },
    )
    assert response.status_code == 200
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    # Row 1: explicit null must be preserved as None.
    assert revisions[0].input == {"a": None, "b": "x"}
    # Row 2: `a` was absent from the source row — it must stay absent, not be filled with None.
    assert revisions[1].input == {"b": "y"}


async def test_post_dataset_upload_pyarrow_create_then_append(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    df = pd.read_csv(StringIO("a,b,c,d,e,f\n1,2,3,4,5,6\n"))
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    file = BytesIO(sink.getvalue().to_pybytes())
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/x-pandas-pyarrow", {})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    del response, file, data, df, table, sink
    df = pd.read_csv(StringIO("a,b,c,d,e,f\n11,22,33,44,55,66\n"))
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    file = BytesIO(sink.getvalue().to_pybytes())
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/x-pandas-pyarrow", {})},
        data={
            "action": "append",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["b", "c", "d"],
            "metadata_keys[]": ["c", "d", "e"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert dataset_id == data.get("dataset_id")
    assert "version_id" in data
    version_id_str = data["version_id"]
    version_global_id = GlobalID.from_id(version_id_str)
    assert version_global_id.type_name == "DatasetVersion"
    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2
    assert revisions[0].input == {"a": 1, "b": 2, "c": 3}
    assert revisions[0].output == {"b": 2, "c": 3, "d": 4}
    assert revisions[0].metadata_ == {"c": 3, "d": 4, "e": 5}
    assert revisions[1].input == {"a": 11, "b": 22, "c": 33}
    assert revisions[1].output == {"b": 22, "c": 33, "d": 44}
    assert revisions[1].metadata_ == {"c": 33, "d": 44, "e": 55}

    # Verify the DatasetVersion from the response
    db_dataset_version = await session.get(models.DatasetVersion, int(version_global_id.node_id))
    assert db_dataset_version is not None
    assert db_dataset_version.dataset_id == int(GlobalID.from_id(dataset_id).node_id)


async def test_delete_dataset(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    url = f"v1/datasets/{GlobalID(Dataset.__name__, str(1))}"
    assert len((await httpx_client.get("v1/datasets")).json()["data"]) > 0
    (await httpx_client.delete(url)).raise_for_status()
    assert len((await httpx_client.get("v1/datasets")).json()["data"]) == 0
    with pytest.raises(HTTPStatusError):
        (await httpx_client.delete(url)).raise_for_status()


async def test_get_dataset_examples_404s_with_nonexistent_dataset_id(
    httpx_client: httpx.AsyncClient,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    response = await httpx_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 404
    assert response.content.decode() == f"No dataset with id {global_id} can be found."


async def test_get_dataset_examples_404s_with_invalid_global_id(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("InvalidDataset", str(0))
    response = await httpx_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 404
    assert "refers to a InvalidDataset" in response.content.decode()


async def test_get_dataset_examples_404s_with_nonexistent_version_id(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    version_id = GlobalID("DatasetVersion", str(99))
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(version_id)}
    )
    assert response.status_code == 404
    assert response.content.decode() == f"No dataset version with id {version_id} can be found."


async def test_get_dataset_examples_404s_with_invalid_version_global_id(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    version_id = GlobalID("InvalidDatasetVersion", str(0))
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(version_id)}
    )
    assert response.status_code == 404
    assert "refers to a InvalidDatasetVersion" in response.content.decode()


async def test_get_simple_dataset_examples(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    response = await httpx_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert data["dataset_id"] == str(GlobalID("Dataset", str(0)))
    assert data["version_id"] == str(GlobalID("DatasetVersion", str(0)))
    examples = data["examples"]
    assert len(examples) == 1
    expected_examples = [
        {
            "id": str(GlobalID("DatasetExample", str(0))),
            "input": {"in": "foo"},
            "output": {"out": "bar"},
            "metadata": {"info": "the first reivision"},
        }
    ]
    for example, expected in zip(examples, expected_examples):
        assert "updated_at" in example
        example_subset = {k: v for k, v in example.items() if k in expected}
        assert example_subset == expected


async def test_get_dataset_examples_prefers_external_id_for_public_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}, {"q": "Q2"}],
            "example_ids": ["external-1", None],
        },
    )
    response.raise_for_status()
    dataset_id = response.json()["data"]["dataset_id"]

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        db_examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )

    list_response = await httpx_client.get(f"/v1/datasets/{dataset_id}/examples")
    list_response.raise_for_status()
    examples = list_response.json()["data"]["examples"]

    assert [example["id"] for example in examples] == [
        "external-1",
        str(GlobalID("DatasetExample", str(db_examples[1].id))),
    ]
    assert all("external_id" not in example for example in examples)


async def test_list_simple_dataset_examples_at_each_version(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(0))
    v0 = GlobalID("DatasetVersion", str(0))

    # one example is created in version 0
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v0)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 1


async def test_list_empty_dataset_examples(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(1))
    response = await httpx_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 0


async def test_list_empty_dataset_examples_at_each_version(
    httpx_client: httpx.AsyncClient,
    empty_dataset: Any,
) -> None:
    global_id = GlobalID("Dataset", str(1))
    v1 = GlobalID("DatasetVersion", str(1))
    v2 = GlobalID("DatasetVersion", str(2))
    v3 = GlobalID("DatasetVersion", str(3))

    # two examples are created in version 1
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v1)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 2

    # two examples are patched in version 2
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v2)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 2

    # two examples are deleted in version 3
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v3)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 0


async def test_list_dataset_with_revisions_examples(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    global_id = GlobalID("Dataset", str(2))
    response = await httpx_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert data["dataset_id"] == str(GlobalID("Dataset", str(2)))
    assert data["version_id"] == str(GlobalID("DatasetVersion", str(9)))
    examples = data["examples"]
    assert len(examples) == 3
    expected_values = [
        {
            "id": str(GlobalID("DatasetExample", str(3))),
            "input": {"in": "foo"},
            "output": {"out": "bar"},
            "metadata": {"info": "first revision"},
        },
        {
            "id": str(GlobalID("DatasetExample", str(4))),
            "input": {"in": "updated foofoo"},
            "output": {"out": "updated barbar"},
            "metadata": {"info": "updating revision"},
        },
        {
            "id": str(GlobalID("DatasetExample", str(5))),
            "input": {"in": "look at me"},
            "output": {"out": "i have all the answers"},
            "metadata": {"info": "a new example"},
        },
    ]
    for example, expected in zip(examples, expected_values):
        assert "updated_at" in example
        example_subset = {k: v for k, v in example.items() if k in expected}
        assert example_subset == expected


async def test_list_dataset_with_revisions_examples_at_each_version(
    httpx_client: httpx.AsyncClient,
    dataset_with_revisions: Any,
) -> None:
    global_id = GlobalID("Dataset", str(2))
    v4 = GlobalID("DatasetVersion", str(4))
    v5 = GlobalID("DatasetVersion", str(5))
    v6 = GlobalID("DatasetVersion", str(6))
    v7 = GlobalID("DatasetVersion", str(7))
    v8 = GlobalID("DatasetVersion", str(8))
    v9 = GlobalID("DatasetVersion", str(9))

    # two examples are created in version 4
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v4)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 2

    # two examples are patched in version 5
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v5)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 3

    # one example is added in version 6
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v6)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 4

    # one example is deleted in version 7
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v7)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 3

    # one example is added in version 8
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v8)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 4

    # one example is deleted in version 9
    response = await httpx_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version_id": str(v9)}
    )
    assert response.status_code == 200
    result = response.json()
    data = result["data"]
    assert len(data["examples"]) == 3


async def test_post_dataset_upload_json_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSON upload with various split formats: string, list, null, and mixed."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}, {"q": "Q2"}, {"q": "Q3"}, {"q": "Q4"}, {"q": "Q5"}],
            "outputs": [{"a": "A1"}, {"a": "A2"}, {"a": "A3"}, {"a": "A4"}, {"a": "A5"}],
            "splits": [
                "train",  # Single string
                ["test", "hard"],  # List of strings
                None,  # No splits
                ["validate", None, "medium", ""],  # List with nulls/empty (should filter)
                "   ",  # Whitespace-only (should filter)
            ],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        # Verify correct splits were created (empty/whitespace/nulls filtered)
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        assert set(s.name for s in splits) == {"train", "test", "hard", "validate", "medium"}

        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 5

        # Helper to get split names for an example
        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(examples[0].id) == {"train"}
        assert await get_example_splits(examples[1].id) == {"test", "hard"}
        assert await get_example_splits(examples[2].id) == set()  # None -> no splits
        assert await get_example_splits(examples[3].id) == {"validate", "medium"}  # nulls filtered
        assert await get_example_splits(examples[4].id) == set()  # Whitespace-only -> no splits


async def test_post_dataset_upload_csv_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test CSV upload with split_keys, including whitespace stripping."""
    name = inspect.stack()[0][3]
    file = gzip.compress(
        b"question,answer,data_split,category\n"
        b"Q1,A1,  train  ,general\n"  # Whitespace should be stripped
        b"Q2,A2,test,technical\n"
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_keys[]": ["data_split", "category"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        # Verify whitespace was stripped and splits have default color
        assert set(s.name for s in splits) == {"train", "test", "general", "technical"}
        assert "  train  " not in [s.name for s in splits]
        assert all(s.color == "#808080" for s in splits)

        # Verify example assignments
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(examples[0].id) == {"train", "general"}
        assert await get_example_splits(examples[1].id) == {"test", "technical"}


async def test_post_dataset_upload_jsonl_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSONL upload with split_keys, including whitespace stripping."""
    name = inspect.stack()[0][3]
    # JSONL format: each line is a JSON object
    jsonl_content = (
        b'{"question": "Q1", "answer": "A1", "data_split": "  train  ", "category": "general"}\n'
        b'{"question": "Q2", "answer": "A2", "data_split": "test", "category": "technical"}\n'
    )
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_keys[]": ["data_split", "category"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        # Verify whitespace was stripped and splits have default color
        assert set(s.name for s in splits) == {"train", "test", "general", "technical"}
        assert "  train  " not in [s.name for s in splits]
        assert all(s.color == "#808080" for s in splits)

        # Verify example assignments
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(examples[0].id) == {"train", "general"}
        assert await get_example_splits(examples[1].id) == {"test", "technical"}


async def test_post_dataset_upload_pyarrow_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test PyArrow upload with split_keys."""
    name = inspect.stack()[0][3]
    df = pd.read_csv(StringIO("question,answer,data_split\nQ1,A1,train\nQ2,A2,test\n"))
    table = pa.Table.from_pandas(df)
    sink = pa.BufferOutputStream()
    with pa.ipc.new_stream(sink, table.schema) as writer:
        writer.write_table(table)
    file = BytesIO(sink.getvalue().to_pybytes())

    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/x-pandas-pyarrow", {})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_keys[]": ["data_split"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        assert set(s.name for s in splits) == {"train", "test"}

        # Verify example assignments
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(examples[0].id) == {"train"}
        assert await get_example_splits(examples[1].id) == {"test"}


async def test_post_dataset_upload_reuses_existing_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that uploading datasets reuses existing splits instead of creating duplicates."""
    name1 = "dataset_with_split_1"
    name2 = "dataset_with_split_2"

    # Create first dataset with split
    response1 = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name1,
            "inputs": [{"question": "Q1"}],
            "outputs": [{"answer": "A1"}],
            "splits": ["train"],
        },
    )
    assert response1.status_code == 200
    dataset1_id = response1.json()["data"]["dataset_id"]

    # Get split count
    async with db() as session:
        splits_before = list(
            await session.scalars(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
            )
        )
        assert len(splits_before) == 1
        train_split_id = splits_before[0].id

    # Create second dataset with same split name
    response2 = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name2,
            "inputs": [{"question": "Q2"}],
            "outputs": [{"answer": "A2"}],
            "splits": ["train"],
        },
    )
    assert response2.status_code == 200
    dataset2_id = response2.json()["data"]["dataset_id"]

    # Verify split was reused, not duplicated
    async with db() as session:
        splits_after = list(
            await session.scalars(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
            )
        )
        assert len(splits_after) == 1
        assert splits_after[0].id == train_split_id  # Same split ID

        # Verify both datasets' examples are assigned to the split
        dataset1_db_id = int(GlobalID.from_id(dataset1_id).node_id)
        dataset2_db_id = int(GlobalID.from_id(dataset2_id).node_id)

        # Get examples from both datasets
        dataset1_examples = list(
            await session.scalars(
                select(models.DatasetExample).where(
                    models.DatasetExample.dataset_id == dataset1_db_id
                )
            )
        )
        dataset2_examples = list(
            await session.scalars(
                select(models.DatasetExample).where(
                    models.DatasetExample.dataset_id == dataset2_db_id
                )
            )
        )
        assert len(dataset1_examples) == 1
        assert len(dataset2_examples) == 1

        # Verify first dataset's example is assigned to train split
        dataset1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(
                    models.DatasetSplitDatasetExample.dataset_example_id == dataset1_examples[0].id
                )
            )
        )
        assert len(dataset1_splits) == 1
        assert dataset1_splits[0].name == "train"

        # Verify second dataset's example is also assigned to the same train split
        dataset2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(
                    models.DatasetSplitDatasetExample.dataset_example_id == dataset2_examples[0].id
                )
            )
        )
        assert len(dataset2_splits) == 1
        assert dataset2_splits[0].name == "train"
        assert dataset2_splits[0].id == train_split_id  # Same split instance


async def test_post_dataset_upload_rejects_invalid_split_formats(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Test that JSON upload rejects invalid split formats (dict, integer, boolean)."""
    name = inspect.stack()[0][3]

    # Test with dict split value (no longer supported)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "Q1"}],
            "outputs": [{"answer": "A1"}],
            "splits": [{"data_split": "train"}],  # Dict format no longer supported
        },
    )
    assert response.status_code == 422
    assert "must be a string, list of strings, or None" in response.text

    # Test with integer split value
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": f"{name}_int",
            "inputs": [{"question": "Q1"}],
            "outputs": [{"answer": "A1"}],
            "splits": [123],  # Integer not allowed
        },
    )
    assert response.status_code == 422
    assert "must be a string, list of strings, or None" in response.text

    # Test with boolean split value
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": f"{name}_bool",
            "inputs": [{"question": "Q1"}],
            "outputs": [{"answer": "A1"}],
            "splits": [True],  # Boolean not allowed
        },
    )
    assert response.status_code == 422
    assert "must be a string, list of strings, or None" in response.text


async def test_post_dataset_upload_append_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test appending to a dataset with splits - both reusing existing and adding new splits."""
    name = inspect.stack()[0][3]

    # Create initial dataset with "train" split
    response1 = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
            "splits": ["train"],
        },
    )
    assert response1.status_code == 200
    dataset_id = response1.json()["data"]["dataset_id"]

    # Get initial split info
    async with db() as session:
        train_split = await session.scalar(
            select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
        )
        assert train_split is not None
        train_split_id = train_split.id

    # Append to the same dataset with existing "train" split and new "test" split
    response2 = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q2"}, {"q": "Q3"}],
            "outputs": [{"a": "A2"}, {"a": "A3"}],
            "splits": ["train", "test"],  # Q2 -> train (existing), Q3 -> test (new)
        },
    )
    assert response2.status_code == 200
    assert response2.json()["data"]["dataset_id"] == dataset_id  # Same dataset

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)

        # Verify we have 3 examples total
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 3

        # Verify train split was reused (same ID)
        train_split_after = await session.scalar(
            select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
        )
        assert train_split_after is not None
        assert train_split_after.id == train_split_id

        # Verify test split was created
        test_split = await session.scalar(
            select(models.DatasetSplit).where(models.DatasetSplit.name == "test")
        )
        assert test_split is not None

        # Verify first example (from create) is assigned to train
        ex1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert len(ex1_splits) == 1
        assert ex1_splits[0].name == "train"

        # Verify second example (from append) is assigned to train
        ex2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
            )
        )
        assert len(ex2_splits) == 1
        assert ex2_splits[0].name == "train"
        assert ex2_splits[0].id == train_split_id  # Same split instance as before

        # Verify third example (from append) is assigned to test
        ex3_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[2].id)
            )
        )
        assert len(ex3_splits) == 1
        assert ex3_splits[0].name == "test"


async def test_append_upserts_existing_example_by_external_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Appending with a matching external_id should PATCH the existing example, not create a duplicate."""
    name = inspect.stack()[0][3]

    # Create initial dataset with an example that has an external_id
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "original"}],
            "outputs": [{"a": "original"}],
            "example_ids": ["ext-1"],
        },
    )
    assert response.status_code == 200

    # Append with the same external_id but different content
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "updated"}],
            "outputs": [{"a": "updated"}],
            "example_ids": ["ext-1"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(response.json()["data"]["dataset_id"]).node_id)
        # Should still have only 1 example (not 2)
        examples = list(
            await session.scalars(
                select(models.DatasetExample).where(
                    models.DatasetExample.dataset_id == dataset_db_id
                )
            )
        )
        assert len(examples) == 1

        # The latest revision should have the updated content
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_example_id == examples[0].id)
                .order_by(models.DatasetExampleRevision.id)
            )
        )
        assert len(revisions) == 2  # CREATE + PATCH
        assert revisions[0].input == {"q": "original"}
        assert revisions[1].input == {"q": "updated"}


async def test_append_never_deletes_existing_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Appending a subset of examples should NOT delete examples not in the upload."""
    name = inspect.stack()[0][3]

    # Create initial dataset with 2 examples
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}, {"q": "Q2"}],
            "outputs": [{"a": "A1"}, {"a": "A2"}],
            "example_ids": ["ext-1", "ext-2"],
        },
    )
    assert response.status_code == 200
    dataset_id = response.json()["data"]["dataset_id"]

    # Append only 1 new example
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q3"}],
            "outputs": [{"a": "A3"}],
            "example_ids": ["ext-3"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        # All 3 examples should exist (no deletes)
        assert len(examples) == 3


async def test_append_mixed_upsert_and_create(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Appending a batch with some matching IDs and some new should handle both correctly."""
    name = inspect.stack()[0][3]

    # Create initial dataset
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
            "example_ids": ["ext-1"],
        },
    )
    assert response.status_code == 200
    dataset_id = response.json()["data"]["dataset_id"]

    # Append: one matching ext-1 (update) + one new ext-2 (create)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q1-updated"}, {"q": "Q2-new"}],
            "outputs": [{"a": "A1-updated"}, {"a": "A2-new"}],
            "example_ids": ["ext-1", "ext-2"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        # Should have 2 examples: ext-1 (updated) + ext-2 (new)
        assert len(examples) == 2
        assert examples[0].external_id == "ext-1"
        assert examples[1].external_id == "ext-2"

        # ext-1 should have 2 revisions (CREATE + PATCH)
        revisions_1 = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_example_id == examples[0].id)
                .order_by(models.DatasetExampleRevision.id)
            )
        )
        assert len(revisions_1) == 2
        assert revisions_1[0].input == {"q": "Q1"}
        assert revisions_1[1].input == {"q": "Q1-updated"}

        # ext-2 should have 1 revision (CREATE)
        revisions_2 = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .where(models.DatasetExampleRevision.dataset_example_id == examples[1].id)
                .order_by(models.DatasetExampleRevision.id)
            )
        )
        assert len(revisions_2) == 1
        assert revisions_2[0].input == {"q": "Q2-new"}


async def test_append_preserves_splits_of_untouched_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Appending new examples should not disturb the splits of existing untouched examples."""
    name = inspect.stack()[0][3]

    # Create initial dataset with a "train" split
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
            "example_ids": ["ext-1"],
            "splits": ["train"],
        },
    )
    assert response.status_code == 200
    dataset_id = response.json()["data"]["dataset_id"]

    # Append a new example with a "test" split
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q2"}],
            "outputs": [{"a": "A2"}],
            "example_ids": ["ext-2"],
            "splits": ["test"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        # ext-1 should still be in "train" (untouched)
        ex1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert len(ex1_splits) == 1
        assert ex1_splits[0].name == "train"

        # ext-2 should be in "test"
        ex2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
            )
        )
        assert len(ex2_splits) == 1
        assert ex2_splits[0].name == "test"


# =============================================================================
# Tests for flatten_keys (collapse top-level keys feature)
# =============================================================================


class TestBuildFlattenPlan:
    def test_ignores_unselected_flatten_keys(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows = [
            {
                "input": {"question": "Hi"},
                "output": {"answer": "Hello"},
                "id": 1,
            }
        ]

        input_plan, output_plan, _ = _build_flatten_plans(
            input_keys=frozenset(["input"]),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
            flatten_keys=frozenset(["input", "output"]),
            rows=rows,
        )

        assert input_plan.flatten_map == {"input": frozenset(["question"])}
        assert output_plan.flatten_map == {}

    def test_allows_duplicate_children_across_different_buckets(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows = [{"input": {"text": "Hi"}, "output": {"text": "Hello"}}]

        input_plan, output_plan, _ = _build_flatten_plans(
            input_keys=frozenset(["input"]),
            output_keys=frozenset(["output"]),
            metadata_keys=frozenset(),
            flatten_keys=frozenset(["input", "output"]),
            rows=rows,
        )

        assert input_plan.flatten_map == {"input": frozenset(["text"])}
        assert output_plan.flatten_map == {"output": frozenset(["text"])}

    def test_rejects_duplicate_children_within_same_bucket(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows = [{"input": {"text": "Hi"}, "output": {"text": "Hello"}}]

        with pytest.raises(
            ValueError,
            match=r"Cannot flatten 'output': keys \{'text'\} already emitted",
        ):
            _build_flatten_plans(
                input_keys=frozenset(["input", "output"]),
                output_keys=frozenset(),
                metadata_keys=frozenset(),
                flatten_keys=frozenset(["input", "output"]),
                rows=rows,
            )

    def test_allows_flatten_keys_used_for_split_selection(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows = [{"input": {"text": "Hi"}, "split": "train"}]

        input_plan, _, _ = _build_flatten_plans(
            input_keys=frozenset(["input"]),
            output_keys=frozenset(),
            metadata_keys=frozenset(),
            flatten_keys=frozenset(["input"]),
            rows=rows,
        )

        assert input_plan.flatten_map == {"input": frozenset(["text"])}

    def test_rejects_conflict_with_selected_sibling_key_in_same_bucket(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows = [{"input": {"text": "Hi"}, "text": "plain"}]

        with pytest.raises(
            ValueError,
            match=r"Keys \{'text'\} conflict with flattened children",
        ):
            _build_flatten_plans(
                input_keys=frozenset(["input", "text"]),
                output_keys=frozenset(),
                metadata_keys=frozenset(),
                flatten_keys=frozenset(["input"]),
                rows=rows,
            )

    def test_rejects_rows_with_non_object_flatten_values(self) -> None:
        from phoenix.server.api.routers.v1.datasets import _build_flatten_plans

        rows: list[dict[str, Any]] = [{"input": {"text": "Hi"}}, {"input": "plain text"}]

        with pytest.raises(
            ValueError,
            match="Cannot flatten 'input': expected object values",
        ):
            _build_flatten_plans(
                input_keys=frozenset(["input"]),
                output_keys=frozenset(),
                metadata_keys=frozenset(),
                flatten_keys=frozenset(["input"]),
                rows=rows,
            )


async def test_post_dataset_upload_csv_with_split_key(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test CSV upload with split_key (singular), supporting JSON lists and plain strings."""
    name = inspect.stack()[0][3]
    file = gzip.compress(
        b'question,answer,splits\nQ1,A1,"[""train"", ""v1""]"\nQ2,A2,test\nQ3,A3,\n'
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_key": "splits",
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 3

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        # JSON list: ["train", "v1"]
        assert await get_example_splits(examples[0].id) == {"train", "v1"}
        # Plain string: test
        assert await get_example_splits(examples[1].id) == {"test"}
        # Empty: no splits
        assert await get_example_splits(examples[2].id) == set()


async def test_post_dataset_upload_split_key_and_split_keys_conflict(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Test that providing both split_key and split_keys[] returns 422."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"question,answer,split\nQ1,A1,train\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_keys[]": ["split"],
            "split_key": "split",
        },
    )
    assert response.status_code == 422


async def test_get_dataset_csv_includes_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that CSV download includes a splits column when splits exist."""
    name = inspect.stack()[0][3]
    # Upload with splits
    file = gzip.compress(
        b'question,answer,splits\nQ1,A1,"[""train""]"\nQ2,A2,"[""test"", ""v1""]"\n'
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_key": "splits",
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Download CSV
    response = await httpx_client.get(f"/v1/datasets/{dataset_id}/csv")
    assert response.status_code == 200
    df = pd.read_csv(StringIO(response.content.decode()))
    assert "splits" in df.columns
    # Verify splits are JSON-encoded sorted lists
    splits_values = df["splits"].tolist()
    assert json.loads(splits_values[0]) == ["train"]
    assert sorted(json.loads(splits_values[1])) == ["test", "v1"]


async def test_get_dataset_csv_omits_splits_when_none(
    httpx_client: httpx.AsyncClient,
) -> None:
    """Test that CSV download omits splits column when no splits exist."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"question,answer\nQ1,A1\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Download CSV
    response = await httpx_client.get(f"/v1/datasets/{dataset_id}/csv")
    assert response.status_code == 200
    df = pd.read_csv(StringIO(response.content.decode()))
    assert "splits" not in df.columns


async def test_csv_roundtrip_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that uploading a CSV with splits, downloading, and re-uploading preserves splits."""
    name = inspect.stack()[0][3]
    # Upload with splits
    file = gzip.compress(
        b'question,answer,splits\nQ1,A1,"[""train""]"\nQ2,A2,"[""test"", ""v1""]"\n'
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "split_key": "splits",
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Download CSV
    response = await httpx_client.get(f"/v1/datasets/{dataset_id}/csv")
    assert response.status_code == 200
    downloaded_csv = response.content

    # Re-upload the downloaded CSV as a new dataset
    name2 = name + "_roundtrip"
    reupload = gzip.compress(downloaded_csv)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", reupload, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name2,
            "input_keys[]": ["input.question"],
            "output_keys[]": ["output.answer"],
            "split_key": "splits",
        },
    )
    assert response.status_code == 200
    assert (data2 := response.json().get("data"))
    assert (dataset_id2 := data2.get("dataset_id"))

    # Verify splits are preserved
    async with db() as session:
        dataset_db_id2 = int(GlobalID.from_id(dataset_id2).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id2)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(examples[0].id) == {"train"}
        assert await get_example_splits(examples[1].id) == {"test", "v1"}


async def test_post_dataset_upload_csv_with_flatten_keys(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test CSV upload with flatten_keys to collapse nested JSON columns.

    This test verifies that CSV columns containing JSON objects can be flattened.
    The flatten operation promotes children of the flattened columns to top-level,
    replacing the original column.

    Note: CSV validation requires input_keys to match original column names.
    The flattened child keys are accessible via row.get() but the original
    parent key becomes None after flattening.
    """
    name = inspect.stack()[0][3]
    # CSV with a JSON-encoded "details" column that will be flattened
    # The "details" column contains {"context": "...", "difficulty": "..."}
    csv_content = (
        b"question,details\n"
        b'What is 2+2?,"{""context"": ""math"", ""difficulty"": ""easy""}"\n'
        b'Capital of France?,"{""context"": ""geography"", ""difficulty"": ""medium""}"\n'
    )
    file = gzip.compress(csv_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            # Use original column names - the backend expands them to child keys
            "input_keys[]": ["question", "details"],
            "output_keys[]": [],
            "flatten_keys[]": ["details"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2

    # After flattening "details", the backend automatically expands input_keys
    # from ["question", "details"] to ["question", "context", "difficulty"]
    # (replacing "details" with its child keys)
    assert revisions[0].input == {
        "question": "What is 2+2?",
        "context": "math",
        "difficulty": "easy",
    }
    assert revisions[0].output == {}

    assert revisions[1].input == {
        "question": "Capital of France?",
        "context": "geography",
        "difficulty": "medium",
    }
    assert revisions[1].output == {}


async def test_post_dataset_upload_csv_with_dotted_keys(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test CSV upload with period-separated column names that unflatten into nested dicts."""
    name = inspect.stack()[0][3]
    csv_content = (
        b"example_id,input.query,input.context.source,input.context.lang,"
        b"output.response.text,output.response.confidence,metadata.info\n"
        b"ex1,hello,web,en,hi,0.95,test\n"
        b"ex2,goodbye,api,fr,au revoir,0.88,test2\n"
    )
    file = gzip.compress(csv_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["input.query", "input.context.source", "input.context.lang"],
            "output_keys[]": ["output.response.text", "output.response.confidence"],
            "metadata_keys[]": ["metadata.info"],
            "example_id_key": "example_id",
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2

    assert revisions[0].input == {"query": "hello", "context": {"source": "web", "lang": "en"}}
    assert revisions[0].output == {"response": {"text": "hi", "confidence": "0.95"}}
    assert revisions[0].metadata_ == {"info": "test"}

    assert revisions[1].input == {"query": "goodbye", "context": {"source": "api", "lang": "fr"}}
    assert revisions[1].output == {"response": {"text": "au revoir", "confidence": "0.88"}}
    assert revisions[1].metadata_ == {"info": "test2"}


async def test_post_dataset_upload_csv_omits_empty_cells(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Empty CSV cells should be dropped rather than stored as empty strings."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"a,b,c\n1,,3\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
            "output_keys[]": ["a", "b", "c"],
            "metadata_keys[]": ["a", "b", "c"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": "1", "c": "3"}
    assert revisions[0].output == {"a": "1", "c": "3"}
    assert revisions[0].metadata_ == {"a": "1", "c": "3"}


async def test_post_dataset_upload_csv_omits_missing_trailing_cells(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Rows shorter than the header (DictReader restval=None) drop the missing keys."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"a,b,c\n1,2\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b", "c"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": "1", "b": "2"}


async def test_post_dataset_upload_csv_omits_whitespace_only_cells(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Whitespace-only CSV cells should be treated as missing and dropped."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"a,b\n1,   \n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": "1"}


async def test_post_dataset_upload_csv_with_dotted_keys_omits_empty_leaf(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Dotted-key columns whose row cell is empty are omitted from the bucket."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"input.x,input.y\n1,\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["input.x", "input.y"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"x": "1"}


async def test_post_dataset_upload_csv_with_dotted_keys_omits_empty_nested_leaf(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Empty nested dotted-key cells do not leave a stub entry under the parent."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"input.a.b,input.a.c\n1,\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["input.a.b", "input.a.c"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": {"b": "1"}}


async def test_post_dataset_upload_csv_allows_fully_empty_bucket(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """A bucket whose columns are all empty for a row is stored as an empty dict."""
    name = inspect.stack()[0][3]
    file = gzip.compress(b"a,b,c\n1,,\n")
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a"],
            "output_keys[]": ["b", "c"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": "1"}
    assert revisions[0].output == {}


async def test_post_dataset_upload_jsonl_with_flatten_keys(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSONL upload with flatten_keys to collapse nested objects.

    When flatten_keys is used, the backend automatically expands keys that are
    being flattened to include their child keys. The API user can pass the original
    parent keys (input, output) and the backend replaces them with their children.
    """
    name = inspect.stack()[0][3]
    # JSONL with nested objects that should be flattened
    jsonl_content = (
        b'{"question": "What is 2+2?", "input": {"context": "math", "difficulty": "easy"}, '
        b'"output": {"answer": "4"}}\n'
        b'{"question": "Capital of France?", "input": {"context": "geography"}, '
        b'"output": {"answer": "Paris"}}\n'
    )
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            # Use original parent keys - the backend expands them to child keys
            "input_keys[]": ["question", "input"],
            "output_keys[]": ["output"],
            "flatten_keys[]": ["input", "output"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 2

    # Backend expands input_keys ["question", "input"] -> ["question", "context", "difficulty"]
    # and output_keys ["output"] -> ["answer"]
    assert revisions[0].input == {
        "question": "What is 2+2?",
        "context": "math",
        "difficulty": "easy",
    }
    assert revisions[0].output == {"answer": "4"}

    # Second row's source `input` has no "difficulty" key, so it is omitted
    # from the flattened bucket rather than filled with None.
    assert revisions[1].input == {
        "question": "Capital of France?",
        "context": "geography",
    }
    assert revisions[1].output == {"answer": "Paris"}


async def test_post_dataset_upload_jsonl_preserves_null_values(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Explicit JSON nulls in JSONL are preserved as None (unlike CSV empty cells, which are dropped)."""
    name = inspect.stack()[0][3]
    jsonl_content = b'{"a": null, "b": 2}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["a", "b"],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        )
    assert len(revisions) == 1
    assert revisions[0].input == {"a": None, "b": 2}


async def test_post_dataset_upload_flatten_keys_no_effect_when_empty(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that empty flatten_keys doesn't change anything."""
    name = inspect.stack()[0][3]
    jsonl_content = b'{"input": {"question": "Hi"}, "output": {"answer": "Hello"}}\n'
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["input"],
            "output_keys[]": ["output"],
            # No flatten_keys[]
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
            )
        )
    assert len(revisions) == 1
    # Without flattening, the nested structure is preserved
    assert revisions[0].input == {"input": {"question": "Hi"}}
    assert revisions[0].output == {"output": {"answer": "Hello"}}


async def test_post_dataset_upload_flatten_keys_partial(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test flattening only some keys while leaving others nested.

    When only "input" is flattened, its children (question) are promoted to top-level.
    The output and metadata keys are NOT flattened, so they remain nested.
    """
    name = inspect.stack()[0][3]
    jsonl_content = (
        b'{"input": {"question": "Hi"}, "output": {"answer": "Hello"}, '
        b'"metadata": {"source": "test"}}\n'
    )
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            # Select "input" to trigger flattening - children are promoted to top-level
            "input_keys[]": ["input"],
            # "output" and "metadata" are not flattened, so we use them directly
            "output_keys[]": ["output"],
            "metadata_keys[]": ["metadata"],
            "flatten_keys[]": ["input"],  # Only flatten input, not output or metadata
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
            )
        )
    assert len(revisions) == 1
    # "input" was flattened to "question", output and metadata remain nested
    assert revisions[0].input == {"question": "Hi"}
    assert revisions[0].output == {"output": {"answer": "Hello"}}
    assert revisions[0].metadata_ == {"metadata": {"source": "test"}}


async def test_post_dataset_upload_jsonl_flatten_metadata_missing_in_some_rows(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Flattening a metadata parent unwraps it even when some rows omit the key.

    When "metadata" is in both metadata_keys and flatten_keys, the resulting
    bucket should contain the object's children directly, not be wrapped as
    {"metadata": {...}}. Rows missing the key produce an empty bucket.
    """
    name = inspect.stack()[0][3]
    jsonl_content = (
        b'{"input": {"question": "What is 2+2?"}, "output": {"answer": "4"}, '
        b'"metadata": {"category": "math", "difficulty": "easy"}}\n'
        b'{"input": {"question": "Capital of France?"}, "output": {"answer": "Paris"}, '
        b'"metadata": {"category": "geography"}}\n'
        b'{"input": {"question": "Describe photosynthesis"}, '
        b'"output": {"answer": "Plants convert light to energy"}, '
        b'"metadata": {"difficulty": null}}\n'
        b'{"input": {"prompt": "Write a haiku"}, '
        b'"output": {"response": "Cherry blossoms fall"}, '
        b'"metadata": {"category": "creative"}}\n'
        b'{"input": {"question": "Largest ocean?"}, "output": {"answer": "Pacific"}}\n'
    )
    file = gzip.compress(jsonl_content)
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "application/jsonl", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["input"],
            "output_keys[]": ["output"],
            "metadata_keys[]": ["metadata"],
            "flatten_keys[]": ["input", "output", "metadata"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        revisions = list(
            await session.scalars(
                select(models.DatasetExampleRevision)
                .join(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
    assert len(revisions) == 5

    assert revisions[0].input == {"question": "What is 2+2?"}
    assert revisions[0].output == {"answer": "4"}
    assert revisions[0].metadata_ == {"category": "math", "difficulty": "easy"}

    assert revisions[1].input == {"question": "Capital of France?"}
    assert revisions[1].output == {"answer": "Paris"}
    assert revisions[1].metadata_ == {"category": "geography"}

    assert revisions[2].input == {"question": "Describe photosynthesis"}
    assert revisions[2].output == {"answer": "Plants convert light to energy"}
    # Explicit nulls inside metadata are preserved.
    assert revisions[2].metadata_ == {"difficulty": None}

    # Row 4 uses a different input/output shape; only the keys present in this
    # row are emitted into the respective buckets.
    assert revisions[3].input == {"prompt": "Write a haiku"}
    assert revisions[3].output == {"response": "Cherry blossoms fall"}
    assert revisions[3].metadata_ == {"category": "creative"}

    # Row 5 has no metadata key; the bucket is empty rather than double-wrapped.
    assert revisions[4].input == {"question": "Largest ocean?"}
    assert revisions[4].output == {"answer": "Pacific"}
    assert revisions[4].metadata_ == {}


@pytest.mark.parametrize("sync", [True, False])
@pytest.mark.parametrize("action", ["create", "append"])
@pytest.mark.parametrize(
    "request_body,expected_error",
    [
        pytest.param(
            {
                "name": "ds",
                "inputs": [{"a": 1}, {"a": 2}],
                "example_ids": ["same-id", "same-id"],
            },
            "Duplicate example_id in request: 'same-id'",
            id="duplicate_external_ids",
        ),
        pytest.param(
            {
                "name": "ds",
                "inputs": [{"a": 1}, {"a": 2}],
                "outputs": [{"b": 1}],
            },
            "outputs should be a list of same length as input",
            id="outputs_length_mismatch",
        ),
        pytest.param(
            {
                "name": "ds",
                "inputs": [{"a": 1}, {"a": 2}],
                "metadata": [{"m": 1}],
            },
            "metadata should be a list of same length as input",
            id="metadata_length_mismatch",
        ),
        pytest.param(
            {
                "name": "ds",
                "inputs": [{"a": 1}, {"a": 2}],
                "example_ids": ["e1"],
            },
            "example_ids must have same length as inputs",
            id="external_ids_length_mismatch",
        ),
        pytest.param(
            {
                "name": "ds",
                "inputs": [{"a": 1}, {"a": 2}],
                "example_ids": [123, "e2"],
            },
            "example_ids must contain only strings or None",
            id="external_ids_non_string",
        ),
        pytest.param(
            {"inputs": [{"a": 1}]},
            "Dataset name is required",
            id="missing_name",
        ),
        pytest.param(
            {"name": "ds"},
            "input is required",
            id="missing_inputs",
        ),
    ],
)
async def test_invalid_dataset_upload_request_returns_422(
    httpx_client: httpx.AsyncClient,
    request_body: dict[str, Any],
    expected_error: str,
    action: str,
    sync: bool,
) -> None:
    response = await httpx_client.post(
        f"v1/datasets/upload?sync={str(sync).lower()}",
        json={**request_body, "action": action},
    )
    assert response.status_code == 422
    assert expected_error in response.text


async def test_append_with_nonexistent_node_id_returns_422(
    httpx_client: httpx.AsyncClient,
) -> None:
    name = inspect.stack()[0][3]
    create_response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
        },
    )
    assert create_response.status_code == 200

    bogus_id = str(GlobalID("DatasetExample", "99999"))
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q2"}],
            "outputs": [{"a": "A2"}],
            "example_ids": [bogus_id],
        },
    )
    assert response.status_code == 422
    assert "must match existing examples" in response.text
    assert "do not correspond" in response.text
    assert bogus_id in response.text


async def test_append_with_node_id_from_different_dataset_returns_422(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    stack_name = inspect.stack()[0][3]
    name_a = f"{stack_name}_a"
    name_b = f"{stack_name}_b"

    await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name_a,
            "inputs": [{"q": "A"}],
            "outputs": [{"a": "A"}],
        },
    )
    await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name_b,
            "inputs": [{"q": "B"}],
            "outputs": [{"a": "B"}],
        },
    )

    async with db() as session:
        example_in_a = (
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name_a)
            )
        ).one()
        cross_dataset_node_id = str(GlobalID("DatasetExample", str(example_in_a.id)))

    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name_b,
            "inputs": [{"q": "new"}],
            "outputs": [{"a": "new"}],
            "example_ids": [cross_dataset_node_id],
        },
    )
    assert response.status_code == 422
    assert "do not correspond" in response.text
    assert cross_dataset_node_id in response.text


async def test_append_with_multiple_bad_node_ids_lists_all_of_them(
    httpx_client: httpx.AsyncClient,
) -> None:
    name = inspect.stack()[0][3]
    await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
        },
    )

    bogus_ids = [
        str(GlobalID("DatasetExample", "99999")),
        str(GlobalID("DatasetExample", "99998")),
        str(GlobalID("DatasetExample", "99997")),
    ]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": f"Q{i}"} for i in range(len(bogus_ids))],
            "outputs": [{"a": f"A{i}"} for i in range(len(bogus_ids))],
            "example_ids": bogus_ids,
        },
    )
    assert response.status_code == 422
    for bogus_id in bogus_ids:
        assert bogus_id in response.text


async def test_append_with_wrong_type_node_id_stored_as_custom_external_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Node IDs of other types (e.g. Span) look like valid GlobalIDs but don't
    decode as DatasetExample, so they should pass through as custom external IDs
    rather than trigger the node-id-must-match check."""
    name = inspect.stack()[0][3]
    await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
        },
    )

    span_shaped_id = str(GlobalID("Span", "1"))
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "append",
            "name": name,
            "inputs": [{"q": "Q2"}],
            "outputs": [{"a": "A2"}],
            "example_ids": [span_shaped_id],
        },
    )
    assert response.status_code == 200

    async with db() as session:
        example = (
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(
                    models.Dataset.name == name,
                    models.DatasetExample.external_id == span_shaped_id,
                )
            )
        ).one()
        assert example.external_id == span_shaped_id


async def test_update_empty_examples_list_creates_empty_version(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "update", "name": "empty-update-ds", "inputs": []},
    )
    assert response.status_code == 200

    async with db() as session:
        versions = list(
            await session.scalars(
                select(models.DatasetVersion)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-update-ds")
            )
        )
        assert len(versions) == 1
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-update-ds")
            )
        )
        assert len(examples) == 0

    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "update", "name": "empty-update-ds", "inputs": []},
    )
    assert response.status_code == 200

    async with db() as session:
        versions = list(
            await session.scalars(
                select(models.DatasetVersion)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-update-ds")
            )
        )
        assert len(versions) == 1  # no new version


@pytest.mark.parametrize(
    "initial,updated,expected_num_versions,expected_num_examples,expected_revision_kinds",
    [
        pytest.param(
            [ExampleContent(input={"a": 1}, output={}, external_id="e1")],
            [ExampleContent(input={"a": 1}, output={}, external_id="e1")],
            1,
            1,
            ["CREATE"],
            id="no_change_to_example_with_id_does_not_create_new_version",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={})],
            [ExampleContent(input={"a": 1}, output={})],
            1,
            1,
            ["CREATE"],
            id="no_change_to_example_without_id_does_not_create_new_version",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={}, external_id="e1")],
            [ExampleContent(input={"a": 2}, output={}, external_id="e1")],
            2,
            1,
            ["CREATE", "PATCH"],
            id="changing_content_of_example_with_id_creates_new_version_with_patch_revision",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={}, external_id="e1")],
            [ExampleContent(input={"a": 1}, output={})],
            1,
            1,
            ["CREATE"],
            id="dropping_id_without_changing_content_does_not_create_new_version",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={})],
            [ExampleContent(input={"a": 1}, output={}, external_id="new-id")],
            2,
            2,
            ["CREATE", "DELETE", "CREATE"],
            id="adding_id_without_changing_content_replaces_example",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={}, external_id="e1")],
            [ExampleContent(input={"a": 2}, output={})],
            2,
            2,
            ["CREATE", "DELETE", "CREATE"],
            id="changing_content_and_dropping_id_creates_new_version_with_delete_and_create_revisions",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={})],
            [ExampleContent(input={"a": 2}, output={}, external_id="e1")],
            2,
            2,
            ["CREATE", "DELETE", "CREATE"],
            id="changing_content_and_adding_id_creates_new_version_with_delete_and_create_revisions",
        ),
        pytest.param(
            [ExampleContent(input={"a": 1}, output={})],
            [ExampleContent(input={"a": 2}, output={})],
            2,
            2,
            ["CREATE", "DELETE", "CREATE"],
            id="changing_content_of_example_without_id_creates_new_version_with_delete_and_create_revisions",
        ),
    ],
)
async def test_update_on_datasets_with_single_example(
    initial: list[ExampleContent],
    updated: list[ExampleContent],
    expected_num_versions: int,
    expected_num_examples: int,
    expected_revision_kinds: list[str],
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    await _append(httpx_client, name, initial)
    await _update(httpx_client, name, updated)
    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)
    assert len(versions) == expected_num_versions
    assert [r.revision_kind for r in revisions] == expected_revision_kinds
    assert len({r.dataset_example_id for r in revisions}) == expected_num_examples


@pytest.mark.parametrize(
    "initial_example, updated_example, expected_num_examples",
    [
        pytest.param(
            ExampleContent(input={"a": 1}, output={}, external_id="e1"),
            ExampleContent(input={"a": 1}, output={}, external_id="e1"),
            1,
            id="same_existing_id_reuses_example_row",
        ),
        pytest.param(
            ExampleContent(input={"a": 1}, output={}),
            ExampleContent(input={"a": 1}, output={}),
            2,
            id="no_ids_adds_new_example_row",
        ),
        pytest.param(
            ExampleContent(input={"a": 1}, output={}, external_id="e1"),
            ExampleContent(input={"a": 1}, output={}),
            2,
            id="dropping_id_adds_new_example_row",
        ),
        pytest.param(
            ExampleContent(input={"a": 1}, output={}),
            ExampleContent(input={"a": 1}, output={}, external_id="e1"),
            2,
            id="adding_id_adds_new_example_row",
        ),
    ],
)
async def test_deleting_and_creating_examples_with_the_same_content(
    initial_example: ExampleContent,
    updated_example: ExampleContent,
    expected_num_examples: int,
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    await _append(httpx_client, name, [initial_example])
    await _update(httpx_client, name, [])  # delete
    await _update(httpx_client, name, [updated_example])

    async with db() as session:
        all_examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name)
            )
        )

    revisions = await _get_revisions(db, name)
    assert len(all_examples) == expected_num_examples
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") == 2
    assert kinds.count("DELETE") == 1


async def test_append_with_changed_external_id_same_content_creates_new_example(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Append with a different external_id must not dedupe by content_hash."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e2")])

    examples = await _get_examples(db, name)
    revisions = await _get_revisions(db, name)

    assert len(examples) == 2
    assert {e.external_id for e in examples} == {"e1", "e2"}
    kinds = [r.revision_kind for r in revisions]
    assert kinds == ["CREATE", "CREATE"]


async def test_append_adding_external_id_to_unided_example_creates_new_example(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Providing an external_id on a new example must not pair it with an un-ID'd example via content_hash."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={})])
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])

    examples = await _get_examples(db, name)
    revisions = await _get_revisions(db, name)

    assert len(examples) == 2
    assert {e.external_id for e in examples} == {None, "e1"}
    kinds = [r.revision_kind for r in revisions]
    assert kinds == ["CREATE", "CREATE"]


async def test_update_with_changed_external_id_same_content_deletes_old_and_creates_new(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Under CREATE (upsert) semantics, a changed external_id removes the old example and adds the new one."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    await _update(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e2")])

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds == ["CREATE", "DELETE", "CREATE"]

    examples = await _get_examples(db, name)
    assert len(examples) == 2
    examples_by_id = {e.id: e for e in examples}
    deleted_revision = next(r for r in revisions if r.revision_kind == "DELETE")
    final_create_revision = [r for r in revisions if r.revision_kind == "CREATE"][-1]
    assert examples_by_id[deleted_revision.dataset_example_id].external_id == "e1"
    assert examples_by_id[final_create_revision.dataset_example_id].external_id == "e2"


async def test_append_with_same_external_id_different_content_still_patches(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Regression guard: matching external_id + different content must still PATCH, not create a new example."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={}, external_id="e1")])
    await _append(httpx_client, name, [ExampleContent(input={"a": 2}, output={}, external_id="e1")])

    examples = await _get_examples(db, name)
    revisions = await _get_revisions(db, name)

    assert len(examples) == 1
    kinds = [r.revision_kind for r in revisions]
    assert kinds == ["CREATE", "PATCH"]


# ---------------------------------------------------------------------------
# Deduplication: cardinality
# ---------------------------------------------------------------------------


async def test_creating_two_examples_that_match_content_hash_of_previous_example_adds_one_create_revision(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex])
    await _update(httpx_client, name, [ex, ex])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    # First copy matches existing example (unchanged, carried forward implicitly).
    # Second copy has no match → CREATE.
    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert len(kinds) == 2
    assert kinds.count("CREATE") == 2


async def test_update_with_removed_example_results_in_delete_revision(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex, ex])
    await _update(httpx_client, name, [ex])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert len(kinds) == 3
    assert kinds.count("CREATE") == 2
    assert kinds.count("DELETE") == 1


# ---------------------------------------------------------------------------
# Mixed batches
# ---------------------------------------------------------------------------


async def test_update_batch_with_mix_of_new_unchanged_and_changed_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """3 examples: unchanged (carry-over), changed (patch), new (create)."""
    name = "ds"
    e_unchanged = ExampleContent(input={"a": 1}, output={}, external_id="unchanged")
    e_changed_old = ExampleContent(input={"b": 1}, output={}, external_id="changed")
    e_changed_new = ExampleContent(input={"b": 2}, output={}, external_id="changed")
    e_new = ExampleContent(input={"c": 1}, output={}, external_id="new")

    await _append(httpx_client, name, [e_unchanged, e_changed_old])
    await _update(httpx_client, name, [e_unchanged, e_changed_new, e_new])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") == 3
    assert kinds.count("PATCH") == 1
    assert kinds.count("DELETE") == 0


async def test_update_batch_with_mix_of_examples_with_and_without_external_ids(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Mixed batch: examples with and without external_ids."""
    name = "ds"
    e_with_id = ExampleContent(input={"a": 1}, output={}, external_id="e1")
    e_no_id = ExampleContent(input={"b": 1}, output={})

    await _append(httpx_client, name, [e_with_id, e_no_id])
    # Create with same examples
    await _update(httpx_client, name, [e_with_id, e_no_id])

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # Both carry-over → no new version
    assert len(versions) == 1
    assert len(revisions) == 2


# ---------------------------------------------------------------------------
# Dataset lifecycle
# ---------------------------------------------------------------------------


async def test_update_creates_new_dataset_when_name_does_not_exist(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create on non-existent dataset creates Dataset + DatasetVersion + CREATE revisions."""
    name = "brand-new"
    await _update(httpx_client, name, [ExampleContent(input={"x": 1}, output={})])

    async with db() as session:
        dataset = await session.scalar(select(models.Dataset).where(models.Dataset.name == name))
        assert dataset is not None

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 1
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "CREATE"


async def test_update_creates_new_version_on_existing_dataset(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create with changes creates a second DatasetVersion."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={})])
    await _update(httpx_client, name, [ExampleContent(input={"a": 2}, output={})])

    versions = await _get_versions(db, name)
    assert len(versions) == 2


async def test_update_does_not_create_new_version_for_unchanged_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """All carry-over → no new version, returns existing version_id."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex])

    versions_before = await _get_versions(db, name)
    append_version_id = versions_before[0].id

    update_response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "update", "name": name, "inputs": [ex.input]},
    )
    update_response.raise_for_status()

    versions_after = await _get_versions(db, name)
    assert len(versions_after) == len(versions_before)
    expected_version_id = str(GlobalID(DatasetVersionType.__name__, str(append_version_id)))
    assert update_response.json()["data"]["version_id"] == expected_version_id


async def test_update_with_no_prior_version_creates_all_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Dataset exists but has no versions → all examples are new → CREATE all."""
    name = "ds"
    # Create dataset without any examples/versions
    async with db() as session:
        await session.execute(insert(models.Dataset).values(name=name, metadata_={}))

    await _update(
        httpx_client,
        name,
        [
            ExampleContent(input={"a": 1}, output={}),
            ExampleContent(input={"b": 2}, output={}),
        ],
    )

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 1
    assert len(revisions) == 2
    assert all(r.revision_kind == "CREATE" for r in revisions)


async def test_update_with_splits_assigns_splits_to_new_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create on a fresh dataset with splits assigns them to the created examples."""
    name = "ds"
    examples = [
        ExampleContent(input={"q": "Q1"}, output={}, splits=frozenset({"train"}), external_id="e1"),
        ExampleContent(
            input={"q": "Q2"}, output={}, splits=frozenset({"test", "hard"}), external_id="e2"
        ),
        ExampleContent(input={"q": "Q3"}, output={}, external_id="e3"),  # no splits
    ]
    await _update(httpx_client, name, examples)

    async with db() as session:
        ds_examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(ds_examples) == 3

        async def get_example_splits(example_id: int) -> set[str]:
            result = await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == example_id)
            )
            return {s.name for s in result}

        assert await get_example_splits(ds_examples[0].id) == {"train"}
        assert await get_example_splits(ds_examples[1].id) == {"test", "hard"}
        assert await get_example_splits(ds_examples[2].id) == set()


async def test_update_with_splits_on_created_examples_after_delete(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """When create deletes old examples and creates new ones with splits, splits are assigned."""
    name = "ds"
    await _append(
        httpx_client,
        name,
        [ExampleContent(input={"old": 1}, output={}, external_id="e1")],
    )

    # Create replaces the old example (delete e1) and creates a new one with splits
    new_examples = [
        ExampleContent(input={"new": 1}, output={}, splits=frozenset({"train"}), external_id="e2"),
    ]
    await _update(httpx_client, name, new_examples)

    revisions = await _get_revisions(db, name)
    kinds = [r.revision_kind for r in revisions]
    assert "DELETE" in kinds
    assert kinds.count("CREATE") == 2  # initial + new

    async with db() as session:
        ds_examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == name)
                .order_by(models.DatasetExample.id)
            )
        )
        # Find the new example (e2)
        new_example = next(e for e in ds_examples if e.external_id == "e2")
        splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == new_example.id)
            )
        )
        assert {s.name for s in splits} == {"train"}


async def test_update_replaces_split_assignments(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create replaces split assignments for patched, unchanged, and new examples."""
    name = "ds"
    # Initial create: e1 -> train, e2 -> train, e3 -> train (new in next create)
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(
                input={"q": "Q1"}, output={"a": "A1"}, splits=frozenset({"train"}), external_id="e1"
            ),
            ExampleContent(
                input={"q": "Q2"}, output={"a": "A2"}, splits=frozenset({"train"}), external_id="e2"
            ),
        ],
    )

    # Second create:
    #   e1: content changed (PATCH) — split train -> test
    #   e2: content unchanged — split train -> val
    #   e3: new example (CREATE) — split test
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(
                input={"q": "Q1"},
                output={"a": "A1-v2"},
                splits=frozenset({"test"}),
                external_id="e1",
            ),
            ExampleContent(
                input={"q": "Q2"}, output={"a": "A2"}, splits=frozenset({"val"}), external_id="e2"
            ),
            ExampleContent(
                input={"q": "Q3"}, output={"a": "A3"}, splits=frozenset({"test"}), external_id="e3"
            ),
        ],
    )

    async with db() as session:
        result = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .options(
                joinedload(models.DatasetExample.dataset_splits_dataset_examples).joinedload(
                    models.DatasetSplitDatasetExample.dataset_split
                )
            )
            .order_by(models.DatasetExample.id)
        )
        examples = list(result.unique())
        by_ext = {e.external_id: e for e in examples}
        assert {j.dataset_split.name for j in by_ext["e1"].dataset_splits_dataset_examples} == {
            "test"
        }  # patched: train -> test
        assert {j.dataset_split.name for j in by_ext["e2"].dataset_splits_dataset_examples} == {
            "val"
        }  # unchanged: train -> val
        assert {j.dataset_split.name for j in by_ext["e3"].dataset_splits_dataset_examples} == {
            "test"
        }  # created


async def test_update_removes_split_assignments_when_splits_empty(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create with empty splits removes previous split assignments."""
    name = "ds"
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(
                input={"q": "Q1"}, output={"a": "A1"}, splits=frozenset({"train"}), external_id="e1"
            ),
        ],
    )

    # Re-upload with explicit splits=[None] — old "train" assignment should be removed.
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={
            "action": "update",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
            "example_ids": ["e1"],
            "splits": [None],
        },
    )
    response.raise_for_status()

    async with db() as session:
        example = await session.scalar(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .options(
                joinedload(models.DatasetExample.dataset_splits_dataset_examples).joinedload(
                    models.DatasetSplitDatasetExample.dataset_split
                )
            )
        )
        assert example is not None
        assert example.dataset_splits_dataset_examples == []


async def test_update_preserves_split_assignments_when_splits_not_provided(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create without splits parameter preserves existing splits; deleted examples cascade."""
    name = "ds"
    # Initial create: e1 -> train, e2 -> test, e3 -> val
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(
                input={"q": "Q1"}, output={"a": "A1"}, splits=frozenset({"train"}), external_id="e1"
            ),
            ExampleContent(
                input={"q": "Q2"}, output={"a": "A2"}, splits=frozenset({"test"}), external_id="e2"
            ),
            ExampleContent(
                input={"q": "Q3"}, output={"a": "A3"}, splits=frozenset({"val"}), external_id="e3"
            ),
        ],
    )

    # Second create: no splits parameter provided.
    #   e1: content changed (PATCH) — splits should remain {train}
    #   e2: content unchanged — splits should remain {test}
    #   e3: omitted (DELETE) — cascade deletes its split assignments
    #   e4: new example (CREATE) — no splits
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(input={"q": "Q1"}, output={"a": "A1-v2"}, external_id="e1"),
            ExampleContent(input={"q": "Q2"}, output={"a": "A2"}, external_id="e2"),
            ExampleContent(input={"q": "Q4"}, output={"a": "A4"}, external_id="e4"),
        ],
    )

    async with db() as session:
        result = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .options(
                joinedload(models.DatasetExample.dataset_splits_dataset_examples).joinedload(
                    models.DatasetSplitDatasetExample.dataset_split
                )
            )
            .order_by(models.DatasetExample.id)
        )
        examples = list(result.unique())
        by_ext = {e.external_id: e for e in examples}
        # e1 patched: splits preserved
        assert {j.dataset_split.name for j in by_ext["e1"].dataset_splits_dataset_examples} == {
            "train"
        }
        # e2 unchanged: splits preserved
        assert {j.dataset_split.name for j in by_ext["e2"].dataset_splits_dataset_examples} == {
            "test"
        }
        # e3 deleted (soft): split assignments removed
        assert by_ext["e3"].dataset_splits_dataset_examples == []
        # e4 created with no splits
        assert by_ext["e4"].dataset_splits_dataset_examples == []


def _examples_to_body(*, action: str, name: str, examples: list[ExampleContent]) -> dict[str, Any]:
    body: dict[str, Any] = {"action": action, "name": name, "inputs": [e.input for e in examples]}
    if any(e.output for e in examples):
        body["outputs"] = [e.output for e in examples]
    if any(e.metadata for e in examples):
        body["metadata"] = [e.metadata for e in examples]
    if any(e.external_id is not None for e in examples):
        body["example_ids"] = [e.external_id for e in examples]
    if any(e.splits for e in examples):
        body["splits"] = [sorted(e.splits) if e.splits else None for e in examples]
    if any(e.span_id is not None for e in examples):
        body["span_ids"] = [e.span_id for e in examples]
    return body


async def _update(
    httpx_client: httpx.AsyncClient,
    name: str,
    examples: list[ExampleContent],
) -> None:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json=_examples_to_body(action="update", name=name, examples=examples),
    )
    response.raise_for_status()


async def _append(
    httpx_client: httpx.AsyncClient,
    name: str,
    examples: list[ExampleContent],
) -> None:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json=_examples_to_body(action="append", name=name, examples=examples),
    )
    response.raise_for_status()


async def _get_revisions(db: DbSessionFactory, name: str) -> list[models.DatasetExampleRevision]:
    async with db() as session:
        result = await session.scalars(
            select(models.DatasetExampleRevision)
            .join(models.DatasetExample)
            .join(models.Dataset, models.DatasetExample.dataset_id == models.Dataset.id)
            .where(models.Dataset.name == name)
            .order_by(models.DatasetExampleRevision.id)
        )
        return list(result)


async def _get_versions(db: DbSessionFactory, name: str) -> list[models.DatasetVersion]:
    async with db() as session:
        result = await session.scalars(
            select(models.DatasetVersion)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .order_by(models.DatasetVersion.id)
        )
        return list(result)


async def _get_examples(db: DbSessionFactory, name: str) -> list[models.DatasetExample]:
    async with db() as session:
        result = await session.scalars(
            select(models.DatasetExample)
            .join(models.Dataset)
            .where(models.Dataset.name == name)
            .order_by(models.DatasetExample.id)
        )
        return list(result)


async def _create_span_in_db(
    db: DbSessionFactory,
    span_id_str: str,
    project_name: str = "test-project",
    trace_id_str: str = "test-trace",
) -> int:
    """Create a project/trace/span in the DB, returning the span's row ID."""
    async with db() as session:
        project_id = await session.scalar(
            select(models.Project.id).where(models.Project.name == project_name)
        )
        if project_id is None:
            project_id = await session.scalar(
                insert(models.Project).values(name=project_name).returning(models.Project.id)
            )
        trace_rowid = await session.scalar(
            select(models.Trace.id).where(models.Trace.trace_id == trace_id_str)
        )
        if trace_rowid is None:
            trace_rowid = await session.scalar(
                insert(models.Trace)
                .values(
                    project_rowid=project_id,
                    trace_id=trace_id_str,
                    start_time=datetime.now(timezone.utc),
                    end_time=datetime.now(timezone.utc),
                )
                .returning(models.Trace.id)
            )
        span_rowid = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_rowid,
                span_id=span_id_str,
                name=f"span_{span_id_str}",
                span_kind="INTERNAL",
                start_time=datetime.now(timezone.utc),
                end_time=datetime.now(timezone.utc),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
        assert span_rowid is not None
        return span_rowid


# ---------------------------------------------------------------------------
# Span ID tests
# ---------------------------------------------------------------------------


async def test_update_resolves_span_ids(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """CREATE revisions resolve span_ids and link them to DatasetExamples."""
    span_rowid_1 = await _create_span_in_db(db, "span-1")
    span_rowid_2 = await _create_span_in_db(db, "span-2")

    await _update(
        httpx_client,
        "span-create-ds",
        [
            ExampleContent(input={"a": 1}, output={}, external_id="e1", span_id="span-1"),
            ExampleContent(input={"a": 2}, output={}, external_id="e2", span_id="span-2"),
            ExampleContent(input={"a": 3}, output={}, external_id="e3", span_id=None),
        ],
    )

    examples = await _get_examples(db, "span-create-ds")
    assert len(examples) == 3
    assert examples[0].span_rowid == span_rowid_1
    assert examples[1].span_rowid == span_rowid_2
    assert examples[2].span_rowid is None


async def test_update_with_nonexistent_span_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Create with a span_id that doesn't exist in the DB still creates the example."""
    await _update(
        httpx_client,
        "span-missing-ds",
        [
            ExampleContent(input={"a": 1}, output={}, external_id="e1", span_id="no-such-span"),
        ],
    )

    examples = await _get_examples(db, "span-missing-ds")
    assert len(examples) == 1
    assert examples[0].span_rowid is None


async def test_update_patch_preserves_span_rowid(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """PATCH revisions don't alter span_rowid, even when a different span_id is provided."""
    span_rowid_1 = await _create_span_in_db(db, "span-orig")
    await _create_span_in_db(db, "span-new")

    # First create: with span-orig
    await _update(
        httpx_client,
        "span-patch-ds",
        [ExampleContent(input={"x": 1}, output={}, external_id="e1", span_id="span-orig")],
    )

    # Second create: same external_id, different content and different span_id → PATCH
    await _update(
        httpx_client,
        "span-patch-ds",
        [ExampleContent(input={"x": 100}, output={}, external_id="e1", span_id="span-new")],
    )

    examples = await _get_examples(db, "span-patch-ds")
    assert len(examples) == 1
    # PATCH only writes a revision — span_rowid on the example row is unchanged
    assert examples[0].span_rowid == span_rowid_1

    revisions = await _get_revisions(db, "span-patch-ds")
    kinds = [r.revision_kind for r in revisions]
    assert kinds == ["CREATE", "PATCH"]


async def test_update_revived_example_preserves_old_span_rowid(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Reviving a deleted example reuses the old row, keeping the original span_rowid."""
    span_rowid_1 = await _create_span_in_db(db, "span-old")
    await _create_span_in_db(db, "span-revived")

    # Create with span-old
    await _update(
        httpx_client,
        "span-revive-ds",
        [ExampleContent(input={"v": 1}, output={}, external_id="e1", span_id="span-old")],
    )

    # Delete e1 by omitting it
    await _update(
        httpx_client,
        "span-revive-ds",
        [ExampleContent(input={"v": 99}, output={}, external_id="other")],
    )

    # Re-create with same external_id but different span_id → revive
    await _update(
        httpx_client,
        "span-revive-ds",
        [
            ExampleContent(input={"v": 10}, output={}, external_id="e1", span_id="span-revived"),
            ExampleContent(input={"v": 99}, output={}, external_id="other"),
        ],
    )

    examples = await _get_examples(db, "span-revive-ds")
    revived = next(e for e in examples if e.external_id == "e1")
    # Old DatasetExample row is reused — span_rowid is the original value
    assert revived.span_rowid == span_rowid_1


# ---------------------------------------------------------------------------
# Node ID round-trip matching
# ---------------------------------------------------------------------------


async def test_node_id_roundtrip_unchanged(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Example without external_id, re-sent with its node ID and same content → no new version."""
    name = "node-id-unchanged"
    ex = ExampleContent(input={"a": 1}, output={"b": 2})
    await _append(httpx_client, name, [ex])

    # Get the node ID assigned by the server
    examples = await _get_examples(db, name)
    node_id = str(GlobalID("DatasetExample", str(examples[0].id)))

    # Re-create with the node ID as external_id, same content
    await _update(
        httpx_client, name, [ExampleContent(input={"a": 1}, output={"b": 2}, external_id=node_id)]
    )

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)
    assert len(versions) == 1  # no new version — unchanged
    assert [r.revision_kind for r in revisions] == ["CREATE"]
    # external_id in DB should still be None (node ID not persisted)
    db_examples = await _get_examples(db, name)
    assert db_examples[0].external_id is None


async def test_node_id_roundtrip_patch(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Example without external_id, re-sent with its node ID and changed content → PATCH."""
    name = "node-id-patch"
    ex = ExampleContent(input={"a": 1}, output={"b": 2})
    await _append(httpx_client, name, [ex])

    examples = await _get_examples(db, name)
    node_id = str(GlobalID("DatasetExample", str(examples[0].id)))

    # Re-create with same node ID but different content
    await _update(
        httpx_client,
        name,
        [ExampleContent(input={"a": 1}, output={"b": 999}, external_id=node_id)],
    )

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)
    assert len(versions) == 2
    assert [r.revision_kind for r in revisions] == ["CREATE", "PATCH"]
    # external_id stays None
    db_examples = await _get_examples(db, name)
    assert db_examples[0].external_id is None


async def test_node_id_roundtrip_delete(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Example without external_id, omitted from next create → DELETE."""
    name = "node-id-delete"
    ex1 = ExampleContent(input={"a": 1}, output={})
    ex2 = ExampleContent(input={"b": 1}, output={})
    await _append(httpx_client, name, [ex1, ex2])

    examples = await _get_examples(db, name)
    keep_node_id = str(GlobalID("DatasetExample", str(examples[0].id)))

    # Re-create keeping only the first example (by node ID), dropping the second
    await _update(
        httpx_client,
        name,
        [ExampleContent(input={"a": 1}, output={}, external_id=keep_node_id)],
    )

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)
    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") == 2
    assert kinds.count("DELETE") == 1


async def test_node_id_without_example_record_rejected(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """A node ID that doesn't match any existing example is rejected with 422."""
    name = "node-id-without-example-record"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex])

    # Use a non-existent DB ID AND different content so neither node ID
    # nor content hash matches — the example lands in create_examples
    # with a node-ID-shaped external_id, which must be rejected.
    fake_node_id = str(GlobalID("DatasetExample", "99999"))
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={
            "action": "update",
            "name": name,
            "inputs": [{"completely": "different"}],
            "example_ids": [fake_node_id],
        },
    )
    assert response.status_code == 422


async def test_node_id_not_persisted_as_external_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """When a node ID is used for matching, the DB external_id stays NULL."""
    name = "node-id-no-persist"
    await _append(
        httpx_client,
        name,
        [ExampleContent(input={"a": 1}, output={}), ExampleContent(input={"b": 1}, output={})],
    )

    examples_before = await _get_examples(db, name)
    assert all(e.external_id is None for e in examples_before)

    # Re-create with node IDs, patching one
    node_ids = [str(GlobalID("DatasetExample", str(e.id))) for e in examples_before]
    await _update(
        httpx_client,
        name,
        [
            ExampleContent(input={"a": 1}, output={}, external_id=node_ids[0]),  # unchanged
            ExampleContent(input={"b": 999}, output={}, external_id=node_ids[1]),  # patch
        ],
    )

    examples_after = await _get_examples(db, name)
    # external_id must still be None for both
    assert all(e.external_id is None for e in examples_after)


# ---------------------------------------------------------------------------
# Comprehensive upsert roundtrip (all 8 cases in a single test)
# ---------------------------------------------------------------------------


async def test_update_roundtrip_all_eight_cases(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """
    Exercises all 8 upsert cases across two versions in a single test.

    Version 1 creates 8 examples (one per case). Version 2 re-creates with a
    subset, triggering every combination of match-strategy × outcome:

      Explicit id:
        1. Unchanged — same content, matched by external_id → no revision in v2
        2. Patch     — content changed, matched by external_id → PATCH in v2
        3. Delete    — removed from v2 list → DELETE in v2

      Content hash (no id):
        4. Unchanged — identical content, matched by content hash → no revision in v2
        5. Delete    — removed from v2 list → DELETE in v2

      Node id round-trip (server-assigned GlobalID sent back):
        6. Unchanged — same content, matched by decoded node ID → no revision in v2
        7. Patch     — content changed, matched by decoded node ID → PATCH in v2
        8. Delete    — removed from v2 list → DELETE in v2
    """
    name = "roundtrip-8-cases"

    # --- v1: create 8 examples -----------------------------------------------
    v1_examples = [
        # Explicit id
        ExampleContent(  # case 1: unchanged
            input={"question": "Capital of Japan?"},
            output={"answer": "Tokyo"},
            metadata={"category": "geography"},
            external_id="capital-japan",
        ),
        ExampleContent(  # case 2: will be patched
            input={"question": "Capital of Germany?"},
            output={"answer": "Munich"},  # wrong — fixed in v2
            metadata={"category": "geography"},
            external_id="capital-germany",
        ),
        ExampleContent(  # case 3: will be deleted
            input={"question": "Capital of France?"},
            output={"answer": "Paris"},
            metadata={"category": "geography"},
            external_id="capital-france",
        ),
        # Content hash (no id)
        ExampleContent(  # case 4: unchanged
            input={"question": "Boiling point of water?"},
            output={"answer": "100C"},
            metadata={"category": "science"},
        ),
        ExampleContent(  # case 5: will be deleted
            input={"question": "Largest ocean?"},
            output={"answer": "Pacific"},
            metadata={"category": "geography"},
        ),
        # Node id round-trip (no external id — will be assigned server IDs)
        ExampleContent(  # case 6: unchanged
            input={"question": "Speed of light?"},
            output={"answer": "299792458 m/s"},
            metadata={"category": "physics"},
        ),
        ExampleContent(  # case 7: will be patched
            input={"question": "Fastest land animal?"},
            output={"answer": "Cheetah"},
            metadata={"category": "biology"},
        ),
        ExampleContent(  # case 8: will be deleted
            input={"question": "Tallest mountain?"},
            output={"answer": "Everest"},
            metadata={"category": "geography"},
        ),
    ]
    await _append(httpx_client, name, v1_examples)

    # --- verify v1 -----------------------------------------------------------
    v1_versions = await _get_versions(db, name)
    v1_revisions = await _get_revisions(db, name)
    assert len(v1_versions) == 1
    assert len(v1_revisions) == 8
    assert all(r.revision_kind == "CREATE" for r in v1_revisions)

    # Grab server-assigned DB rows so we can build node IDs for cases 6–8.
    # DatasetExample doesn't have `input` — match via revisions or external_id.
    db_examples = await _get_examples(db, name)
    rev_by_example_id = {r.dataset_example_id: r for r in v1_revisions}
    example_by_question: dict[str, models.DatasetExample] = {}
    for ex in db_examples:
        rev = rev_by_example_id[ex.id]
        example_by_question[rev.input.get("question", "")] = ex

    # Explicit-id examples should preserve external_id.
    assert example_by_question["Capital of Japan?"].external_id == "capital-japan"
    assert example_by_question["Capital of Germany?"].external_id == "capital-germany"
    assert example_by_question["Capital of France?"].external_id == "capital-france"

    # Node-id examples have no external_id.
    assert example_by_question["Speed of light?"].external_id is None
    assert example_by_question["Fastest land animal?"].external_id is None
    assert example_by_question["Tallest mountain?"].external_id is None

    # Build node IDs for cases 6, 7.
    node_id_6 = str(GlobalID("DatasetExample", str(example_by_question["Speed of light?"].id)))
    node_id_7 = str(GlobalID("DatasetExample", str(example_by_question["Fastest land animal?"].id)))

    # --- v2: upsert with 5 kept, 3 deleted -----------------------------------
    v2_examples = [
        # Case 1: explicit id, unchanged
        ExampleContent(
            input={"question": "Capital of Japan?"},
            output={"answer": "Tokyo"},
            metadata={"category": "geography"},
            external_id="capital-japan",
        ),
        # Case 2: explicit id, patched (fix answer)
        ExampleContent(
            input={"question": "Capital of Germany?"},
            output={"answer": "Berlin"},
            metadata={"category": "geography"},
            external_id="capital-germany",
        ),
        # Case 3: OMITTED → DELETE
        # Case 4: no id, unchanged (content hash match)
        ExampleContent(
            input={"question": "Boiling point of water?"},
            output={"answer": "100C"},
            metadata={"category": "science"},
        ),
        # Case 5: OMITTED → DELETE
        # Case 6: node id, unchanged
        ExampleContent(
            input={"question": "Speed of light?"},
            output={"answer": "299792458 m/s"},
            metadata={"category": "physics"},
            external_id=node_id_6,
        ),
        # Case 7: node id, patched (add metadata)
        ExampleContent(
            input={"question": "Fastest land animal?"},
            output={"answer": "Cheetah"},
            metadata={"category": "biology", "fun_fact": "Up to 70 mph"},
            external_id=node_id_7,
        ),
        # Case 8: OMITTED → DELETE
    ]
    await _update(httpx_client, name, v2_examples)

    # --- verify v2 -----------------------------------------------------------
    v2_versions = await _get_versions(db, name)
    v2_revisions = await _get_revisions(db, name)

    assert len(v2_versions) == 2, f"Expected 2 versions, got {len(v2_versions)}"

    # v2 revisions only (exclude v1 CREATEs)
    v2_version_id = v2_versions[1].id
    v2_only = [r for r in v2_revisions if r.dataset_version_id == v2_version_id]

    patch_count = sum(1 for r in v2_only if r.revision_kind == "PATCH")
    delete_count = sum(1 for r in v2_only if r.revision_kind == "DELETE")
    create_count = sum(1 for r in v2_only if r.revision_kind == "CREATE")

    assert patch_count == 2, f"Expected 2 PATCHes, got {patch_count}"
    assert delete_count == 3, f"Expected 3 DELETEs, got {delete_count}"
    assert create_count == 0, f"Expected 0 CREATEs in v2, got {create_count}"

    # Verify patched content in DB
    germany = next(e for e in db_examples if e.external_id == "capital-germany")
    germany_rev = next(r for r in v2_only if r.dataset_example_id == germany.id)
    assert germany_rev.output == {"answer": "Berlin"}
