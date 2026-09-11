# pyright: reportPrivateUsage=false
from __future__ import annotations

from typing import Sequence

import httpx
import pytest
from phoenix.client import AsyncClient
from phoenix.client import Client as SyncClient

from .._helpers import _AppInfo, _await_or_return, _ExistingSpan


class TestClientForSessionsRetrieval:
    """Integration tests for the sessions list method."""

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_filter_selects_matching_session(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        trace = _existing_spans[0].trace
        assert trace.session is not None

        Client = AsyncClient if is_async else SyncClient

        sessions = await _await_or_return(
            Client(base_url=_app.base_url, api_key=_app.admin_secret).sessions.list(
                project_name=trace.project.name,
                filter=f'session_id == "{trace.session.session_id}"',
            )
        )
        assert [s["session_id"] for s in sessions] == [trace.session.session_id]

    @pytest.mark.parametrize("is_async", [True, False])
    async def test_invalid_filter_raises_400(
        self,
        is_async: bool,
        _existing_spans: Sequence[_ExistingSpan],
        _app: _AppInfo,
    ) -> None:
        project_name = _existing_spans[0].trace.project.name

        Client = AsyncClient if is_async else SyncClient

        with pytest.raises(httpx.HTTPStatusError) as error:
            await _await_or_return(
                Client(base_url=_app.base_url, api_key=_app.admin_secret).sessions.list(
                    project_name=project_name,
                    filter="unknown_field > 0",
                )
            )
        assert error.value.response.status_code == 400
