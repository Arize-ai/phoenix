from datetime import datetime, timedelta, timezone
from typing import Any, NamedTuple

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace, _node


class _Data(NamedTuple):
    spans: list[models.Span]
    traces: list[models.Trace]
    project_sessions: list[models.ProjectSession]
    projects: list[models.Project]


class TestProjectSession:
    @staticmethod
    async def _node(
        field: str,
        project_session: models.ProjectSession,
        httpx_client: httpx.AsyncClient,
    ) -> Any:
        return await _node(
            field,
            ProjectSession.__name__,
            project_session.id,
            httpx_client,
        )

    @pytest.fixture
    async def _data(
        self,
        db: DbSessionFactory,
    ) -> _Data:
        project_sessions = []
        traces = []
        spans = []
        async with db() as session:
            project = await _add_project(session)
            start_time = datetime.now(timezone.utc)
            project_sessions.append(
                await _add_project_session(
                    session,
                    project,
                    start_time=start_time,
                )
            )
            traces.append(
                await _add_trace(
                    session,
                    project,
                    project_sessions[-1],
                    start_time=start_time,
                )
            )
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes={"input": {"value": "123"}, "output": {"value": "321"}},
                    cumulative_llm_token_count_prompt=1,
                    cumulative_llm_token_count_completion=2,
                    cumulative_error_count=2,
                )
            )
            traces.append(
                await _add_trace(
                    session,
                    project,
                    project_sessions[-1],
                    start_time=start_time + timedelta(seconds=1),
                )
            )
            spans.append(
                await _add_span(
                    session,
                    traces[-1],
                    attributes={"input": {"value": "1234"}, "output": {"value": "4321"}},
                    cumulative_llm_token_count_prompt=3,
                    cumulative_llm_token_count_completion=4,
                )
            )
            project_sessions.append(await _add_project_session(session, project))
        return _Data(
            spans=spans,
            traces=traces,
            project_sessions=project_sessions,
            projects=[project],
        )

    async def test_num_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "numTraces"
        assert await self._node(field, project_session, httpx_client) == 2

    async def test_num_traces_with_error(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "numTracesWithError"
        assert await self._node(field, project_session, httpx_client) == 1

    async def test_first_input(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "firstInput{value mimeType}"
        assert await self._node(field, project_session, httpx_client) == {
            "value": "123",
            "mimeType": "text",
        }

    async def test_last_output(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "lastOutput{value mimeType}"
        assert await self._node(field, project_session, httpx_client) == {
            "value": "4321",
            "mimeType": "text",
        }

    async def test_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_session = _data.project_sessions[0]
        field = "traces{edges{node{id traceId}}}"
        traces = await self._node(field, project_session, httpx_client)
        assert traces["edges"]
        assert {(edge["node"]["id"], edge["node"]["traceId"]) for edge in traces["edges"]} == {
            (str(GlobalID(Trace.__name__, str(trace.id))), trace.trace_id) for trace in _data.traces
        }

    async def test_token_usage(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_sessions = _data.project_sessions
        field = "tokenUsage{prompt completion total}"
        assert await self._node(field, project_sessions[0], httpx_client) == {
            "prompt": 4,
            "completion": 6,
            "total": 10,
        }

    async def test_trace_latency_ms_quantile(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        project_sessions = _data.project_sessions
        field = "traceLatencyMsQuantile(probability: 0.5)"
        assert await self._node(field, project_sessions[0], httpx_client) == 10000.0
