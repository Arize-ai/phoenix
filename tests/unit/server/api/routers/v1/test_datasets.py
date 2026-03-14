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
    expected = pd.read_csv(
        StringIO(
            "example_id,input_in,metadata_info,output_out\n"
            "RGF0YXNldEV4YW1wbGU6Mw==,foo,first revision,bar\n"
            "RGF0YXNldEV4YW1wbGU6NA==,updated foofoo,updating revision,updated barbar\n"
            "RGF0YXNldEV4YW1wbGU6NQ==,look at me,a new example,i have all the answers\n"
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
    expected = pd.read_csv(
        StringIO(
            "example_id,input_in,metadata_info,output_out\n"
            "RGF0YXNldEV4YW1wbGU6Mw==,foo,first revision,bar\n"
            "RGF0YXNldEV4YW1wbGU6NA==,updated foofoo,updating revision,updated barbar\n"
            "RGF0YXNldEV4YW1wbGU6NQ==,look at me,a new example,i have all the answers\n"
            "RGF0YXNldEV4YW1wbGU6Nw==,look at me,a newer example,i have all the answers\n"
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


async def test_upsert_empty_examples_list_creates_empty_version(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "create", "name": "empty-upsert-ds", "inputs": []},
    )
    assert response.status_code == 200

    async with db() as session:
        versions = list(
            await session.scalars(
                select(models.DatasetVersion)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-upsert-ds")
            )
        )
        assert len(versions) == 1
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-upsert-ds")
            )
        )
        assert len(examples) == 0

    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "create", "name": "empty-upsert-ds", "inputs": []},
    )
    assert response.status_code == 200

    async with db() as session:
        versions = list(
            await session.scalars(
                select(models.DatasetVersion)
                .join(models.Dataset)
                .where(models.Dataset.name == "empty-upsert-ds")
            )
        )
        assert len(versions) == 1  # no new version


@pytest.mark.parametrize(
    "initial,upserted,expected_num_versions,expected_num_examples,expected_revision_kinds",
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
            1,
            1,
            ["CREATE"],
            id="adding_id_without_changing_content_does_not_create_new_version",
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
async def test_upsert_on_datasets_with_single_example(
    initial: list[ExampleContent],
    upserted: list[ExampleContent],
    expected_num_versions: int,
    expected_num_examples: int,
    expected_revision_kinds: list[str],
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    await _append(httpx_client, name, initial)
    await _upsert(httpx_client, name, upserted)
    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)
    assert len(versions) == expected_num_versions
    assert [r.revision_kind for r in revisions] == expected_revision_kinds
    assert len({r.dataset_example_id for r in revisions}) == expected_num_examples


@pytest.mark.parametrize(
    "initial_example, upserted_example, expected_num_examples",
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
async def test_deleting_and_upserting_examples_with_the_same_content(
    initial_example: ExampleContent,
    upserted_example: ExampleContent,
    expected_num_examples: int,
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    await _append(httpx_client, name, [initial_example])
    await _upsert(httpx_client, name, [])  # delete
    await _upsert(httpx_client, name, [upserted_example])

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


# ---------------------------------------------------------------------------
# Deduplication: cardinality
# ---------------------------------------------------------------------------


async def test_upserting_two_examples_that_match_content_hash_of_previous_example_adds_one_create_revision(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex])
    await _upsert(httpx_client, name, [ex, ex])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    # First copy matches existing example (unchanged, carried forward implicitly).
    # Second copy has no match → CREATE.
    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert len(kinds) == 2
    assert kinds.count("CREATE") == 2


async def test_upsert_with_removed_example_results_in_delete_revision(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex, ex])
    await _upsert(httpx_client, name, [ex])

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


async def test_upsert_batch_with_mix_of_new_unchanged_and_changed_examples(
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
    await _upsert(httpx_client, name, [e_unchanged, e_changed_new, e_new])

    revisions = await _get_revisions(db, name)
    versions = await _get_versions(db, name)

    assert len(versions) == 2
    kinds = [r.revision_kind for r in revisions]
    assert kinds.count("CREATE") == 3
    assert kinds.count("PATCH") == 1
    assert kinds.count("DELETE") == 0


async def test_upsert_batch_with_mix_of_examples_with_and_without_external_ids(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Mixed batch: examples with and without external_ids."""
    name = "ds"
    e_with_id = ExampleContent(input={"a": 1}, output={}, external_id="e1")
    e_no_id = ExampleContent(input={"b": 1}, output={})

    await _append(httpx_client, name, [e_with_id, e_no_id])
    # Upsert same examples
    await _upsert(httpx_client, name, [e_with_id, e_no_id])

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    # Both carry-over → no new version
    assert len(versions) == 1
    assert len(revisions) == 2


# ---------------------------------------------------------------------------
# Dataset lifecycle
# ---------------------------------------------------------------------------


async def test_upsert_creates_new_dataset_when_name_does_not_exist(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert on non-existent dataset creates Dataset + DatasetVersion + CREATE revisions."""
    name = "brand-new"
    await _upsert(httpx_client, name, [ExampleContent(input={"x": 1}, output={})])

    async with db() as session:
        dataset = await session.scalar(select(models.Dataset).where(models.Dataset.name == name))
        assert dataset is not None

    versions = await _get_versions(db, name)
    revisions = await _get_revisions(db, name)

    assert len(versions) == 1
    assert len(revisions) == 1
    assert revisions[0].revision_kind == "CREATE"


async def test_upsert_creates_new_version_on_existing_dataset(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert with changes creates a second DatasetVersion."""
    name = "ds"
    await _append(httpx_client, name, [ExampleContent(input={"a": 1}, output={})])
    await _upsert(httpx_client, name, [ExampleContent(input={"a": 2}, output={})])

    versions = await _get_versions(db, name)
    assert len(versions) == 2


async def test_upsert_does_not_create_new_version_for_unchanged_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """All carry-over → no new version, returns existing version_id."""
    name = "ds"
    ex = ExampleContent(input={"a": 1}, output={})
    await _append(httpx_client, name, [ex])

    versions_before = await _get_versions(db, name)
    append_version_id = versions_before[0].id

    upsert_response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "create", "name": name, "inputs": [ex.input]},
    )
    upsert_response.raise_for_status()

    versions_after = await _get_versions(db, name)
    assert len(versions_after) == len(versions_before)
    expected_version_id = str(GlobalID(DatasetVersionType.__name__, str(append_version_id)))
    assert upsert_response.json()["data"]["version_id"] == expected_version_id


async def test_upsert_with_no_prior_version_creates_all_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Dataset exists but has no versions → all examples are new → CREATE all."""
    name = "ds"
    # Create dataset without any examples/versions
    async with db() as session:
        await session.execute(insert(models.Dataset).values(name=name, metadata_={}))

    await _upsert(
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


async def test_upsert_with_splits_assigns_splits_to_new_examples(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert on a fresh dataset with splits assigns them to the created examples."""
    name = "ds"
    examples = [
        ExampleContent(input={"q": "Q1"}, output={}, splits=frozenset({"train"}), external_id="e1"),
        ExampleContent(
            input={"q": "Q2"}, output={}, splits=frozenset({"test", "hard"}), external_id="e2"
        ),
        ExampleContent(input={"q": "Q3"}, output={}, external_id="e3"),  # no splits
    ]
    await _upsert(httpx_client, name, examples)

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


async def test_upsert_with_splits_on_created_examples_after_delete(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """When upsert deletes old examples and creates new ones with splits, splits are assigned."""
    name = "ds"
    await _append(
        httpx_client,
        name,
        [ExampleContent(input={"old": 1}, output={}, external_id="e1")],
    )

    # Upsert replaces the old example (delete e1) and creates a new one with splits
    new_examples = [
        ExampleContent(input={"new": 1}, output={}, splits=frozenset({"train"}), external_id="e2"),
    ]
    await _upsert(httpx_client, name, new_examples)

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


async def test_upsert_replaces_split_assignments(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert replaces split assignments for patched, unchanged, and new examples."""
    name = "ds"
    # Initial upsert: e1 -> train, e2 -> train, e3 -> train (new in next upsert)
    await _upsert(
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

    # Second upsert:
    #   e1: content changed (PATCH) — split train -> test
    #   e2: content unchanged — split train -> val
    #   e3: new example (CREATE) — split test
    await _upsert(
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


async def test_upsert_removes_split_assignments_when_splits_empty(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert with empty splits removes previous split assignments."""
    name = "ds"
    await _upsert(
        httpx_client,
        name,
        [
            ExampleContent(
                input={"q": "Q1"}, output={"a": "A1"}, splits=frozenset({"train"}), external_id="e1"
            ),
        ],
    )

    # Re-upsert with explicit splits=[None] — old "train" assignment should be removed.
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={
            "action": "create",
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


async def test_upsert_preserves_split_assignments_when_splits_not_provided(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert without splits parameter preserves existing splits; deleted examples cascade."""
    name = "ds"
    # Initial upsert: e1 -> train, e2 -> test, e3 -> val
    await _upsert(
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

    # Second upsert: no splits parameter provided.
    #   e1: content changed (PATCH) — splits should remain {train}
    #   e2: content unchanged — splits should remain {test}
    #   e3: omitted (DELETE) — cascade deletes its split assignments
    #   e4: new example (CREATE) — no splits
    await _upsert(
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


async def _upsert(
    httpx_client: httpx.AsyncClient,
    name: str,
    examples: list[ExampleContent],
) -> None:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json=_examples_to_body(action="create", name=name, examples=examples),
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


async def test_upsert_create_resolves_span_ids(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert CREATE revisions resolve span_ids and link them to DatasetExamples."""
    span_rowid_1 = await _create_span_in_db(db, "span-1")
    span_rowid_2 = await _create_span_in_db(db, "span-2")

    await _upsert(
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


async def test_upsert_create_with_nonexistent_span_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Upsert with a span_id that doesn't exist in the DB still creates the example."""
    await _upsert(
        httpx_client,
        "span-missing-ds",
        [
            ExampleContent(input={"a": 1}, output={}, external_id="e1", span_id="no-such-span"),
        ],
    )

    examples = await _get_examples(db, "span-missing-ds")
    assert len(examples) == 1
    assert examples[0].span_rowid is None


async def test_upsert_patch_preserves_span_rowid(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """PATCH revisions don't alter span_rowid, even when a different span_id is provided."""
    span_rowid_1 = await _create_span_in_db(db, "span-orig")
    await _create_span_in_db(db, "span-new")

    # First upsert: create with span-orig
    await _upsert(
        httpx_client,
        "span-patch-ds",
        [ExampleContent(input={"x": 1}, output={}, external_id="e1", span_id="span-orig")],
    )

    # Second upsert: same external_id, different content and different span_id → PATCH
    await _upsert(
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


async def test_upsert_revived_example_preserves_old_span_rowid(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Reviving a deleted example reuses the old row, keeping the original span_rowid."""
    span_rowid_1 = await _create_span_in_db(db, "span-old")
    await _create_span_in_db(db, "span-revived")

    # Create with span-old
    await _upsert(
        httpx_client,
        "span-revive-ds",
        [ExampleContent(input={"v": 1}, output={}, external_id="e1", span_id="span-old")],
    )

    # Delete e1 by omitting it
    await _upsert(
        httpx_client,
        "span-revive-ds",
        [ExampleContent(input={"v": 99}, output={}, external_id="other")],
    )

    # Re-create with same external_id but different span_id → revive
    await _upsert(
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
