import httpx


async def _create_dataset(httpx_client: httpx.AsyncClient, name: str) -> str:
    response = await httpx_client.post(
        "v1/datasets/upload?sync=true",
        json={"action": "create", "name": name, "inputs": [{"q": "Q"}]},
    )
    assert response.status_code == 200
    return str(response.json()["data"]["dataset_id"])


async def test_dataset_label_routes_accept_the_label_name(
    httpx_client: httpx.AsyncClient,
) -> None:
    created = await httpx_client.post(
        "v1/dataset_labels", json={"name": "golden", "color": "#00cc88"}
    )
    assert created.status_code == 201
    label = created.json()["data"]

    response = await httpx_client.get("v1/dataset_labels/golden")
    assert response.status_code == 200
    assert response.json()["data"] == label

    response = await httpx_client.patch("v1/dataset_labels/golden", json={"color": "#123456"})
    assert response.status_code == 200
    assert response.json()["data"]["color"] == "#123456"

    dataset_id = await _create_dataset(httpx_client, "labelled")
    response = await httpx_client.put("v1/datasets/labelled/labels/golden")
    assert response.status_code == 200
    assert response.json()["data"]["id"] == label["id"]
    response = await httpx_client.get(f"v1/datasets/{dataset_id}/labels")
    assert [entry["id"] for entry in response.json()["data"]] == [label["id"]]

    response = await httpx_client.delete("v1/datasets/labelled/labels/golden")
    assert response.status_code == 204
    response = await httpx_client.get(f"v1/datasets/{dataset_id}/labels")
    assert response.json()["data"] == []

    response = await httpx_client.delete("v1/dataset_labels/golden")
    assert response.status_code == 204
    assert (await httpx_client.get(f"v1/dataset_labels/{label['id']}")).status_code == 404


async def test_dataset_label_routes_404_on_an_unknown_name(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.get("v1/dataset_labels/no-such-label")
    assert response.status_code == 404
    assert "no-such-label" in response.text
