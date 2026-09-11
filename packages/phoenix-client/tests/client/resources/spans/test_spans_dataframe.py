from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.resources import spans as spans_resource
from phoenix.client.resources.spans import AsyncSpans, Spans
from phoenix.client.types.spans import SpanQuery


def _span(index: int) -> dict[str, object]:
    return {
        "name": f"span-{index}",
        "context": {"trace_id": f"trace-{index}", "span_id": f"span-{index}"},
        "span_kind": "CHAIN",
        "start_time": "2024-01-01T00:00:00Z",
        "end_time": "2024-01-01T00:01:00Z",
        "status_code": "OK",
        "status_message": "",
        "attributes": {"service.name": "phoenix"},
        "events": [],
    }


def test_get_spans_dataframe_paginates_simple_exports() -> None:
    requests: list[dict[str, list[str]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        params = parse_qs(urlparse(str(request.url)).query)
        requests.append(params)
        if "cursor" in params:
            return httpx.Response(
                200,
                json={
                    "data": [_span(index) for index in range(100, 150)],
                    "next_cursor": None,
                },
            )
        return httpx.Response(
            200,
            json={
                "data": [_span(index) for index in range(100)],
                "next_cursor": "cursor-1",
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    dataframe = Spans(client).get_spans_dataframe(
        project_identifier="my-project",
        limit=150,
    )

    assert len(dataframe) == 150
    assert dataframe.index.name == "context.span_id"
    assert dataframe.iloc[0]["context.span_id"] == "span-0"
    assert "attributes.service.name" in dataframe.columns
    assert str(dataframe.iloc[0]["start_time"]) == "2024-01-01 00:00:00+00:00"
    assert [params["limit"] for params in requests] == [["100"], ["50"]]
    assert "cursor" not in requests[0]
    assert requests[1]["cursor"] == ["cursor-1"]


@pytest.mark.anyio
async def test_async_get_spans_dataframe_paginates_simple_exports() -> None:
    requests: list[dict[str, list[str]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        params = parse_qs(urlparse(str(request.url)).query)
        requests.append(params)
        if "cursor" in params:
            return httpx.Response(
                200,
                json={"data": [_span(100)], "next_cursor": None},
            )
        return httpx.Response(
            200,
            json={
                "data": [_span(index) for index in range(100)],
                "next_cursor": "cursor-1",
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
    dataframe = await AsyncSpans(client).get_spans_dataframe(
        project_identifier="my-project",
        limit=101,
    )

    assert len(dataframe) == 101
    assert dataframe.index.name == "context.span_id"
    assert [params["limit"] for params in requests] == [["100"], ["1"]]
    assert requests[1]["cursor"] == ["cursor-1"]


def test_get_spans_dataframe_keeps_dsl_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(200)

    sentinel = object()
    monkeypatch.setattr(spans_resource, "_process_span_dataframe", lambda response: sentinel)
    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")

    result = Spans(client).get_spans_dataframe(
        query=SpanQuery().where("name == 'test-span'"),
        project_identifier="my-project",
    )

    assert result is sentinel
    assert methods == ["POST"]
