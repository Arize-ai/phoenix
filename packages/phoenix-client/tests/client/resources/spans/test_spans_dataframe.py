import json
from typing import Any
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.exceptions import PhoenixException
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
    assert set(map(str, dataframe.dtypes)) == {"object"}, "legacy left an empty frame untyped"


def test_get_spans_dataframe_sends_the_where_clause_as_a_filter_expression() -> None:
    client, requests = _client_returning([{"data": [_span(0)], "next_cursor": None}])

    Spans(client).get_spans_dataframe(
        query=SpanQuery().where("name == 'span-0'"), project_identifier="my-project"
    )

    assert _query_params(requests[0])["filter"] == ["name == 'span-0'"]


def test_get_spans_dataframe_sends_root_spans_only() -> None:
    client, requests = _client_returning([{"data": [_span(0)], "next_cursor": None}])

    with pytest.warns(DeprecationWarning):
        Spans(client).get_spans_dataframe(project_identifier="my-project", root_spans_only=True)

    assert _query_params(requests[0])["root_spans_only"] == ["true"]


def test_get_spans_dataframe_percent_encodes_the_project_name() -> None:
    client, requests = _client_returning([{"data": [], "next_cursor": None}])

    Spans(client).get_spans_dataframe(project_identifier="team/alpha?x#y")

    assert urlparse(str(requests[0].url)).path == "/v1/projects/team%2Falpha%3Fx%23y/spans"


def test_get_spans_dataframe_select_keeps_only_the_projected_columns() -> None:
    attributes = {"input.value": "hi", "output.value": "yo", "llm.token_count.total": 7}
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=attributes)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().select("name", "input.value", "output.value"),
        project_identifier="my-project",
    )

    assert list(dataframe.columns) == ["name", "input.value", "output.value"]
    assert dataframe.index.name == "context.span_id"
    assert dataframe.loc["span-0"].to_dict() == {
        "name": "span-0",
        "input.value": "hi",
        "output.value": "yo",
    }


def test_get_spans_dataframe_select_computes_latency_and_parses_timestamps() -> None:
    client, _ = _client_returning([{"data": [_span(0)], "next_cursor": None}])

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().select("start_time", "latency_ms"), project_identifier="my-project"
    )

    assert str(dataframe.dtypes["start_time"]) == "datetime64[ns, UTC]"
    assert dataframe.loc["span-0", "latency_ms"] == 60_000


def test_get_spans_dataframe_explode_yields_one_row_per_document() -> None:
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=_SEMANTIC_ATTRIBUTES)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().explode("retrieval.documents", reference="document.content"),
        project_identifier="my-project",
    )

    assert dataframe.index.names == ["context.span_id", "document_position"]
    assert list(dataframe.columns) == ["reference"]
    assert dataframe["reference"].to_list() == ["doc a", "doc b"]
    assert dataframe.index.to_list() == [("span-0", 0), ("span-0", 1)]


def test_get_spans_dataframe_explode_without_names_flattens_each_document() -> None:
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=_SEMANTIC_ATTRIBUTES)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().select("input.value").explode("retrieval.documents"),
        project_identifier="my-project",
    )

    assert dataframe["document.content"].to_list() == ["doc a", "doc b"]
    assert dataframe["input.value"].isna().all()


def test_get_spans_dataframe_explode_drops_spans_without_the_array() -> None:
    client, _ = _client_returning(
        [
            {
                "data": [_span(0, attributes=_SEMANTIC_ATTRIBUTES), _span(1)],
                "next_cursor": None,
            }
        ]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().explode("retrieval.documents", reference="document.content"),
        project_identifier="my-project",
    )

    assert dataframe.index.get_level_values("context.span_id").unique().to_list() == ["span-0"]


def test_get_spans_dataframe_concat_joins_documents() -> None:
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=_SEMANTIC_ATTRIBUTES)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery()
        .select("input.value")
        .concat("retrieval.documents", reference="document.content"),
        project_identifier="my-project",
    )

    assert list(dataframe.columns) == ["input.value", "reference"]
    assert dataframe.loc["span-0", "reference"] == "doc a\n\ndoc b"


def test_get_spans_dataframe_rename_and_index() -> None:
    attributes = {"input.value": "hi"}
    client, _ = _client_returning(
        [{"data": [_span(0, attributes=attributes)], "next_cursor": None}]
    )

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery()
        .select("input.value")
        .rename(**{"input.value": "input"})
        .with_index("trace_id"),
        project_identifier="my-project",
    )

    assert dataframe.index.name == "context.trace_id"
    assert list(dataframe.columns) == ["input"]
    assert dataframe.loc["trace-0", "input"] == "hi"


def test_get_spans_dataframe_projected_empty_result_keeps_columns() -> None:
    client, _ = _client_returning([{"data": [], "next_cursor": None}])

    dataframe = Spans(client).get_spans_dataframe(
        query=SpanQuery().select("input.value", "output.value"), project_identifier="my-project"
    )

    assert dataframe.empty
    assert list(dataframe.columns) == ["input.value", "output.value"]
    assert dataframe.index.name == "context.span_id"


def test_get_spans_dataframe_rejects_projections_the_endpoint_cannot_serve() -> None:
    client, _ = _client_returning([{"data": [_span(0)], "next_cursor": None}])

    with pytest.raises(ValueError, match="cumulative_llm_token_count_total"):
        Spans(client).get_spans_dataframe(
            query=SpanQuery().select("cumulative_token_count.total"),
            project_identifier="my-project",
        )


def test_get_spans_dataframe_raises_on_old_server() -> None:
    client, requests = _client_returning([{"data": [], "next_cursor": None}])

    with patch(
        "phoenix.client.utils.server_requirements.ServerVersionGuard.require",
        side_effect=PhoenixException("too old"),
    ):
        with pytest.raises(PhoenixException, match="too old"):
            Spans(client).get_spans_dataframe(project_identifier="my-project")

    assert requests == []
