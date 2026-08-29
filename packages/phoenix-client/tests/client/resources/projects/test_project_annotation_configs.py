import json
from typing import Any

import httpx
import pytest

from phoenix.client.resources.projects import AsyncProjects, Projects


def _make_config(*, id: str = "cfg1", name: str = "quality") -> dict[str, Any]:
    return {"id": id, "name": name, "annotation_type": "FREEFORM", "description": None}


def _sync(handler: Any) -> Projects:
    return Projects(httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test"))


def _async(handler: Any) -> AsyncProjects:
    return AsyncProjects(
        httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
    )


class TestListAnnotationConfigs:
    def test_list_by_project_name(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            # raw_path, not path: proves the space is percent-encoded on the wire
            assert request.url.raw_path == b"/v1/projects/My%20Project/annotation_configs"
            return httpx.Response(200, json={"data": [_make_config()], "next_cursor": None})

        result = _sync(handler).list_annotation_configs(project_name="My Project")
        assert [c["name"] for c in result] == ["quality"]

    def test_list_by_project_id(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/projects/UHJvamVjdDoy/annotation_configs"
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        assert _sync(handler).list_annotation_configs(project_id="UHJvamVjdDoy") == []

    def test_list_follows_cursor_pagination(self) -> None:
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                assert "cursor" not in request.url.params
                return httpx.Response(
                    200, json={"data": [_make_config(id="cfg1")], "next_cursor": "c2"}
                )
            assert request.url.params.get("cursor") == "c2"
            return httpx.Response(
                200, json={"data": [_make_config(id="cfg2")], "next_cursor": None}
            )

        result = _sync(handler).list_annotation_configs(project_name="p")
        assert call_count == 2
        assert [c["id"] for c in result] == ["cfg1", "cfg2"]

    async def test_async_list_follows_cursor_pagination(self) -> None:
        call_count = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return httpx.Response(
                    200, json={"data": [_make_config(id="cfg1")], "next_cursor": "c2"}
                )
            return httpx.Response(
                200, json={"data": [_make_config(id="cfg2")], "next_cursor": None}
            )

        result = await _async(handler).list_annotation_configs(project_name="p")
        assert [c["id"] for c in result] == ["cfg1", "cfg2"]


class TestAssignAnnotationConfig:
    def test_assign_uses_put_on_the_pair_route(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PUT"
            assert request.url.path == "/v1/projects/p/annotation_configs/quality"
            return httpx.Response(200, json={"data": _make_config()})

        config = _sync(handler).assign_annotation_config(
            project_name="p", annotation_config_identifier="quality"
        )
        assert config["name"] == "quality"

    def test_assign_is_idempotent(self) -> None:
        """Assigning an already-assigned config succeeds and returns the same config."""
        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(200, json={"data": _make_config()})

        projects = _sync(handler)
        first = projects.assign_annotation_config(
            project_name="p", annotation_config_identifier="quality"
        )
        second = projects.assign_annotation_config(
            project_name="p", annotation_config_identifier="quality"
        )
        assert call_count == 2
        assert first == second

    def test_assign_missing_config_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Annotation config not found"})

        with pytest.raises(httpx.HTTPStatusError):
            _sync(handler).assign_annotation_config(
                project_name="p", annotation_config_identifier="nope"
            )


class TestUnassignAnnotationConfig:
    def test_unassign_uses_delete_and_returns_none(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.url.path == "/v1/projects/p/annotation_configs/quality"
            return httpx.Response(204)

        result = _sync(handler).unassign_annotation_config(
            project_name="p", annotation_config_identifier="quality"
        )
        assert result is None

    def test_unassign_missing_project_raises(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "Project not found"})

        with pytest.raises(httpx.HTTPStatusError):
            _sync(handler).unassign_annotation_config(
                project_name="nope", annotation_config_identifier="quality"
            )

    async def test_async_unassign_returns_none(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(204)

        assert (
            await _async(handler).unassign_annotation_config(
                project_name="p", annotation_config_identifier="quality"
            )
        ) is None


class TestSetAnnotationConfigs:
    def test_set_sends_the_id_list_on_the_collection_route(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PUT"
            assert request.url.path == "/v1/projects/p/annotation_configs"
            assert json.loads(request.content) == {"annotation_config_ids": ["cfg1", "cfg2"]}
            return httpx.Response(
                200,
                json={
                    "data": [_make_config(id="cfg1"), _make_config(id="cfg2")],
                    "next_cursor": None,
                },
            )

        result = _sync(handler).set_annotation_configs(
            project_name="p", annotation_config_ids=["cfg1", "cfg2"]
        )
        assert [c["id"] for c in result] == ["cfg1", "cfg2"]

    def test_set_empty_clears_every_assignment(self) -> None:
        """An empty sequence is a real replacement, not a no-op, and must still be sent."""

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"annotation_config_ids": []}
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        assert (
            _sync(handler).set_annotation_configs(project_name="p", annotation_config_ids=[]) == []
        )

    def test_set_accepts_any_sequence(self) -> None:
        """A tuple must be serialized as a JSON array, not rejected."""

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"annotation_config_ids": ["cfg1"]}
            return httpx.Response(200, json={"data": [_make_config()], "next_cursor": None})

        _sync(handler).set_annotation_configs(project_name="p", annotation_config_ids=("cfg1",))

    async def test_async_set_empty_clears_every_assignment(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"annotation_config_ids": []}
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        assert (
            await _async(handler).set_annotation_configs(project_name="p", annotation_config_ids=[])
        ) == []


class TestProjectIdentifierValidation:
    @pytest.mark.parametrize(
        "kwargs",
        [{}, {"project_id": "a", "project_name": "b"}],
        ids=["neither", "both"],
    )
    def test_invalid_project_identifier_raises_before_any_request(
        self, kwargs: dict[str, str]
    ) -> None:
        def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover
            raise AssertionError("no request should be sent")

        with pytest.raises(ValueError):
            _sync(handler).list_annotation_configs(**kwargs)
        with pytest.raises(ValueError):
            _sync(handler).assign_annotation_config(
                annotation_config_identifier="quality", **kwargs
            )
        with pytest.raises(ValueError):
            _sync(handler).unassign_annotation_config(
                annotation_config_identifier="quality", **kwargs
            )
        with pytest.raises(ValueError):
            _sync(handler).set_annotation_configs(annotation_config_ids=[], **kwargs)
