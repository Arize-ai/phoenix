from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from phoenix.client.__generated__ import v1
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
