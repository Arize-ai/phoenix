import gzip
import inspect
import io
import json
from io import BytesIO, StringIO
from typing import Any

import httpx
import pandas as pd
import pyarrow as pa
import pytest
from httpx import HTTPStatusError
from pandas.testing import assert_frame_equal
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
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
    dataset_version_global_id = GlobalID(DatasetVersion.__name__, str(dataset_version_id))
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
    dataset_version_global_id = GlobalID(DatasetVersion.__name__, str(dataset_version_id))
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
    """Test that JSON upload with splits creates and assigns examples to splits."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "What is AI?"}, {"question": "What is ML?"}],
            "outputs": [{"answer": "Artificial Intelligence"}, {"answer": "Machine Learning"}],
            "metadata": [{"difficulty": "easy"}, {"difficulty": "hard"}],
            "splits": [
                ["train", "general"],
                ["test", "technical"],
            ],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))
    assert "version_id" in data

    # Verify splits were created and examples were assigned
    async with db() as session:
        # Check splits exist
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        split_names = [s.name for s in splits]
        assert "train" in split_names
        assert "test" in split_names
        assert "general" in split_names
        assert "technical" in split_names

        # Check examples are assigned to correct splits
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        # Check first example is assigned to "train" and "general" splits
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        example1_split_names = [s.name for s in example1_splits]
        assert set(example1_split_names) == {"train", "general"}

        # Check second example is assigned to "test" and "technical" splits
        example2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        example2_split_names = [s.name for s in example2_splits]
        assert set(example2_split_names) == {"test", "technical"}


async def test_post_dataset_upload_csv_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that CSV upload with split_keys creates and assigns examples to splits."""
    name = inspect.stack()[0][3]
    file = gzip.compress(
        b"question,answer,difficulty,data_split,category\n"
        b"What is AI?,Artificial Intelligence,easy,train,general\n"
        b"What is ML?,Machine Learning,hard,test,technical\n"
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "metadata_keys[]": ["difficulty"],
            "split_keys[]": ["data_split", "category"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Verify splits were created and examples were assigned
    async with db() as session:
        # Check splits exist
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        split_names = [s.name for s in splits]
        assert "train" in split_names
        assert "test" in split_names
        assert "general" in split_names
        assert "technical" in split_names

        # Verify split colors are set to default
        for split in splits:
            assert split.color == "#808080"

        # Check examples are assigned to correct splits
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        # Check first example assignments
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        assert set(s.name for s in example1_splits) == {"train", "general"}

        # Check second example assignments
        example2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        assert set(s.name for s in example2_splits) == {"test", "technical"}


async def test_post_dataset_upload_pyarrow_with_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that PyArrow upload with split_keys creates and assigns examples to splits."""
    name = inspect.stack()[0][3]
    df = pd.read_csv(
        StringIO(
            "question,answer,difficulty,data_split,category\n"
            "What is AI?,Artificial Intelligence,easy,train,general\n"
            "What is ML?,Machine Learning,hard,test,technical\n"
        )
    )
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
            "metadata_keys[]": ["difficulty"],
            "split_keys[]": ["data_split", "category"],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert data.get("dataset_id")

    # Verify splits were created and examples were assigned
    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        split_names = [s.name for s in splits]
        assert "train" in split_names
        assert "test" in split_names
        assert "general" in split_names
        assert "technical" in split_names


async def test_post_dataset_upload_with_empty_split_values(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that rows with empty/null split values are not assigned to splits."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "Q1"}, {"question": "Q2"}, {"question": "Q3"}],
            "outputs": [{"answer": "A1"}, {"answer": "A2"}, {"answer": "A3"}],
            "splits": [
                "train",  # Has split value
                "",  # Empty split value
                None,  # No split value (null)
            ],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Verify only first example has split assignment
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

        # Check first example has split
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert len(example1_splits) == 1
        assert example1_splits[0].name == "train"

        # Check second and third examples have no splits
        example2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
            )
        )
        assert len(example2_splits) == 0

        example3_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[2].id)
            )
        )
        assert len(example3_splits) == 0


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

    # Verify split was reused, not duplicated
    async with db() as session:
        splits_after = list(
            await session.scalars(
                select(models.DatasetSplit).where(models.DatasetSplit.name == "train")
            )
        )
        assert len(splits_after) == 1
        assert splits_after[0].id == train_split_id  # Same split ID


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


async def test_post_dataset_upload_filters_whitespace_only_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that whitespace-only split values are filtered out and not created."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "Q1"}, {"question": "Q2"}, {"question": "Q3"}],
            "outputs": [{"answer": "A1"}, {"answer": "A2"}, {"answer": "A3"}],
            "splits": [
                "train",  # Valid split
                "   ",  # Whitespace-only
                "\t\n",  # Tab and newline only
            ],
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    # Verify only "train" split was created, not whitespace-only ones
    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        split_names = [s.name for s in splits]
        assert split_names == ["train"]

        # Verify only first example has split assignment
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 3

        # Check only first example has splits
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert len(example1_splits) == 1

        # Other examples should have no splits
        for ex in examples[1:]:
            ex_splits = list(
                await session.scalars(
                    select(models.DatasetSplit)
                    .join(models.DatasetSplitDatasetExample)
                    .where(models.DatasetSplitDatasetExample.dataset_example_id == ex.id)
                )
            )
            assert len(ex_splits) == 0


async def test_post_dataset_upload_csv_strips_whitespace_from_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test that CSV upload strips leading/trailing whitespace from split values."""
    name = inspect.stack()[0][3]
    file = gzip.compress(
        b"question,answer,data_split\n"
        b"Q1,A1,  train  \n"  # Leading and trailing whitespace
        b"Q2,A2,test\n"
    )
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", file, "text/csv", {"Content-Encoding": "gzip"})},
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
    assert data.get("dataset_id")

    # Verify splits are created with trimmed names
    async with db() as session:
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        split_names = [s.name for s in splits]
        # Should have "train" and "test", not "  train  "
        assert "train" in split_names
        assert "test" in split_names
        assert "  train  " not in split_names


async def test_post_dataset_upload_json_with_splits_as_strings(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSON upload with splits as list of strings (single split per example)."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "Q1"}, {"question": "Q2"}],
            "outputs": [{"answer": "A1"}, {"answer": "A2"}],
            "splits": ["train", "test"],  # List of strings
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        # Check splits exist
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        assert set(s.name for s in splits) == {"train", "test"}

        # Check examples are assigned correctly
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        # First example should be in "train"
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert len(example1_splits) == 1
        assert example1_splits[0].name == "train"

        # Second example should be in "test"
        example2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
            )
        )
        assert len(example2_splits) == 1
        assert example2_splits[0].name == "test"


async def test_post_dataset_upload_json_with_splits_as_lists(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSON upload with splits as list of lists (multiple splits per example)."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"question": "Q1"}, {"question": "Q2"}],
            "outputs": [{"answer": "A1"}, {"answer": "A2"}],
            "splits": [["train", "easy"], ["test", "hard"]],  # List of lists
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        # Check all splits exist
        splits = list(
            await session.scalars(select(models.DatasetSplit).order_by(models.DatasetSplit.name))
        )
        assert set(s.name for s in splits) == {"train", "easy", "test", "hard"}

        # Check examples are assigned to multiple splits
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample)
                .where(models.DatasetExample.dataset_id == dataset_db_id)
                .order_by(models.DatasetExample.id)
            )
        )
        assert len(examples) == 2

        # First example should be in both "train" and "easy"
        example1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        assert set(s.name for s in example1_splits) == {"train", "easy"}

        # Second example should be in both "test" and "hard"
        example2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
                .order_by(models.DatasetSplit.name)
            )
        )
        assert set(s.name for s in example2_splits) == {"test", "hard"}


async def test_post_dataset_upload_json_with_sparse_splits(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSON upload with sparse split assignments (nulls in list)."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}, {"q": "Q2"}, {"q": "Q3"}, {"q": "Q4"}],
            "outputs": [{"a": "A1"}, {"a": "A2"}, {"a": "A3"}, {"a": "A4"}],
            "splits": [
                "train",  # String format
                ["test", "hard"],  # List format
                None,  # Null - no splits for this example
                ["validate", "medium"],  # List format with multiple splits
            ],
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
        assert len(examples) == 4

        # Example 1: single "train" split
        ex1_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert set(s.name for s in ex1_splits) == {"train"}

        # Example 2: multiple splits "test" and "hard"
        ex2_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[1].id)
            )
        )
        assert set(s.name for s in ex2_splits) == {"test", "hard"}

        # Example 3: no splits (was null)
        ex3_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[2].id)
            )
        )
        assert len(ex3_splits) == 0

        # Example 4: list format with multiple splits
        ex4_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[3].id)
            )
        )
        assert set(s.name for s in ex4_splits) == {"validate", "medium"}


async def test_post_dataset_upload_json_with_list_containing_nulls(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Test JSON upload with null values inside split lists."""
    name = inspect.stack()[0][3]
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        json={
            "action": "create",
            "name": name,
            "inputs": [{"q": "Q1"}],
            "outputs": [{"a": "A1"}],
            "splits": [["train", None, "easy", None]],  # Mix of strings and nulls
        },
    )
    assert response.status_code == 200
    assert (data := response.json().get("data"))
    assert (dataset_id := data.get("dataset_id"))

    async with db() as session:
        dataset_db_id = int(GlobalID.from_id(dataset_id).node_id)
        examples = list(
            await session.scalars(
                select(models.DatasetExample).where(
                    models.DatasetExample.dataset_id == dataset_db_id
                )
            )
        )
        assert len(examples) == 1

        # Should only have "train" and "easy", nulls should be skipped
        ex_splits = list(
            await session.scalars(
                select(models.DatasetSplit)
                .join(models.DatasetSplitDatasetExample)
                .where(models.DatasetSplitDatasetExample.dataset_example_id == examples[0].id)
            )
        )
        assert set(s.name for s in ex_splits) == {"train", "easy"}
