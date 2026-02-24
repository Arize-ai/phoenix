from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_hex
from typing import Any

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.types import DbSessionFactory


class TestGetSession:
    async def test_get_session_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db)
        session_global_id = str(GlobalID(ProjectSessionNodeType.__name__, str(session_model.id)))

        response = await httpx_client.get(f"v1/sessions/{session_global_id}")
        assert response.status_code == 200

        data = response.json()["data"]
        _assert_session_data(data, project, session_model, traces)

    async def test_get_session_by_session_id_string(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db)

        response = await httpx_client.get(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 200

        data = response.json()["data"]
        _assert_session_data(data, project, session_model, traces)

    async def test_get_session_traces_ordered_by_start_time(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db, num_traces=5)

        response = await httpx_client.get(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 200

        response_traces = response.json()["data"]["traces"]
        assert len(response_traces) == 5
        start_times = [t["start_time"] for t in response_traces]
        assert start_times == sorted(start_times)

    async def test_get_session_with_no_traces(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, session_model, _ = await _insert_session_with_traces(db, num_traces=0)

        response = await httpx_client.get(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 200

        data = response.json()["data"]
        assert data["traces"] == []

    async def test_get_session_not_found_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        fake_id = str(GlobalID(ProjectSessionNodeType.__name__, "999999"))
        response = await httpx_client.get(f"v1/sessions/{fake_id}")
        assert response.status_code == 404

    async def test_get_session_not_found_by_session_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.get(f"v1/sessions/{token_hex(16)}")
        assert response.status_code == 404


class TestListProjectSessions:
    async def test_list_sessions_for_project_by_name(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=3)

        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 3
        assert data["next_cursor"] is None

        # Sessions should be ordered by id DESC
        returned_ids = [s["id"] for s in data["data"]]
        decoded_ids = [
            from_global_id_with_expected_type(
                GlobalID.from_id(gid), ProjectSessionNodeType.__name__
            )
            for gid in returned_ids
        ]
        assert decoded_ids == sorted(decoded_ids, reverse=True)

    async def test_list_sessions_for_project_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=2)
        project_global_id = str(GlobalID(ProjectNodeType.__name__, str(project.id)))

        response = await httpx_client.get(f"v1/projects/{project_global_id}/sessions")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 2

    async def test_list_sessions_includes_traces(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(
            db, num_sessions=2, num_traces_per_session=3
        )

        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200

        data = response.json()
        for session_data in data["data"]:
            assert len(session_data["traces"]) == 3
            # Traces should be ordered by start_time ASC
            start_times = [t["start_time"] for t in session_data["traces"]]
            assert start_times == sorted(start_times)

    async def test_list_sessions_pagination(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _ = await _insert_project_with_sessions(db, num_sessions=5)

        # First page
        response = await httpx_client.get(
            f"v1/projects/{project.name}/sessions", params={"limit": 2}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["next_cursor"] is not None

        # Second page
        response = await httpx_client.get(
            f"v1/projects/{project.name}/sessions",
            params={"limit": 2, "cursor": data["next_cursor"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["next_cursor"] is not None

        # Third page (last)
        response = await httpx_client.get(
            f"v1/projects/{project.name}/sessions",
            params={"limit": 2, "cursor": data["next_cursor"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["next_cursor"] is None

    async def test_list_sessions_empty(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name=token_hex(16))
            session.add(project)
            await session.flush()

        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200

        data = response.json()
        assert data["data"] == []
        assert data["next_cursor"] is None

    async def test_list_sessions_invalid_cursor(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project = models.Project(name=token_hex(16))
            session.add(project)
            await session.flush()

        response = await httpx_client.get(
            f"v1/projects/{project.name}/sessions", params={"cursor": "invalid-cursor"}
        )
        assert response.status_code == 422
        assert "Invalid cursor format" in response.text

    async def test_list_sessions_project_not_found(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.get(f"v1/projects/{token_hex(16)}/sessions")
        assert response.status_code == 404

    async def test_list_sessions_only_returns_sessions_for_given_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project_a, sessions_a = await _insert_project_with_sessions(db, num_sessions=2)
        project_b, sessions_b = await _insert_project_with_sessions(db, num_sessions=3)

        response_a = await httpx_client.get(f"v1/projects/{project_a.name}/sessions")
        assert response_a.status_code == 200
        assert len(response_a.json()["data"]) == 2

        response_b = await httpx_client.get(f"v1/projects/{project_b.name}/sessions")
        assert response_b.status_code == 200
        assert len(response_b.json()["data"]) == 3


def _assert_session_data(
    data: dict[str, Any],
    project: models.Project,
    session_model: models.ProjectSession,
    traces: list[models.Trace],
) -> None:
    session_id = from_global_id_with_expected_type(
        GlobalID.from_id(data["id"]), ProjectSessionNodeType.__name__
    )
    assert session_id == session_model.id
    assert data["session_id"] == session_model.session_id

    project_id = from_global_id_with_expected_type(
        GlobalID.from_id(data["project_id"]), ProjectNodeType.__name__
    )
    assert project_id == project.id

    assert len(data["traces"]) == len(traces)
    for trace_data, trace_model in zip(data["traces"], traces):
        trace_id = from_global_id_with_expected_type(
            GlobalID.from_id(trace_data["id"]), TraceNodeType.__name__
        )
        assert trace_id == trace_model.id
        assert trace_data["trace_id"] == trace_model.trace_id


async def _insert_session_with_traces(
    db: DbSessionFactory,
    num_traces: int = 3,
) -> tuple[models.Project, models.ProjectSession, list[models.Trace]]:
    async with db() as session:
        project = models.Project(name=token_hex(16))
        session.add(project)
        await session.flush()

        now = datetime.now(timezone.utc)
        project_session = models.ProjectSession(
            session_id=token_hex(16),
            project_id=project.id,
            start_time=now,
            end_time=now,
        )
        session.add(project_session)
        await session.flush()

        traces = []
        for i in range(num_traces):
            start = datetime(2024, 1, 1, i, 0, 0, tzinfo=timezone.utc)
            end = datetime(2024, 1, 1, i, 30, 0, tzinfo=timezone.utc)
            trace = models.Trace(
                project_rowid=project.id,
                project_session_rowid=project_session.id,
                trace_id=token_hex(16),
                start_time=start,
                end_time=end,
            )
            session.add(trace)
            traces.append(trace)
        await session.flush()

    return project, project_session, traces


async def _insert_project_with_sessions(
    db: DbSessionFactory,
    num_sessions: int = 3,
    num_traces_per_session: int = 2,
) -> tuple[models.Project, list[tuple[models.ProjectSession, list[models.Trace]]]]:
    async with db() as session:
        project = models.Project(name=token_hex(16))
        session.add(project)
        await session.flush()

        results: list[tuple[models.ProjectSession, list[models.Trace]]] = []
        for s_idx in range(num_sessions):
            now = datetime.now(timezone.utc)
            project_session = models.ProjectSession(
                session_id=token_hex(16),
                project_id=project.id,
                start_time=now,
                end_time=now,
            )
            session.add(project_session)
            await session.flush()

            traces = []
            for t_idx in range(num_traces_per_session):
                start = datetime(2024, 1, 1, t_idx, 0, 0, tzinfo=timezone.utc)
                end = datetime(2024, 1, 1, t_idx, 30, 0, tzinfo=timezone.utc)
                trace = models.Trace(
                    project_rowid=project.id,
                    project_session_rowid=project_session.id,
                    trace_id=token_hex(16),
                    start_time=start,
                    end_time=end,
                )
                session.add(trace)
                traces.append(trace)
            await session.flush()
            results.append((project_session, traces))

    return project, results
