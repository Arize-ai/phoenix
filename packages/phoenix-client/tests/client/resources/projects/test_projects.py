import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.projects import AsyncProjects, Projects


def _make_project(*, id: str = "id1", name: str = "proj-1") -> v1.Project:
    return v1.Project(id=id, name=name)


class TestProjectsList:
    def test_list_single_page(self) -> None:
        projects = [_make_project(id=f"id{i}", name=f"p{i}") for i in range(3)]

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/projects"
            assert "name_contains" not in request.url.params
            return httpx.Response(200, json={"data": projects, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Projects(client).list()
        assert len(result) == 3

    def test_list_forwards_name_contains(self) -> None:
        projects = [_make_project(id="id1", name="my-agent")]

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params.get("name_contains") == "agent"
            return httpx.Response(200, json={"data": projects, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Projects(client).list(name_contains="agent")
        assert len(result) == 1
        assert result[0]["name"] == "my-agent"

    def test_list_forwards_name_contains_on_every_page(self) -> None:
        page1 = [_make_project(id="id1", name="agent-1")]
        page2 = [_make_project(id="id2", name="agent-2")]

        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            assert request.url.params.get("name_contains") == "agent"
            if call_count == 1:
                assert "cursor" not in request.url.params
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            else:
                assert request.url.params.get("cursor") == "cursor-abc"
                return httpx.Response(200, json={"data": page2, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Projects(client).list(name_contains="agent")
        assert len(result) == 2
        assert call_count == 2

    def test_list_without_name_contains_does_not_send_param(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert "name_contains" not in request.url.params
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Projects(client).list()
        assert result == []


class TestAsyncProjectsList:
    @pytest.mark.anyio
    async def test_list_forwards_name_contains(self) -> None:
        projects = [_make_project(id="id1", name="my-agent")]

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params.get("name_contains") == "agent"
            return httpx.Response(200, json={"data": projects, "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncProjects(client).list(name_contains="agent")
        assert len(result) == 1
        assert result[0]["name"] == "my-agent"

    @pytest.mark.anyio
    async def test_list_forwards_name_contains_on_every_page(self) -> None:
        page1 = [_make_project(id="id1", name="agent-1")]
        page2 = [_make_project(id="id2", name="agent-2")]

        call_count = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            assert request.url.params.get("name_contains") == "agent"
            if call_count == 1:
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            else:
                assert request.url.params.get("cursor") == "cursor-abc"
                return httpx.Response(200, json={"data": page2, "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncProjects(client).list(name_contains="agent")
        assert len(result) == 2
        assert call_count == 2

    @pytest.mark.anyio
    async def test_list_without_name_contains_does_not_send_param(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert "name_contains" not in request.url.params
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncProjects(client).list()
        assert result == []
