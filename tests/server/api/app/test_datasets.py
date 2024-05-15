async def test_get_simple_dataset(test_client, simple_dataset):
    response = await test_client.get("/v1/datasets/0")
    assert response.status_code == 200
    dataset_json = response.json()

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values ={
        "id": 0,
        "name": "simple dataset",
        "description": "a test dataset with a single example",
        "metadata": {"info": "a test dataset"},
        "example_count": 1,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())


async def test_get_empty_dataset(test_client, empty_dataset):
    response = await test_client.get("/v1/datasets/1")
    assert response.status_code == 200
    dataset_json = response.json()

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values ={
        "id": 1,
        "name": "empty dataset",
        "description": "emptied after two revisions",
        "metadata": {},
        "example_count": 0,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())