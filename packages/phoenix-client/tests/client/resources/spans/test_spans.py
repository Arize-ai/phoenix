from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.resources.spans import AsyncSpans, Spans


def _make_span(
    *,
    name: str = "test-span",
    span_kind: str = "CHAIN",
    status_code: str = "OK",
) -> v1.Span:
    return v1.Span(
        name=name,
        context=v1.SpanContext(trace_id="trace-1", span_id="span-1"),
        span_kind=span_kind,
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T00:01:00Z",
        status_code=status_code,
    )


def _make_handler(
    expected_params: dict[str, list[str]] | None = None,
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert "/v1/projects/my-project/spans" in str(request.url)
        if expected_params:
            query_string = parse_qs(urlparse(str(request.url)).query)
            for key, values in expected_params.items():
                assert key in query_string, (
                    f"Expected query param '{key}' not found in {query_string}"
                )
                assert sorted(query_string[key]) == sorted(values)
        return httpx.Response(
            200,
            json={"data": [_make_span()], "next_cursor": None},
        )

    return httpx.MockTransport(handler)


class TestGetSpansFilters:
    def test_single_name_filter(self) -> None:
        transport = _make_handler(expected_params={"name": ["my-span"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            name="my-span",
        )
        assert len(spans) == 1

    def test_multiple_name_filter(self) -> None:
        transport = _make_handler(expected_params={"name": ["span-a", "span-b"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            name=["span-a", "span-b"],
        )
        assert len(spans) == 1

    def test_single_span_kind_filter(self) -> None:
        transport = _make_handler(expected_params={"span_kind": ["LLM"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            span_kind="LLM",
        )
        assert len(spans) == 1

    def test_multiple_span_kind_filter(self) -> None:
        transport = _make_handler(expected_params={"span_kind": ["CHAIN", "LLM"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            span_kind=["LLM", "CHAIN"],
        )
        assert len(spans) == 1

    def test_single_status_code_filter(self) -> None:
        transport = _make_handler(expected_params={"status_code": ["ERROR"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            status_code="ERROR",
        )
        assert len(spans) == 1

    def test_multiple_status_code_filter(self) -> None:
        transport = _make_handler(expected_params={"status_code": ["ERROR", "OK"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            status_code=["OK", "ERROR"],
        )
        assert len(spans) == 1

    def test_no_filters_omits_params(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            query_string = parse_qs(urlparse(str(request.url)).query)
            assert "name" not in query_string
            assert "span_kind" not in query_string
            assert "status_code" not in query_string
            return httpx.Response(
                200,
                json={"data": [_make_span()], "next_cursor": None},
            )

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        spans = Spans(client).get_spans(project_identifier="my-project")
        assert len(spans) == 1


class TestAsyncGetSpansFilters:
    @pytest.mark.anyio
    async def test_single_name_filter(self) -> None:
        transport = _make_handler(expected_params={"name": ["my-span"]})
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        spans = await AsyncSpans(client).get_spans(
            project_identifier="my-project",
            name="my-span",
        )
        assert len(spans) == 1

    @pytest.mark.anyio
    async def test_combined_filters(self) -> None:
        transport = _make_handler(
            expected_params={
                "name": ["my-span"],
                "span_kind": ["LLM"],
                "status_code": ["OK"],
            }
        )
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        spans = await AsyncSpans(client).get_spans(
            project_identifier="my-project",
            name="my-span",
            span_kind="LLM",
            status_code="OK",
        )
        assert len(spans) == 1
