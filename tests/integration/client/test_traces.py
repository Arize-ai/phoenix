# pyright: reportPrivateUsage=false
from __future__ import annotations

from typing import Sequence

import httpx
import pytest

from .._helpers import _AppInfo, _await_or_return, _ExistingSpan


class TestClientForTracesRetrieval:
    """Integration tests for the get_traces method."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_filter_selects_matching_trace(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        trace = _existing_spans[0].trace

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        traces = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).traces.get_traces(
                project_identifier=trace.project.name,
                filter=f'trace_id == "{trace.trace_id}"',
            )
        )
        assert [t["trace_id"] for t in traces] == [trace.trace_id]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_invalid_filter_raises_400(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        project_name = _existing_spans[0].trace.project.name

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        with pytest.raises(httpx.HTTPStatusError) as error:
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=_app.admin_secret).traces.get_traces(
                    project_identifier=project_name,
                    filter="unknown_field > 0",
                )
            )
        assert error.value.response.status_code == 400
