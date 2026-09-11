from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.exceptions import PhoenixException
from phoenix.client.resources.traces import AsyncTraces, Traces


def _make_trace(
    *,
    trace_id: str = "abc123",
    project_id: str = "UHJvamVjdDox",
) -> v1.TraceData:
    return v1.TraceData(
        id="VHJhY2U6MQ==",
        trace_id=trace_id,
        project_id=project_id,
        start_time="2024-01-01T00:00:00Z",
        end_time="2024-01-01T00:01:00Z",
    )


def _make_handler(
    expected_params: dict[str, list[str]] | None = None,
    pages: int = 1,
) -> httpx.MockTransport:
    call_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        assert "/v1/projects/" in str(request.url)
        assert "/traces" in str(request.url)

        if expected_params:
            query_string = parse_qs(urlparse(str(request.url)).query)
            for key, values in expected_params.items():
                assert key in query_string, (
                    f"Expected query param '{key}' not found in {query_string}"
                )
                assert sorted(query_string[key]) == sorted(values)

        call_count += 1
        next_cursor = "VHJhY2U6Mg==" if call_count < pages else None
        return httpx.Response(
            200,
            json={"data": [_make_trace()], "next_cursor": next_cursor},
        )

    return httpx.MockTransport(handler)


class TestGetTraces:
    def test_basic_get_traces(self) -> None:
        transport = _make_handler()
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(project_identifier="my-project")
        assert len(traces) == 1
        assert traces[0]["trace_id"] == "abc123"

    def test_time_range_params(self) -> None:
        transport = _make_handler(
            expected_params={
                "start_time": ["2024-01-01T00:00:00"],
                "end_time": ["2024-01-02T00:00:00"],
            }
        )
        client = httpx.Client(transport=transport, base_url="http://test")
        from datetime import datetime

        traces = Traces(client).get_traces(
            project_identifier="my-project",
            start_time=datetime(2024, 1, 1),
            end_time=datetime(2024, 1, 2),
        )
        assert len(traces) == 1

    def test_sort_and_order_params(self) -> None:
        transport = _make_handler(expected_params={"sort": ["latency_ms"], "order": ["asc"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            sort="latency_ms",
            order="asc",
        )
        assert len(traces) == 1

    def test_include_spans_param(self) -> None:
        transport = _make_handler(expected_params={"include_spans": ["true"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            include_spans=True,
        )
        assert len(traces) == 1

    def test_session_id_multiple(self) -> None:
        transport = _make_handler(expected_params={"session_identifier": ["sess-1", "sess-2"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            session_id=["sess-1", "sess-2"],
        )
        assert len(traces) == 1

    def test_session_id_single_string(self) -> None:
        transport = _make_handler(expected_params={"session_identifier": ["sess-1"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            session_id="sess-1",
        )
        assert len(traces) == 1

    def test_error_true_param(self) -> None:
        transport = _make_handler(expected_params={"error": ["true"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            error=True,
        )
        assert len(traces) == 1

    def test_error_false_is_sent(self) -> None:
        # `error=False` selects traces with no errored spans, so it must reach the
        # server rather than being dropped as a falsy value.
        transport = _make_handler(expected_params={"error": ["false"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            error=False,
        )
        assert len(traces) == 1

    def test_error_omitted_by_default(self) -> None:
        received: dict[str, list[str]] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            received.update(parse_qs(urlparse(str(request.url)).query))
            return httpx.Response(200, json={"data": [_make_trace()], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        Traces(client).get_traces(project_identifier="my-project")
        assert "error" not in received
        assert "min_latency_ms" not in received
        assert "max_latency_ms" not in received

    def test_latency_params(self) -> None:
        transport = _make_handler(
            expected_params={"min_latency_ms": ["100.0"], "max_latency_ms": ["5000.0"]}
        )
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            min_latency_ms=100.0,
            max_latency_ms=5000.0,
        )
        assert len(traces) == 1

    def test_zero_min_latency_is_sent(self) -> None:
        transport = _make_handler(expected_params={"min_latency_ms": ["0.0"]})
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            min_latency_ms=0.0,
        )
        assert len(traces) == 1

    @pytest.mark.parametrize(
        "min_latency_ms,max_latency_ms",
        [
            pytest.param(-1.0, None, id="negative-min"),
            pytest.param(None, -1.0, id="negative-max"),
            pytest.param(500.0, 100.0, id="min-exceeds-max"),
        ],
    )
    def test_invalid_latency_bounds_rejected(
        self,
        min_latency_ms: float | None,
        max_latency_ms: float | None,
    ) -> None:
        transport = _make_handler()
        client = httpx.Client(transport=transport, base_url="http://test")
        with pytest.raises(ValueError):
            Traces(client).get_traces(
                project_identifier="my-project",
                min_latency_ms=min_latency_ms,
                max_latency_ms=max_latency_ms,
            )

    def test_filters_persist_across_pages(self) -> None:
        transport = _make_handler(
            expected_params={"error": ["true"], "min_latency_ms": ["100.0"]},
            pages=3,
        )
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            error=True,
            min_latency_ms=100.0,
            limit=300,
        )
        assert len(traces) == 3

    def test_pagination(self) -> None:
        transport = _make_handler(pages=3)
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            limit=300,
        )
        assert len(traces) == 3

    def test_limit_respected(self) -> None:
        transport = _make_handler(pages=5)
        client = httpx.Client(transport=transport, base_url="http://test")
        traces = Traces(client).get_traces(
            project_identifier="my-project",
            limit=2,
        )
        assert len(traces) == 2


class TestAsyncGetTraces:
    @pytest.mark.anyio
    async def test_basic_get_traces(self) -> None:
        transport = _make_handler()
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        traces = await AsyncTraces(client).get_traces(project_identifier="my-project")
        assert len(traces) == 1
        assert traces[0]["trace_id"] == "abc123"

    @pytest.mark.anyio
    async def test_pagination(self) -> None:
        transport = _make_handler(pages=3)
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        traces = await AsyncTraces(client).get_traces(
            project_identifier="my-project",
            limit=300,
        )
        assert len(traces) == 3

    @pytest.mark.anyio
    async def test_error_and_latency_params(self) -> None:
        transport = _make_handler(
            expected_params={
                "error": ["false"],
                "min_latency_ms": ["100.0"],
                "max_latency_ms": ["5000.0"],
            }
        )
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        traces = await AsyncTraces(client).get_traces(
            project_identifier="my-project",
            error=False,
            min_latency_ms=100.0,
            max_latency_ms=5000.0,
        )
        assert len(traces) == 1

    @pytest.mark.anyio
    async def test_invalid_latency_bounds_rejected(self) -> None:
        transport = _make_handler()
        client = httpx.AsyncClient(transport=transport, base_url="http://test")
        with pytest.raises(ValueError):
            await AsyncTraces(client).get_traces(
                project_identifier="my-project",
                min_latency_ms=500.0,
                max_latency_ms=100.0,
            )


FILTER_EXPRESSION = 'any(span.name == "café & search" for span in spans)'


async def _get_traces(
    transport: httpx.MockTransport, is_async: bool, **kwargs: object
) -> list[v1.TraceData]:
    if is_async:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await AsyncTraces(client).get_traces(project_identifier="project", **kwargs)  # type: ignore[arg-type]
    with httpx.Client(transport=transport, base_url="http://test") as sync_client:
        return Traces(sync_client).get_traces(project_identifier="project", **kwargs)  # type: ignore[arg-type]


@pytest.mark.real_server_version_check
@pytest.mark.parametrize("is_async", [False, True])
class TestGetTracesFilterExpression:
    async def test_filter_preserved_on_every_page(self, is_async: bool) -> None:
        cursors: list[str | None] = []

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/arize_phoenix_version":
                return httpx.Response(200, text="20.10.0")
            assert request.url.params["filter"] == FILTER_EXPRESSION
            cursors.append(request.url.params.get("cursor"))
            return httpx.Response(
                200,
                json={
                    "data": [_make_trace()],
                    "next_cursor": "second-page" if len(cursors) == 1 else None,
                },
            )

        traces = await _get_traces(
            httpx.MockTransport(handler), is_async, filter=FILTER_EXPRESSION, limit=2
        )
        assert len(traces) == 2
        assert cursors == [None, "second-page"]

    async def test_filter_rejects_old_server_before_listing(self, is_async: bool) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/arize_phoenix_version"
            return httpx.Response(200, text="20.9.0")

        with pytest.raises(PhoenixException, match=r"'filter'.*requires Phoenix >= 20\.10\.0"):
            await _get_traces(httpx.MockTransport(handler), is_async, filter=FILTER_EXPRESSION)

    @pytest.mark.parametrize("filter", [None, ""])
    async def test_no_filter_preserves_old_server_support(
        self, is_async: bool, filter: str | None
    ) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/arize_phoenix_version":
                return httpx.Response(200, text="14.0.0")
            assert "filter" not in request.url.params
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        assert await _get_traces(httpx.MockTransport(handler), is_async, filter=filter) == []

    async def test_filter_error_preserves_server_message(self, is_async: bool) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/arize_phoenix_version":
                return httpx.Response(200, text="20.10.0")
            assert request.url.params["filter"] == "unknown_field > 0"
            return httpx.Response(400, text="invalid name `unknown_field`")

        with pytest.raises(httpx.HTTPStatusError) as error:
            await _get_traces(httpx.MockTransport(handler), is_async, filter="unknown_field > 0")
        assert error.value.response.status_code == 400
        assert error.value.response.text == "invalid name `unknown_field`"

    async def test_legacy_filters_keep_their_server_requirement(self, is_async: bool) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/arize_phoenix_version":
                return httpx.Response(200, text="20.8.0")
            assert request.url.params["error"] == "false"
            assert request.url.params["min_latency_ms"] == "0"
            assert request.url.params["max_latency_ms"] == "500"
            assert "filter" not in request.url.params
            return httpx.Response(200, json={"data": [], "next_cursor": None})

        traces = await _get_traces(
            httpx.MockTransport(handler),
            is_async,
            error=False,
            min_latency_ms=0,
            max_latency_ms=500,
        )
        assert traces == []
