import json
from typing import Any
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.exceptions import PhoenixException
from phoenix.client.resources import spans as spans_resource
from phoenix.client.resources.spans import AsyncSpans, Spans
from phoenix.client.types.spans import SpanQuery

_LEGACY_COLUMNS = [
    "name",
    "span_kind",
    "parent_id",
    "start_time",
    "end_time",
    "status_code",
    "status_message",
    "events",
    "context.span_id",
    "context.trace_id",
]

_SEMANTIC_ATTRIBUTES: dict[str, Any] = {
    "openinference.span.kind": "LLM",
    "llm.input_messages.0.message.role": "user",
    "llm.input_messages.0.message.content": "hi",
    "llm.input_messages.1.message.role": "assistant",
    "llm.input_messages.1.message.content": "hello",
    "retrieval.documents.0.document.content": "doc a",
    "retrieval.documents.0.document.metadata": json.dumps({"source": "a"}),
    "retrieval.documents.1.document.content": "doc b",
    "llm.token_count.total": 7,
    "metadata": json.dumps({"tenant": "acme"}),
    "custom.nested.key": "value",
}


def _span(
    index: int,
    *,
    start_time: str = "2024-01-01T00:00:00Z",
    attributes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "name": f"span-{index}",
        "context": {"trace_id": f"trace-{index}", "span_id": f"span-{index}"},
        "span_kind": "CHAIN",
        "start_time": start_time,
        "end_time": "2024-01-01T00:01:00Z",
        "status_code": "OK",
        "status_message": "",
        "attributes": {"service.name": "phoenix"} if attributes is None else attributes,
        "events": [],
    }


def _client_returning(pages: list[dict[str, Any]]) -> tuple[httpx.Client, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=pages[len(requests) - 1])

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    return client, requests


def _query_params(request: httpx.Request) -> dict[str, list[str]]:
    return parse_qs(urlparse(str(request.url)).query)


def test_get_spans_dataframe_paginates_simple_exports() -> None:
    client, requests = _client_returning(
        [
            {"data": [_span(index) for index in range(100)], "next_cursor": "cursor-1"},
            {"data": [_span(index) for index in range(100, 150)], "next_cursor": None},
        ]
    )

    dataframe = Spans(client).get_spans_dataframe(project_identifier="my-project", limit=150)

    assert len(dataframe) == 150
    assert dataframe.index.name == "context.span_id"
    assert dataframe.iloc[0]["context.span_id"] == "span-0"
    assert "attributes.service" in dataframe.columns
    assert str(dataframe.iloc[0]["start_time"]) == "2024-01-01 00:00:00+00:00"
    assert [_query_params(r)["limit"] for r in requests] == [["100"], ["50"]]
    assert "cursor" not in _query_params(requests[0])
    assert _query_params(requests[1])["cursor"] == ["cursor-1"]


@pytest.mark.anyio
async def test_async_get_spans_dataframe_paginates_simple_exports() -> None:
    requests: list[httpx.Request] = []
    pages = [
        {"data": [_span(index) for index in range(100)], "next_cursor": "cursor-1"},
        {"data": [_span(100)], "next_cursor": None},
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=pages[len(requests) - 1])

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
    dataframe = await AsyncSpans(client).get_spans_dataframe(
        project_identifier="my-project", limit=101
    )

    assert len(dataframe) == 101
    assert dataframe.index.name == "context.span_id"
    assert [_query_params(r)["limit"] for r in requests] == [["100"], ["1"]]
    assert _query_params(requests[1])["cursor"] == ["cursor-1"]


def test_get_spans_dataframe_matches_legacy_columns() -> None:
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=_SEMANTIC_ATTRIBUTES)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert list(dataframe.columns[:10]) == _LEGACY_COLUMNS
    row = dataframe.iloc[0]
    assert row["attributes.llm.input_messages"] == [
        {"message.role": "user", "message.content": "hi"},
        {"message.role": "assistant", "message.content": "hello"},
    ]
    assert row["attributes.retrieval.documents"] == [
        {"document.content": "doc a", "document.metadata": {"source": "a"}},
        {"document.content": "doc b"},
    ]
    assert row["attributes.llm.token_count.total"] == 7
    assert row["attributes.metadata"] == {"tenant": "acme"}
    assert row["attributes.custom"] == {"nested": {"key": "value"}}
    assert not any(
        str(column).startswith("attributes.llm.input_messages.") for column in dataframe.columns
    )


def test_get_spans_dataframe_parses_mixed_timestamp_precision() -> None:
    client, _ = _client_returning(
        [
            {
                "data": [
                    _span(0, start_time="2024-01-01T00:00:00+00:00"),
                    _span(1, start_time="2024-01-01T00:00:00.123456+00:00"),
                ],
                "next_cursor": None,
            }
        ]
    )

    dataframe = Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert str(dataframe.dtypes["start_time"]) == "datetime64[ns, UTC]"
    assert str(dataframe.loc["span-1", "start_time"]) == "2024-01-01 00:00:00.123456+00:00"


def test_get_spans_dataframe_asks_the_server_to_sort_by_start_time() -> None:
    client, requests = _client_returning([{"data": [_span(0)], "next_cursor": None}])

    Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert _query_params(requests[0])["sort"] == ["start_time"]


def test_get_spans_dataframe_empty_result_keeps_shape() -> None:
    client, _ = _client_returning([{"data": [], "next_cursor": None}])

    dataframe = Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert dataframe.empty
    assert dataframe.index.name == "context.span_id"
    assert list(dataframe.columns) == _LEGACY_COLUMNS
    assert str(dataframe.dtypes["start_time"]) == "datetime64[ns, UTC]"


def _stub_legacy_decoder(monkeypatch: pytest.MonkeyPatch) -> object:
    sentinel = object()

    def decode(response: httpx.Response) -> object:
        return sentinel

    monkeypatch.setattr(spans_resource, "_process_span_dataframe", decode)
    return sentinel


def _legacy_post_client() -> tuple[httpx.Client, list[httpx.Request]]:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200)

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    return client, requests


def test_get_spans_dataframe_keeps_dsl_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    sentinel = _stub_legacy_decoder(monkeypatch)
    client, requests = _legacy_post_client()

    result = Spans(client).get_spans_dataframe(
        query=SpanQuery().where("name == 'test-span'"),
        project_identifier="my-project",
    )

    assert result is sentinel
    assert [r.method for r in requests] == ["POST"]


def test_get_spans_dataframe_sends_path_unsafe_project_names_to_legacy_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = _stub_legacy_decoder(monkeypatch)
    client, requests = _legacy_post_client()

    result = Spans(client).get_spans_dataframe(project_identifier="team/app")

    assert result is sentinel
    assert [r.method for r in requests] == ["POST"]
    assert _query_params(requests[0])["project_name"] == ["team/app"]


def test_get_spans_dataframe_falls_back_to_legacy_endpoint_on_old_server(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sentinel = _stub_legacy_decoder(monkeypatch)
    client, requests = _legacy_post_client()

    with patch(
        "phoenix.client.utils.server_requirements.ServerVersionGuard.require",
        side_effect=PhoenixException("too old"),
    ):
        result = Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert result is sentinel
    assert [r.method for r in requests] == ["POST"]
