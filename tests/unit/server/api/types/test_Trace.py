from typing import Any, NamedTuple

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Span import Span
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace, _node


class _Data(NamedTuple):
    spans: list[models.Span]
    traces: list[models.Trace]
    project_sessions: list[models.ProjectSession]
    projects: list[models.Project]


class TestTrace:
    @staticmethod
    async def _node(
        field: str,
        trace: models.Trace,
        httpx_client: httpx.AsyncClient,
    ) -> Any:
        return await _node(
            field,
            Trace.__name__,
            trace.id,
            httpx_client,
        )

    @pytest.fixture
    async def _data(self, db: DbSessionFactory) -> _Data:
        traces = []
        spans = []
        async with db() as session:
            project = await _add_project(session)
            project_session = await _add_project_session(session, project)
            traces.append(await _add_trace(session, project))
            traces.append(await _add_trace(session, project, project_session))
            spans.append(await _add_span(session, traces[-1]))
            spans.append(await _add_span(session, traces[-1], parent_span=spans[-1]))
        return _Data(
            spans=spans,
            traces=traces,
            project_sessions=[project_session],
            projects=[project],
        )

    async def test_session(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = _data.traces
        project_session = _data.project_sessions[0]
        field = "session{id sessionId}"
        assert await self._node(field, traces[0], httpx_client) is None
        assert await self._node(field, traces[1], httpx_client) == {
            "id": str(GlobalID(ProjectSession.__name__, str(project_session.id))),
            "sessionId": project_session.session_id,
        }

    async def test_root_span(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = _data.traces
        span = _data.spans[0]
        field = "rootSpan{id name}"
        assert await self._node(field, traces[0], httpx_client) is None
        assert await self._node(field, traces[1], httpx_client) == {
            "id": str(GlobalID(Span.__name__, str(span.id))),
            "name": span.name,
        }
