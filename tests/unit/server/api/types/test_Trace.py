from typing import Any

import httpx
import pytest
from strawberry.relay import GlobalID
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Trace import Trace
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_trace, _node

_Data: TypeAlias = tuple[
    list[models.Trace],
    list[models.ProjectSession],
    list[models.Project],
]


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
        async with db() as session:
            project = await _add_project(session)
            project_session = await _add_project_session(session, project)
            traces.append(await _add_trace(session, project))
            traces.append(await _add_trace(session, project, project_session))
        return traces, [project_session], [project]

    async def test_session(
        self,
        _data: _Data,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        traces = _data[0]
        project_session = _data[1][0]
        assert await self._node("session{id}", traces[0], httpx_client) is None
        assert await self._node("session{id}", traces[1], httpx_client) == {
            "id": str(GlobalID(ProjectSession.__name__, str(project_session.id)))
        }
