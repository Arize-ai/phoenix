import httpx
import pandas as pd
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.sessions import AsyncSessions, Sessions
from phoenix.client.resources.spans import AsyncSpans, Spans


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
        result = Sessions(client, Spans(client)).get(session_id="my-session")
        assert result["session_id"] == "my-session"
        assert len(result["traces"]) == 2

    def test_get_raises_on_404(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "not found"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        with pytest.raises(httpx.HTTPStatusError):
            Sessions(client, Spans(client)).get(session_id="nonexistent")


class TestSessionsList:
    def test_list_requires_project_identifier(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(ValueError, match="Either project_id or project_name"):
            Sessions(client, Spans(client)).list()

    def test_list_rejects_both_identifiers(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(ValueError, match="Only one of"):
            Sessions(client, Spans(client)).list(project_id="p1", project_name="p1")

    def test_list_single_page(self) -> None:
        sessions = [_make_session_data(id=f"id{i}", session_id=f"s{i}") for i in range(3)]

        def handler(request: httpx.Request) -> httpx.Response:
            assert "/projects/my-project/sessions" in request.url.path
            return httpx.Response(200, json={"data": sessions, "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client, Spans(client)).list(project_name="my-project")
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
        result = Sessions(client, Spans(client)).list(project_name="proj")
        assert len(result) == 2
        assert result[0]["session_id"] == "s1"
        assert result[1]["session_id"] == "s2"

    def test_list_respects_limit(self) -> None:
        sessions = [_make_session_data(id=f"id{i}", session_id=f"s{i}") for i in range(5)]

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": sessions, "next_cursor": "more"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client, Spans(client)).list(project_name="proj", limit=3)
        assert len(result) == 3

    def test_list_by_project_id(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert "/projects/proj-id-123/sessions" in request.url.path
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = Sessions(client, Spans(client)).list(project_id="proj-id-123")
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
        df = Sessions(client, Spans(client)).get_sessions_dataframe(project_name="proj")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 2
        assert list(df.columns) == [
            "id",
            "session_id",
            "project_id",
            "start_time",
            "end_time",
            "num_traces",
        ]
        assert df.iloc[0]["num_traces"] == 3
        assert df.iloc[1]["num_traces"] == 0

    def test_returns_empty_dataframe(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        df = Sessions(client, Spans(client)).get_sessions_dataframe(project_name="proj")

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 0


class TestSessionsDelete:
    def test_delete_calls_correct_endpoint(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/sessions/my-session"
            assert request.method == "DELETE"
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        Sessions(client, Spans(client)).delete(session_id="my-session")

    def test_delete_raises_on_404(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(404, json={"detail": "not found"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        with pytest.raises(httpx.HTTPStatusError):
            Sessions(client, Spans(client)).delete(session_id="nonexistent")


class TestSessionsBulkDelete:
    def test_bulk_delete_sends_session_identifiers(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            import json

            assert request.url.path == "/v1/sessions/delete"
            body = json.loads(request.content)
            assert body == {"session_identifiers": ["s1", "s2", "s3"]}
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        Sessions(client, Spans(client)).bulk_delete(session_ids=["s1", "s2", "s3"])

    def test_bulk_delete_raises_on_empty_list(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(ValueError, match="must not be empty"):
            Sessions(client, Spans(client)).bulk_delete(session_ids=[])

    def test_bulk_delete_raises_on_422(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(422, json={"detail": "mixed types"})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        with pytest.raises(httpx.HTTPStatusError):
            Sessions(client, Spans(client)).bulk_delete(session_ids=["s1"])


class TestAsyncSessionsBulkDelete:
    @pytest.mark.anyio
    async def test_bulk_delete_sends_session_identifiers(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            import json

            assert request.url.path == "/v1/sessions/delete"
            body = json.loads(request.content)
            assert body == {"session_identifiers": ["s1", "s2"]}
            return httpx.Response(204)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        await AsyncSessions(client, AsyncSpans(client)).bulk_delete(session_ids=["s1", "s2"])

    @pytest.mark.anyio
    async def test_bulk_delete_raises_on_empty_list(self) -> None:
        client = httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(ValueError, match="must not be empty"):
            await AsyncSessions(client, AsyncSpans(client)).bulk_delete(session_ids=[])


class TestAsyncSessionsGet:
    @pytest.mark.anyio
    async def test_get_returns_session_data(self) -> None:
        session = _make_session_data(session_id="my-session", num_traces=1)

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/sessions/my-session"
            return httpx.Response(200, json={"data": session})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncSessions(client, AsyncSpans(client)).get(session_id="my-session")
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
        result = await AsyncSessions(client, AsyncSpans(client)).list(project_name="proj")
        assert len(result) == 2


class TestAsyncGetSessionsDataframe:
    @pytest.mark.anyio
    async def test_returns_dataframe(self) -> None:
        sessions = [_make_session_data(num_traces=2)]

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": sessions, "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        df = await AsyncSessions(client, AsyncSpans(client)).get_sessions_dataframe(
            project_name="proj"
        )

        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1
        assert df.iloc[0]["num_traces"] == 2


def _make_span(
    *,
    trace_id: str,
    span_id: str = "span1",
    input_value: str | None = None,
    output_value: str | None = None,
    input_mime_type: str | None = None,
    output_mime_type: str | None = None,
) -> v1.Span:
    attrs: dict[str, object] = {}
    if input_value is not None:
        attrs["input.value"] = input_value
    if output_value is not None:
        attrs["output.value"] = output_value
    if input_mime_type is not None:
        attrs["input.mime_type"] = input_mime_type
    if output_mime_type is not None:
        attrs["output.mime_type"] = output_mime_type
    return v1.Span(
        name="root",
        context=v1.SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind="CHAIN",
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T00:01:00Z",
        status_code="OK",
        attributes=attrs,
    )


class TestGetSessionTurns:
    def test_returns_conversation_turns_with_io(self) -> None:
        session = _make_session_data(session_id="s1", num_traces=2, project_id="proj1")

        span0 = _make_span(
            trace_id="tid-0", span_id="sp0", input_value="hello", output_value="world"
        )
        span1 = _make_span(trace_id="tid-1", span_id="sp1", input_value="foo", output_value="bar")

        def handler(request: httpx.Request) -> httpx.Response:
            if "/sessions/" in request.url.path:
                return httpx.Response(200, json={"data": session})
            if "/spans" in request.url.path:
                assert request.url.params.get("parent_id") == "null"
                return httpx.Response(200, json={"data": [span0, span1], "next_cursor": None})
            return httpx.Response(404)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        turns = Sessions(client, Spans(client)).get_session_turns(session_id="s1")

        assert len(turns) == 2
        assert turns[0]["trace_id"] == "tid-0"
        assert turns[0].get("input") == {"value": "hello"}
        assert turns[0].get("output") == {"value": "world"}
        assert turns[0].get("root_span") == span0
        assert turns[1]["trace_id"] == "tid-1"
        assert turns[1].get("input") == {"value": "foo"}
        assert turns[1].get("output") == {"value": "bar"}
        assert turns[1].get("root_span") == span1

    def test_empty_session_returns_empty_list(self) -> None:
        session = _make_session_data(session_id="s1", num_traces=0)

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": session})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        turns = Sessions(client, Spans(client)).get_session_turns(session_id="s1")
        assert turns == []

    def test_missing_root_span_still_returns_turn(self) -> None:
        session = _make_session_data(session_id="s1", num_traces=1)

        def handler(request: httpx.Request) -> httpx.Response:
            if "/sessions/" in request.url.path:
                return httpx.Response(200, json={"data": session})
            if "/spans" in request.url.path:
                return httpx.Response(200, json={"data": [], "next_cursor": None})
            return httpx.Response(404)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        turns = Sessions(client, Spans(client)).get_session_turns(session_id="s1")
        assert len(turns) == 1
        assert turns[0]["trace_id"] == "tid-0"
        assert "input" not in turns[0]
        assert "output" not in turns[0]
        assert "root_span" not in turns[0]

    def test_turns_ordered_by_start_time(self) -> None:
        traces = [
            v1.SessionTraceData(
                id="t1",
                trace_id="late",
                start_time="2024-01-01T01:00:00Z",
                end_time="2024-01-01T01:01:00Z",
            ),
            v1.SessionTraceData(
                id="t0",
                trace_id="early",
                start_time="2024-01-01T00:00:00Z",
                end_time="2024-01-01T00:01:00Z",
            ),
        ]
        session = v1.SessionData(
            id="id1",
            session_id="s1",
            project_id="proj1",
            start_time="2024-01-01T00:00:00Z",
            end_time="2024-01-01T02:00:00Z",
            traces=traces,
        )
        span_late = _make_span(trace_id="late", span_id="sp1", input_value="second")
        span_early = _make_span(trace_id="early", span_id="sp0", input_value="first")

        def handler(request: httpx.Request) -> httpx.Response:
            if "/sessions/" in request.url.path:
                return httpx.Response(200, json={"data": session})
            if "/spans" in request.url.path:
                return httpx.Response(
                    200, json={"data": [span_late, span_early], "next_cursor": None}
                )
            return httpx.Response(404)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        turns = Sessions(client, Spans(client)).get_session_turns(session_id="s1")
        assert turns[0].get("input") == {"value": "first"}
        assert turns[1].get("input") == {"value": "second"}


class TestAsyncGetSessionTurns:
    @pytest.mark.anyio
    async def test_returns_conversation_turns(self) -> None:
        session = _make_session_data(session_id="s1", num_traces=1, project_id="proj1")
        span = _make_span(
            trace_id="tid-0",
            input_value="hi",
            output_value="bye",
            input_mime_type="text/plain",
            output_mime_type="text/plain",
        )

        async def handler(request: httpx.Request) -> httpx.Response:
            if "/sessions/" in request.url.path:
                return httpx.Response(200, json={"data": session})
            if "/spans" in request.url.path:
                return httpx.Response(200, json={"data": [span], "next_cursor": None})
            return httpx.Response(404)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        turns = await AsyncSessions(client, AsyncSpans(client)).get_session_turns(session_id="s1")
        assert len(turns) == 1
        assert turns[0].get("input") == {"value": "hi", "mime_type": "text/plain"}
        assert turns[0].get("output") == {"value": "bye", "mime_type": "text/plain"}
        assert turns[0].get("root_span") == span
