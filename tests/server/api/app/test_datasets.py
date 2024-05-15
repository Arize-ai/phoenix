async def test_datasets(test_client, dataset_0):
    response = test_client.get("/v1/datasets/0")
    assert response.status_code == 200
    dataset_json = response.json()

    assert "created_at" in dataset_json
    assert "updated_at" in dataset_json
    fixture_values ={
        "id": 0,
        "name": "dataset 0",
        "description": "a test dataset",
        "metadata": {"info": "a test dataset"},
        "record_count": 1,
    }
    assert all(item in dataset_json.items() for item in fixture_values.items())
