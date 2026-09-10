from typing import Literal

import httpx
import pytest

from phoenix.client.exceptions import PhoenixException
from phoenix.client.resources.sessions import AsyncSessions, Sessions
from phoenix.client.resources.spans import AsyncSpans, Spans
from phoenix.client.resources.traces import AsyncTraces, Traces

Resource = Literal["traces", "sessions", "sessions_dataframe"]
CONDITION = 'any(span.name == "café & search" for span in spans)'


async def _read(
    transport: httpx.MockTransport,
    resource: Resource,
    is_async: bool,
    filter: str | None,
) -> int:
    if is_async:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            if resource == "traces":
                return len(
                    await AsyncTraces(client).get_traces(
                        project_identifier="project", filter=filter, limit=2
                    )
                )
            sessions = AsyncSessions(client, AsyncSpans(client))
            if resource == "sessions_dataframe":
                return len(
                    await sessions.get_sessions_dataframe(
                        project_name="project", filter=filter, limit=2
                    )
                )
            return len(await sessions.list(project_name="project", filter=filter, limit=2))
    with httpx.Client(transport=transport, base_url="http://test") as sync_client:
        if resource == "traces":
            return len(
                Traces(sync_client).get_traces(project_identifier="project", filter=filter, limit=2)
            )
        sync_sessions = Sessions(sync_client, Spans(sync_client))
        if resource == "sessions_dataframe":
            return len(
                sync_sessions.get_sessions_dataframe(project_name="project", filter=filter, limit=2)
            )
        return len(sync_sessions.list(project_name="project", filter=filter, limit=2))


@pytest.mark.parametrize("resource", ["traces", "sessions", "sessions_dataframe"])
@pytest.mark.parametrize("is_async", [False, True])
async def test_filter_preserved_on_every_page(resource: Resource, is_async: bool) -> None:
    cursors: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text="20.10.0")
        assert request.url.params["filter"] == CONDITION
        cursors.append(request.url.params.get("cursor"))
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": str(len(cursors)),
                        "project_id": "project",
                        "trace_id": "trace",
                        "session_id": "session",
                        "start_time": "2026-01-01T00:00:00Z",
                        "end_time": "2026-01-01T00:00:01Z",
                        "traces": [],
                    }
                ],
                "next_cursor": "second-page" if len(cursors) == 1 else None,
            },
        )

    assert await _read(httpx.MockTransport(handler), resource, is_async, CONDITION) == 2
    assert cursors == [None, "second-page"]


@pytest.mark.parametrize("resource", ["traces", "sessions", "sessions_dataframe"])
@pytest.mark.parametrize("is_async", [False, True])
async def test_filter_rejects_old_server_before_listing(resource: Resource, is_async: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/arize_phoenix_version"
        return httpx.Response(200, text="20.9.0")

    with pytest.raises(PhoenixException, match=r"'filter'.*requires Phoenix >= 20\.10\.0"):
        await _read(httpx.MockTransport(handler), resource, is_async, CONDITION)


@pytest.mark.parametrize("resource", ["traces", "sessions", "sessions_dataframe"])
@pytest.mark.parametrize("is_async", [False, True])
@pytest.mark.parametrize("filter", [None, ""])
async def test_no_filter_preserves_old_server_support(
    resource: Resource, is_async: bool, filter: str | None
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text="14.0.0")
        assert "filter" not in request.url.params
        return httpx.Response(200, json={"data": [], "next_cursor": None})

    assert await _read(httpx.MockTransport(handler), resource, is_async, filter) == 0


@pytest.mark.parametrize("resource", ["traces", "sessions"])
@pytest.mark.parametrize("is_async", [False, True])
async def test_filter_error_preserves_server_message(resource: Resource, is_async: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text="20.10.0")
        assert request.url.params["filter"] == "unknown_field > 0"
        return httpx.Response(400, text="invalid name `unknown_field`")

    with pytest.raises(httpx.HTTPStatusError) as error:
        await _read(httpx.MockTransport(handler), resource, is_async, "unknown_field > 0")
    assert error.value.response.status_code == 400
    assert error.value.response.text == "invalid name `unknown_field`"


@pytest.mark.parametrize("is_async", [False, True])
async def test_legacy_trace_filters_keep_their_server_requirement(is_async: bool) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text="20.8.0")
        assert request.url.params["error"] == "false"
        assert request.url.params["min_latency_ms"] == "0"
        assert request.url.params["max_latency_ms"] == "500"
        assert "filter" not in request.url.params
        return httpx.Response(200, json={"data": [], "next_cursor": None})

    transport = httpx.MockTransport(handler)
    if is_async:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            assert (
                await AsyncTraces(client).get_traces(
                    project_identifier="project", error=False, min_latency_ms=0, max_latency_ms=500
                )
                == []
            )
    else:
        with httpx.Client(transport=transport, base_url="http://test") as sync_client:
            assert (
                Traces(sync_client).get_traces(
                    project_identifier="project", error=False, min_latency_ms=0, max_latency_ms=500
                )
                == []
            )
