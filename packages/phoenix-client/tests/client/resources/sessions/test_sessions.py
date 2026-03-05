
import httpx
import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.sessions import AsyncSessions, Sessions


def _make_session_data(
    *,
    id: str = "id1",
    session_id: str = "sess-1",
    project_id: str = "proj-1",
    num_traces: int = 0,
) -> v1.SessionData:
    traces: list[v1.SessionTraceData] = [
        v1.SessionTraceData(
            id=f"trace-{i}",
            trace_id=f"tid-{i}",
            start_time="2024-01-01T00:00:00Z",
            end_time="2024-01-01T00:01:00Z",
        )
        for i in range(num_traces)
    ]
    return v1.SessionData(
        id=id,
        session_id=session_id,
        project_id=project_id,
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T01:00:00Z",
        traces=traces,
    )


class TestSessionsGet:
    def test_get_returns_session_data(self) -> None:
        session = _make_session_data(session_id="my-session", num_traces=2)

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/sessions/my-session"
            return httpx.Response(200, json={"data": session})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client).get(session_id="my-session")
        assert result["session_id"] == "my-session"
        assert len(result["traces"]) == 2

    def test_get_raises_on_404(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "not found"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        with pytest.raises(httpx.HTTPStatusError):
            Sessions(client).get(session_id="nonexistent")


class TestSessionsList:
    def test_list_requires_project_identifier(self) -> None:
        client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test")
        with pytest.raises(ValueError, match="Either project_id or project_name"):
            Sessions(client).list()

    def test_list_rejects_both_identifiers(self) -> None:
        client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test")
        with pytest.raises(ValueError, match="Only one of"):
            Sessions(client).list(project_id="p1", project_name="p1")

    def test_list_single_page(self) -> None:
        sessions = [_make_session_data(id=f"id{i}", session_id=f"s{i}") for i in range(3)]

        def handler(request: httpx.Request) -> httpx.Response:
            assert "/projects/my-project/sessions" in request.url.path
            return httpx.Response(200, json={"data": sessions, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client).list(project_name="my-project")
        assert len(result) == 3

    def test_list_paginates(self) -> None:
        page1 = [_make_session_data(id="id1", session_id="s1")]
        page2 = [_make_session_data(id="id2", session_id="s2")]

        call_count = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                assert "cursor" not in str(request.url)
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            else:
                assert "cursor=cursor-abc" in str(request.url)
                return httpx.Response(200, json={"data": page2, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client).list(project_name="proj")
        assert len(result) == 2
        assert result[0]["session_id"] == "s1"
        assert result[1]["session_id"] == "s2"

    def test_list_respects_limit(self) -> None:
        sessions = [_make_session_data(id=f"id{i}", session_id=f"s{i}") for i in range(5)]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": sessions, "next_cursor": "more"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client).list(project_name="proj", limit=3)
        assert len(result) == 3

    def test_list_by_project_id(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert "/projects/proj-id-123/sessions" in request.url.path
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client).list(project_id="proj-id-123")
        assert result == []


class TestGetSessionsDataframe:
    def test_returns_dataframe_with_expected_columns(self) -> None:
        sessions = [
            _make_session_data(id="id1", session_id="s1", project_id="p1", num_traces=3),
            _make_session_data(id="id2", session_id="s2", project_id="p1", num_traces=0),
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": sessions, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        df = Sessions(client).get_sessions_dataframe(project_name="proj")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert list(df.columns) == ["id", "session_id", "project_id", "start_time", "end_time", "num_traces"]
        assert df.iloc[0]["num_traces"] == 3
        assert df.iloc[1]["num_traces"] == 0

    def test_returns_empty_dataframe(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        df = Sessions(client).get_sessions_dataframe(project_name="proj")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0


class TestAsyncSessionsGet:
    @pytest.mark.anyio
    async def test_get_returns_session_data(self) -> None:
        session = _make_session_data(session_id="my-session", num_traces=1)

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/sessions/my-session"
            return httpx.Response(200, json={"data": session})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncSessions(client).get(session_id="my-session")
        assert result["session_id"] == "my-session"


class TestAsyncSessionsList:
    @pytest.mark.anyio
    async def test_list_paginates(self) -> None:
        page1 = [_make_session_data(id="id1", session_id="s1")]
        page2 = [_make_session_data(id="id2", session_id="s2")]

        call_count = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return httpx.Response(200, json={"data": page1, "next_cursor": "cursor-abc"})
            else:
                return httpx.Response(200, json={"data": page2, "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncSessions(client).list(project_name="proj")
        assert len(result) == 2


class TestAsyncGetSessionsDataframe:
    @pytest.mark.anyio
    async def test_returns_dataframe(self) -> None:
        sessions = [_make_session_data(num_traces=2)]

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": sessions, "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        df = await AsyncSessions(client).get_sessions_dataframe(project_name="proj")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1
        assert df.iloc[0]["num_traces"] == 2
