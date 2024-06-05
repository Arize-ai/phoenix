from strawberry.relay import GlobalID


async def test_get_dataset_examples_404s_with_nonexistent_dataset_id(test_client):
    global_id = GlobalID("Dataset", str(0))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 404
    assert response.content.decode() == f"No dataset with id {global_id} can be found."


async def test_get_dataset_examples_404s_with_invalid_global_id(test_client, simple_dataset):
    global_id = GlobalID("InvalidDataset", str(0))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 404
    assert "refers to a InvalidDataset" in response.content.decode()


async def test_get_dataset_examples_404s_with_nonexistent_version_id(test_client, simple_dataset):
    global_id = GlobalID("Dataset", str(0))
    version_id = GlobalID("DatasetVersion", str(99))
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(version_id)}
    )
    assert response.status_code == 404
    assert response.content.decode() == f"No dataset version with id {version_id} can be found."


async def test_get_dataset_examples_404s_with_invalid_version_global_id(
    test_client, simple_dataset
):
    global_id = GlobalID("Dataset", str(0))
    version_id = GlobalID("InvalidDatasetVersion", str(0))
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(version_id)}
    )
    assert response.status_code == 404
    assert "refers to a InvalidDatasetVersion" in response.content.decode()


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
        }
    ]
    for example, expected in zip(result, expected_values):
        assert "updated_at" in example
        example_subset = {k: v for k, v in example.items() if k in expected}
        assert example_subset == expected


async def test_list_simple_dataset_examples_at_each_version(test_client, simple_dataset):
    global_id = GlobalID("Dataset", str(0))
    v0 = GlobalID("DatasetVersion", str(0))

    # one example is created in version 0
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v0)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 1


async def test_list_empty_dataset_examples(test_client, empty_dataset):
    global_id = GlobalID("Dataset", str(1))
    response = await test_client.get(f"/v1/datasets/{global_id}/examples")
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 0


async def test_list_empty_dataset_examples_at_each_version(test_client, empty_dataset):
    global_id = GlobalID("Dataset", str(1))
    v1 = GlobalID("DatasetVersion", str(1))
    v2 = GlobalID("DatasetVersion", str(2))
    v3 = GlobalID("DatasetVersion", str(3))

    # two examples are created in version 1
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v1)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2

    # two examples are patched in version 2
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v2)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2

    # two examples are deleted in version 3
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v3)}
    )
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
    for example, expected in zip(result, expected_values):
        assert "updated_at" in example
        example_subset = {k: v for k, v in example.items() if k in expected}
        assert example_subset == expected


async def test_list_dataset_with_revisions_examples_at_each_version(
    test_client, dataset_with_revisions
):
    global_id = GlobalID("Dataset", str(2))
    v4 = GlobalID("DatasetVersion", str(4))
    v5 = GlobalID("DatasetVersion", str(5))
    v6 = GlobalID("DatasetVersion", str(6))
    v7 = GlobalID("DatasetVersion", str(7))
    v8 = GlobalID("DatasetVersion", str(8))
    v9 = GlobalID("DatasetVersion", str(9))

    # two examples are created in version 4
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v4)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2

    # two examples are patched in version 5
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v5)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3

    # one example is added in version 6
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v6)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 4

    # one example is deleted in version 7
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v7)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3

    # one example is added in version 8
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v8)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 4

    # one example is deleted in version 9
    response = await test_client.get(
        f"/v1/datasets/{global_id}/examples", params={"version-id": str(v9)}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3
