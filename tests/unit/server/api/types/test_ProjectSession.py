from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import pytest
from faker import Faker
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory

from ._helpers import _add_project, _add_project_session, _add_span, _add_trace, _node

_Data: TypeAlias = tuple[
    list[models.ProjectSession],
    list[models.Trace],
    list[models.Project],
]


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
        fake: Faker,
    ) -> _Data:
        project_sessions = []
        traces = []
        async with db() as session:
            project = await _add_project(session)
            start_time = datetime.now(timezone.utc)
            project_sessions.append(
                await _add_project_session(
                    session,
                    project,
                    session_user="xyz",
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
            await _add_span(
                session,
                traces[-1],
                attributes={"input": {"value": "123"}, "output": {"value": "321"}},
                cumulative_llm_token_count_prompt=1,
                cumulative_llm_token_count_completion=2,
            )
            traces.append(
                await _add_trace(
                    session,
                    project,
                    project_sessions[-1],
                    start_time=start_time + timedelta(seconds=1),
                )
            )
            await _add_span(
                session,
                traces[-1],
                attributes={"input": {"value": "1234"}, "output": {"value": "4321"}},
                cumulative_llm_token_count_prompt=3,
                cumulative_llm_token_count_completion=4,
            )
            project_sessions.append(await _add_project_session(session, project))
        return project_sessions, traces, [project]

    async def test_session_user(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        assert await self._node("sessionUser", _data[0][0], httpx_client) == "xyz"
        assert await self._node("sessionUser", _data[0][1], httpx_client) is None

    async def test_num_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        assert await self._node("numTraces", _data[0][0], httpx_client) == 2

    async def test_first_input(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        assert await self._node(
            "firstInput{value mimeType}",
            _data[0][0],
            httpx_client,
        ) == {"value": "123", "mimeType": "text"}

    async def test_last_output(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        assert await self._node(
            "lastOutput{value mimeType}",
            _data[0][0],
            httpx_client,
        ) == {"value": "4321", "mimeType": "text"}

    async def test_traces(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = await self._node("traces{edges{node{id}}}", _data[0][0], httpx_client)
        assert {edge["node"]["id"] for edge in traces["edges"]} == {
            str(GlobalID(Trace.__name__, str(trace.id))) for trace in _data[1]
        }

    async def test_token_usage(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        assert await self._node(
            "tokenUsage{prompt completion total}",
            _data[0][0],
            httpx_client,
        ) == {"prompt": 4, "completion": 6, "total": 10}
