from strawberry.relay import GlobalID


async def test_get_simple_dataset_examples(test_client, simple_dataset):
    global_id = GlobalID("Dataset", str(0))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 1
    expected_values = [
        {
            "id": str(GlobalID("DatasetExample", str(0))),
            "input": {"in": "foo"},
            "output": {"out": "bar"},
            "metadata": {"info": "the first reivision"},
            "last_updated_version": str(GlobalID("DatasetVersion", str(0))),
        }
    ]
    for example, expected in zip(result, expected_values):
        assert example == expected


async def test_list_empty_dataset_examples(test_client, empty_dataset):
    global_id = GlobalID("Dataset", str(1))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 0


async def test_list_dataset_with_revisions_examples(test_client, dataset_with_revisions):
    global_id = GlobalID("Dataset", str(2))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3
    expected_values = [
        {
            "id": str(GlobalID("DatasetExample", str(3))),
            "input": {"in": "foo"},
            "output": {"out": "bar"},
            "metadata": {"info": "first revision"},
            "last_updated_version": str(GlobalID("DatasetVersion", str(4))),
        },
        {
            "id": str(GlobalID("DatasetExample", str(4))),
            "input": {"in": "updated foofoo"},
            "output": {"out": "updated barbar"},
            "metadata": {"info": "updating revision"},
            "last_updated_version": str(GlobalID("DatasetVersion", str(5))),
        },
        {
            "id": str(GlobalID("DatasetExample", str(5))),
            "input": {"in": "look at me"},
            "output": {"out": "i have all the answers"},
            "metadata": {"info": "a new example"},
            "last_updated_version": str(GlobalID("DatasetVersion", str(5))),
        },
    ]
    for example, expected in zip(result[1:2], expected_values[1:2]):
        assert example == expected
