from secrets import token_hex
from typing import Any

from .._helpers import _AppInfo, _gql, _httpx_client


def _create_dataset(app: _AppInfo, name: str) -> str:
    """Create a dataset via GraphQL and return its GlobalID."""
    resp, _ = _gql(
        app,
        query=(
            "mutation ($name: String!) {"
            "  createDataset(input: {name: $name}) { dataset { id name } }"
            "}"
        ),
        variables={"name": name},
    )
    assert not resp.get("errors"), resp.get("errors")
    return str(resp["data"]["createDataset"]["dataset"]["id"])


def _create_label(app: _AppInfo, **body: Any) -> dict[str, Any]:
    resp = _httpx_client(app).post("v1/dataset_labels", json=body)
    assert resp.status_code == 201, resp.text
    data: dict[str, Any] = resp.json()["data"]
    return data


class TestDatasetLabelCRUD:
    def test_create_get_update_delete(self, _app: _AppInfo) -> None:
        name = f"label-{token_hex(4)}"
        # create
        label = _create_label(_app, name=name, color="#00cc88", description="curated reference set")
        label_id = label["id"]
        assert label["name"] == name
        assert label["color"] == "#00cc88"
        assert label["description"] == "curated reference set"

        client = _httpx_client(_app)

        # get by id
        got = client.get(f"v1/dataset_labels/{label_id}")
        assert got.status_code == 200, got.text
        assert got.json()["data"] == label

        # list includes it
        listed = client.get("v1/dataset_labels")
        assert listed.status_code == 200, listed.text
        assert any(item["id"] == label_id for item in listed.json()["data"])

        # partial update: change color only, leave name/description untouched
        patched = client.patch(f"v1/dataset_labels/{label_id}", json={"color": "#123456"})
        assert patched.status_code == 200, patched.text
        patched_data = patched.json()["data"]
        assert patched_data["color"] == "#123456"
        assert patched_data["name"] == name
        assert patched_data["description"] == "curated reference set"

        # partial update: clear description with explicit null
        cleared = client.patch(f"v1/dataset_labels/{label_id}", json={"description": None})
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["data"]["description"] is None

        # delete
        deleted = client.delete(f"v1/dataset_labels/{label_id}")
        assert deleted.status_code == 204, deleted.text

        # subsequent get is 404
        assert client.get(f"v1/dataset_labels/{label_id}").status_code == 404

    def test_duplicate_name_conflicts(self, _app: _AppInfo) -> None:
        name = f"label-{token_hex(4)}"
        _create_label(_app, name=name, color="#abcdef")
        dup = _httpx_client(_app).post("v1/dataset_labels", json={"name": name, "color": "#fedcba"})
        assert dup.status_code == 409, dup.text

    def test_invalid_color_is_rejected(self, _app: _AppInfo) -> None:
        client = _httpx_client(_app)
        for bad_color in ("not-a-color", "#GGGGGG", "#FFF", "#FFFFFF"):
            resp = client.post(
                "v1/dataset_labels",
                json={"name": f"label-{token_hex(4)}", "color": bad_color},
            )
            assert resp.status_code == 422, f"{bad_color!r} -> {resp.status_code}"

    def test_get_unknown_label_is_404(self, _app: _AppInfo) -> None:
        # Delete a freshly created label, then look it up.
        label = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")
        client = _httpx_client(_app)
        client.delete(f"v1/dataset_labels/{label['id']}")
        assert client.get(f"v1/dataset_labels/{label['id']}").status_code == 404

    def test_invalid_label_id_is_422(self, _app: _AppInfo) -> None:
        assert _httpx_client(_app).get("v1/dataset_labels/not-a-global-id").status_code == 422


class TestDatasetLabelMembership:
    def test_assign_list_and_unassign(self, _app: _AppInfo) -> None:
        dataset_id = _create_dataset(_app, f"ds-{token_hex(4)}")
        label = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")
        label_id = label["id"]
        client = _httpx_client(_app)

        # initially no labels
        empty = client.get(f"v1/datasets/{dataset_id}/labels")
        assert empty.status_code == 200, empty.text
        assert empty.json()["data"] == []

        # assign (returns the label)
        assigned = client.put(f"v1/datasets/{dataset_id}/labels/{label_id}")
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["data"]["id"] == label_id

        # idempotent re-assign is a no-op success
        again = client.put(f"v1/datasets/{dataset_id}/labels/{label_id}")
        assert again.status_code == 200, again.text

        # the label now shows on the dataset (exactly once)
        listed = client.get(f"v1/datasets/{dataset_id}/labels")
        assert listed.status_code == 200, listed.text
        ids = [item["id"] for item in listed.json()["data"]]
        assert ids == [label_id]

        # unassign
        removed = client.delete(f"v1/datasets/{dataset_id}/labels/{label_id}")
        assert removed.status_code == 204, removed.text

        # idempotent re-remove is a no-op success
        removed_again = client.delete(f"v1/datasets/{dataset_id}/labels/{label_id}")
        assert removed_again.status_code == 204, removed_again.text

        # gone from the dataset, but the label itself still exists
        assert client.get(f"v1/datasets/{dataset_id}/labels").json()["data"] == []
        assert client.get(f"v1/dataset_labels/{label_id}").status_code == 200

    def test_assign_by_dataset_name(self, _app: _AppInfo) -> None:
        name = f"ds-{token_hex(4)}"
        _create_dataset(_app, name)
        label = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")
        client = _httpx_client(_app)
        assigned = client.put(f"v1/datasets/{name}/labels/{label['id']}")
        assert assigned.status_code == 200, assigned.text
        listed = client.get(f"v1/datasets/{name}/labels")
        assert [item["id"] for item in listed.json()["data"]] == [label["id"]]

    def test_assign_to_unknown_dataset_is_404(self, _app: _AppInfo) -> None:
        label = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")
        resp = _httpx_client(_app).put(f"v1/datasets/no-such-dataset/labels/{label['id']}")
        assert resp.status_code == 404, resp.text

    def test_bulk_replace(self, _app: _AppInfo) -> None:
        dataset_id = _create_dataset(_app, f"ds-{token_hex(4)}")
        label_a = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")["id"]
        label_b = _create_label(_app, name=f"label-{token_hex(4)}", color="#112233")["id"]
        label_c = _create_label(_app, name=f"label-{token_hex(4)}", color="#445566")["id"]
        client = _httpx_client(_app)

        # set {a, b}
        resp = client.put(
            f"v1/datasets/{dataset_id}/labels",
            json={"dataset_label_ids": [label_a, label_b]},
        )
        assert resp.status_code == 200, resp.text
        assert {item["id"] for item in resp.json()["data"]} == {label_a, label_b}

        # replace with {b, c} (adds c, removes a)
        resp = client.put(
            f"v1/datasets/{dataset_id}/labels",
            json={"dataset_label_ids": [label_b, label_c]},
        )
        assert resp.status_code == 200, resp.text
        assert {item["id"] for item in resp.json()["data"]} == {label_b, label_c}

        # clearing with an empty list removes all
        resp = client.put(f"v1/datasets/{dataset_id}/labels", json={"dataset_label_ids": []})
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []

    def test_bulk_replace_with_unknown_label_is_404(self, _app: _AppInfo) -> None:
        dataset_id = _create_dataset(_app, f"ds-{token_hex(4)}")
        # A well-formed but non-existent label GlobalID.
        missing_label = _create_label(_app, name=f"label-{token_hex(4)}", color="#00cc88")["id"]
        _httpx_client(_app).delete(f"v1/dataset_labels/{missing_label}")
        resp = _httpx_client(_app).put(
            f"v1/datasets/{dataset_id}/labels",
            json={"dataset_label_ids": [missing_label]},
        )
        assert resp.status_code == 404, resp.text
