from typing import Any

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.dataset_labels import AsyncDatasetLabels, DatasetLabels


def _make_label(
    *,
    id: str = "id1",
    name: str = "label-1",
    color: str = "#FF0000",
    description: str | None = None,
) -> v1.DatasetLabel:
    return v1.DatasetLabel(id=id, name=name, color=color, description=description)


def _sync(handler: Any) -> DatasetLabels:
    return DatasetLabels(
        httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    )


def _async(handler: Any) -> AsyncDatasetLabels:
    return AsyncDatasetLabels(
        httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
    )


class TestDatasetLabelsList:
    def test_list_single_page(self) -> None:
        labels = [_make_label(id=f"id{i}", name=f"l{i}") for i in range(3)]

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/dataset_labels"
            assert "cursor" not in request.url.params
            return httpx.Response(200, json={"data": labels, "next_cursor": None})

        result = _sync(handler).list()
        assert [label["id"] for label in result] == ["id0", "id1", "id2"]

    def test_list_follows_cursor_pagination(self) -> None:
        page1 = [_make_label(id="id1", name="l1")]
        page2 = [_make_label(id="id2", name="l2")]
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                assert "cursor" not in request.url.params
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            assert request.url.params.get("cursor") == "cursor-abc"
            return httpx.Response(200, json={"data": page2, "next_cursor": None})

        result = _sync(handler).list()
        assert call_count == 2
        assert [label["id"] for label in result] == ["id1", "id2"]

    def test_list_stops_on_empty_next_cursor(self) -> None:
        """An empty-string cursor terminates pagination rather than looping forever."""
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(200, json={"data": [_make_label()], "next_cursor": ""})

        result = _sync(handler).list()
        assert call_count == 1
        assert len(result) == 1

    async def test_async_list_follows_cursor_pagination(self) -> None:
        page1 = [_make_label(id="id1", name="l1")]
        page2 = [_make_label(id="id2", name="l2")]
        call_count = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            assert request.url.params.get("cursor") == "cursor-abc"
            return httpx.Response(200, json={"data": page2, "next_cursor": None})

        result = await _async(handler).list()
        assert call_count == 2
        assert [label["id"] for label in result] == ["id1", "id2"]


class TestDatasetLabelsGet:
    def test_get_returns_label(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/dataset_labels/id1"
            return httpx.Response(200, json={"data": _make_label(id="id1", name="regression")})

        label = _sync(handler).get(dataset_label_id="id1")
        assert label["name"] == "regression"

    def test_get_rejects_id_that_would_break_the_path(self) -> None:
        """encode_path_param refuses /, ? and # rather than sending a request that
        would be routed somewhere else."""

        def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
            raise AssertionError("no request should be sent")

        with pytest.raises(ValueError, match="Cannot encode string containing"):
            _sync(handler).get(dataset_label_id="a/b")

    def test_get_missing_label_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Dataset label not found"})

        with pytest.raises(httpx.HTTPStatusError):
            _sync(handler).get(dataset_label_id="missing")

    async def test_async_get_missing_label_raises(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Dataset label not found"})

        with pytest.raises(httpx.HTTPStatusError):
            await _async(handler).get(dataset_label_id="missing")


class TestDatasetLabelsCreate:
    def test_create_sends_name_and_color(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            import json

            body = json.loads(request.content)
            assert body == {"name": "regression", "color": "#FF0000"}
            return httpx.Response(201, json={"data": _make_label(name="regression")})

        label = _sync(handler).create(name="regression", color="#FF0000")
        assert label["name"] == "regression"

    def test_create_omits_description_when_not_given(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            import json

            assert "description" not in json.loads(request.content)
            return httpx.Response(201, json={"data": _make_label()})

        _sync(handler).create(name="l", color="#FFF")

    def test_create_duplicate_name_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(409, json={"detail": "Dataset label already exists"})

        with pytest.raises(httpx.HTTPStatusError):
            _sync(handler).create(name="regression", color="#FF0000")

    async def test_async_create_duplicate_name_raises(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(409, json={"detail": "Dataset label already exists"})

        with pytest.raises(httpx.HTTPStatusError):
            await _async(handler).create(name="regression", color="#FF0000")


class TestDatasetLabelsUpdate:
    def test_update_uses_patch_and_sends_only_supplied_fields(self) -> None:
        """Omitted fields must not appear in the request body, so the server preserves them."""

        def handler(request: httpx.Request) -> httpx.Response:
            import json

            assert request.method == "PATCH"
            assert json.loads(request.content) == {"color": "#00FF00"}
            return httpx.Response(200, json={"data": _make_label(color="#00FF00")})

        label = _sync(handler).update(dataset_label_id="id1", color="#00FF00")
        assert label["color"] == "#00FF00"

    def test_update_sends_every_supplied_field(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            import json

            assert json.loads(request.content) == {
                "name": "n",
                "color": "#000",
                "description": "d",
            }
            return httpx.Response(200, json={"data": _make_label()})

        _sync(handler).update(dataset_label_id="id1", name="n", color="#000", description="d")

    def test_update_without_fields_raises_value_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
            raise AssertionError("no request should be sent")

        with pytest.raises(ValueError, match="At least one of name, color, or description"):
            _sync(handler).update(dataset_label_id="id1")

    async def test_async_update_without_fields_raises_value_error(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
            raise AssertionError("no request should be sent")

        with pytest.raises(ValueError, match="At least one of name, color, or description"):
            await _async(handler).update(dataset_label_id="id1")


class TestDatasetLabelsDelete:
    def test_delete_returns_none(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.url.path == "/v1/dataset_labels/id1"
            return httpx.Response(204)

        assert _sync(handler).delete(dataset_label_id="id1") is None

    def test_delete_missing_label_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Dataset label not found"})

        with pytest.raises(httpx.HTTPStatusError):
            _sync(handler).delete(dataset_label_id="missing")

    async def test_async_delete_returns_none(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(204)

        assert await _async(handler).delete(dataset_label_id="id1") is None
