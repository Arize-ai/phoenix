from io import StringIO

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal
from strawberry.relay import GlobalID


async def test_get_simple_dataset(test_client, simple_dataset):
    global_id = GlobalID("Dataset", str(0))
    response = await test_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()

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


async def test_get_empty_dataset(test_client, empty_dataset):
    global_id = GlobalID("Dataset", str(1))
    response = await test_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()

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


async def test_get_dataset_with_revisions(test_client, dataset_with_revisions):
    global_id = GlobalID("Dataset", str(2))
    response = await test_client.get(f"/v1/datasets/{global_id}")
    assert response.status_code == 200
    dataset_json = response.json()

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


async def test_list_datasets(test_client, simple_dataset, empty_dataset, dataset_with_revisions):
    response = await test_client.get("/v1/datasets")
    assert response.status_code == 200
    datasets_json = response.json()

    assert datasets_json["next_cursor"] is None, "no next cursor when all datasets are returned"

    datasets = datasets_json["data"]
    assert len(datasets) == 3

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values = {
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


async def test_list_fewer_datasets(test_client, simple_dataset, empty_dataset):
    response = await test_client.get("/v1/datasets")
    assert response.status_code == 200
    datasets_json = response.json()

    assert datasets_json["next_cursor"] is None, "no next cursor when all datasets are returned"

    datasets = datasets_json["data"]
    assert len(datasets) == 2

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values = {
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
    test_client, simple_dataset, empty_dataset, dataset_with_revisions
):
    response = await test_client.get("/v1/datasets", params={"limit": 2})
    assert response.status_code == 200
    datasets_json = response.json()

    next_cursor = datasets_json["next_cursor"]
    assert next_cursor, "next_cursor supplied when datasets remain"

    datasets = datasets_json["data"]
    assert len(datasets) == 2, "only return two datasets when limit is set to 2"

    # datasets are returned in reverse order of insertion
    assert "created_at" in datasets[0]
    assert "updated_at" in datasets[0]
    fixture_values = {
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

    second_page = await test_client.get("/v1/datasets", params={"limit": 2, "cursor": next_cursor})
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


async def test_get_dataset_download_empty_dataset(test_client, empty_dataset):
    dataset_global_id = GlobalID("Dataset", str(1))
    response = await test_client.get(f"/v1/datasets/{dataset_global_id}/csv")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert response.headers.get("content-disposition") == 'attachment; filename="empty dataset.csv"'
    with pytest.raises(Exception):
        pd.read_csv(StringIO(response.content.decode()))


async def test_get_dataset_download_nonexistent_version(
    test_client, empty_dataset, dataset_with_revisions
):
    dataset_global_id = GlobalID("Dataset", str(1))
    dataset_version_global_id = GlobalID("DatasetVersion", str(4))  # Version for Dataset id=2
    response = await test_client.get(
        f"/v1/datasets/{dataset_global_id}/csv?version={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert response.headers.get("content-disposition") == 'attachment; filename="empty dataset.csv"'
    with pytest.raises(Exception):
        pd.read_csv(StringIO(response.content.decode()))


async def test_get_dataset_download_latest_version(test_client, dataset_with_revisions):
    dataset_global_id = GlobalID("Dataset", str(2))
    response = await test_client.get(f"/v1/datasets/{dataset_global_id}/csv")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition") == 'attachment; filename="revised dataset.csv"'
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


async def test_get_dataset_download_specific_version(test_client, dataset_with_revisions):
    dataset_global_id = GlobalID("Dataset", str(2))
    dataset_version_global_id = GlobalID("DatasetVersion", str(8))
    response = await test_client.get(
        f"/v1/datasets/{dataset_global_id}/csv?version={dataset_version_global_id}"
    )
    assert response.status_code == 200
    assert response.headers.get("content-type") == "text/csv"
    assert response.headers.get("content-encoding") == "gzip"
    assert (
        response.headers.get("content-disposition") == 'attachment; filename="revised dataset.csv"'
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
