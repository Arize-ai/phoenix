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


class TestGetSpansAttributeFilters:
    def test_single_attribute_filter(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["llm.model:gpt-4"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"llm.model": "gpt-4"},
        )
        assert len(spans) == 1

    def test_multiple_attribute_filters(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["llm.model:gpt-4", "user.id:abc"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"llm.model": "gpt-4", "user.id": "abc"},
        )
        assert len(spans) == 1

    def test_no_attribute_filters_omits_param(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            query_string = parse_qs(urlparse(str(request.url)).query)
            assert "attribute" not in query_string
            return httpx.Response(
                200,
                json={"data": [_make_span()], "next_cursor": None},
            )

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        spans = Spans(client).get_spans(project_identifier="my-project")
        assert len(spans) == 1

    def test_attribute_filters_combined_with_other_filters(self) -> None:
        transport = _make_handler(
            expected_params={
                "span_kind": ["LLM"],
                "attribute": ["llm.model:gpt-4"],
            }
        )
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            span_kind="LLM",
            attributes={"llm.model": "gpt-4"},
        )
        assert len(spans) == 1

    def test_int_value_serialized_bare(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["count:42"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"count": 42},
        )
        assert len(spans) == 1

    def test_float_value_serialized_bare(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["score:3.14"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"score": 3.14},
        )
        assert len(spans) == 1

    def test_bool_true_serialized_lowercase(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["cached:true"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"cached": True},
        )
        assert len(spans) == 1

    def test_bool_false_serialized_lowercase(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["cached:false"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"cached": False},
        )
        assert len(spans) == 1

    def test_string_true_value_quoted_on_wire(self) -> None:
        transport = _make_handler(expected_params={"attribute": ['cached:"true"']})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"cached": "true"},
        )
        assert len(spans) == 1

    def test_string_numeric_value_quoted_on_wire(self) -> None:
        transport = _make_handler(expected_params={"attribute": ['count:"42"']})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"count": "42"},
        )
        assert len(spans) == 1

    def test_empty_string_value_quoted_on_wire(self) -> None:
        transport = _make_handler(expected_params={"attribute": ['model:""']})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"model": ""},
        )
        assert len(spans) == 1

    def test_plain_string_value_unquoted(self) -> None:
        transport = _make_handler(expected_params={"attribute": ["model:gpt-4"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        spans = Spans(client).get_spans(
            project_identifier="my-project",
            attributes={"model": "gpt-4"},
        )
        assert len(spans) == 1

    def test_non_finite_float_raises_value_error(self) -> None:
        import math

        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(ValueError):
            Spans(client).get_spans(
                project_identifier="my-project",
                attributes={"score": float("nan")},
            )
        with pytest.raises(ValueError):
            Spans(client).get_spans(
                project_identifier="my-project",
                attributes={"score": math.inf},
            )

    def test_non_scalar_value_raises_type_error(self) -> None:
        client = httpx.Client(
            transport=httpx.MockTransport(lambda r: httpx.Response(200)), base_url="http://test"
        )
        with pytest.raises(TypeError):
            Spans(client).get_spans(
                project_identifier="my-project",
                attributes={"tags": ["a", "b"]},  # type: ignore[dict-item]
            )


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

    @pytest.mark.anyio
    async def test_attribute_filter_wired_through_async_client(self) -> None:
        """Async client routes the `attributes` kwarg through the shared
        `_serialize_attributes` helper — serialization cases live in
        the sync suite; this test just pins async wiring."""
        transport = _make_handler(expected_params={"attribute": ["llm.model:gpt-4"]})
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        spans = await AsyncSpans(client).get_spans(
            project_identifier="my-project",
            attributes={"llm.model": "gpt-4"},
        )
        assert len(spans) == 1


class _GuardSentinel(Exception):
    """Distinctive exception to pin the guard call-site for `attributes`."""


def test_get_spans_with_attributes_calls_guard_before_request() -> None:
    from phoenix.client.constants.server_requirements import GET_SPANS_BY_ATTRIBUTE

    class _Guard:
        def require(self, requirement: object) -> None:
            if requirement is GET_SPANS_BY_ATTRIBUTE:
                raise _GuardSentinel

    transport = httpx.MockTransport(lambda r: pytest.fail("transport must not be reached"))
    client = httpx.Client(transport=transport, base_url="http://test")
    with pytest.raises(_GuardSentinel):
        Spans(client, _guard=_Guard()).get_spans(  # type: ignore[arg-type]
            project_identifier="my-project", attributes={"k": "v"}
        )


@pytest.mark.anyio
async def test_async_get_spans_with_attributes_calls_guard_before_request() -> None:
    from phoenix.client.constants.server_requirements import GET_SPANS_BY_ATTRIBUTE

    class _Guard:
        async def require(self, requirement: object) -> None:
            if requirement is GET_SPANS_BY_ATTRIBUTE:
                raise _GuardSentinel

    transport = httpx.MockTransport(lambda r: pytest.fail("transport must not be reached"))
    client = httpx.AsyncClient(transport=transport, base_url="http://test")
    with pytest.raises(_GuardSentinel):
        await AsyncSpans(client, _guard=_Guard()).get_spans(  # type: ignore[arg-type]
            project_identifier="my-project", attributes={"k": "v"}
        )
