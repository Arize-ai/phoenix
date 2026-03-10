from __future__ import annotations

from datetime import datetime, timezone
from secrets import token_hex
from typing import Any

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.routers.v1.sessions import _parse_session_global_id
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.types import DbSessionFactory


class TestParseSessionGlobalId:
    def test_returns_row_id_for_valid_global_id(self) -> None:
        global_id = str(GlobalID(ProjectSessionNodeType.__name__, "42"))
        assert _parse_session_global_id(global_id) == 42

    def test_returns_none_for_plain_session_id(self) -> None:
        assert _parse_session_global_id("my-session-abc123") is None

    def test_returns_none_for_wrong_type_global_id(self) -> None:
        wrong_type_id = str(GlobalID("WrongType", "42"))
        assert _parse_session_global_id(wrong_type_id) is None

    def test_returns_none_for_empty_string(self) -> None:
        assert _parse_session_global_id("") is None


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


class TestDeleteSession:
    async def test_delete_session_by_session_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db)

        response = await httpx_client.delete(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 204

        # Verify session is deleted
        response = await httpx_client.get(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 404

    async def test_delete_session_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db)
        session_global_id = str(GlobalID(ProjectSessionNodeType.__name__, str(session_model.id)))

        response = await httpx_client.delete(f"v1/sessions/{session_global_id}")
        assert response.status_code == 204

        # Verify session is deleted
        response = await httpx_client.get(f"v1/sessions/{session_global_id}")
        assert response.status_code == 404

    async def test_delete_session_not_found(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.delete(f"v1/sessions/{token_hex(16)}")
        assert response.status_code == 404

    async def test_delete_session_cascades_traces(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, session_model, traces = await _insert_session_with_traces(db, num_traces=3)
        trace_ids = [t.trace_id for t in traces]

        response = await httpx_client.delete(f"v1/sessions/{session_model.session_id}")
        assert response.status_code == 204

        # Verify traces are also deleted via cascade
        async with db() as session:
            from sqlalchemy import select as sa_select

            remaining = (
                await session.scalars(
                    sa_select(models.Trace).where(models.Trace.trace_id.in_(trace_ids))
                )
            ).all()
            assert len(remaining) == 0


class TestDeleteSessions:
    async def test_bulk_delete_sessions(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=3)
        session_ids = [s.session_id for s, _ in sessions_with_traces]

        response = await httpx_client.post(
            "v1/sessions/delete", json={"session_identifiers": session_ids}
        )
        assert response.status_code == 204

        # Verify all sessions are deleted
        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200
        assert len(response.json()["data"]) == 0

    async def test_bulk_delete_partial_match(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=2)
        real_id = sessions_with_traces[0][0].session_id
        fake_id = token_hex(16)

        response = await httpx_client.post(
            "v1/sessions/delete", json={"session_identifiers": [real_id, fake_id]}
        )
        assert response.status_code == 204

        # Only one session should remain
        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200
        assert len(response.json()["data"]) == 1

    async def test_bulk_delete_by_global_ids(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=3)
        global_ids = [
            str(GlobalID(ProjectSessionNodeType.__name__, str(s.id)))
            for s, _ in sessions_with_traces
        ]

        response = await httpx_client.post(
            "v1/sessions/delete", json={"session_identifiers": global_ids}
        )
        assert response.status_code == 204

        # Verify all sessions are deleted
        response = await httpx_client.get(f"v1/projects/{project.name}/sessions")
        assert response.status_code == 200
        assert len(response.json()["data"]) == 0

    async def test_bulk_delete_mixed_identifiers_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, sessions_with_traces = await _insert_project_with_sessions(db, num_sessions=2)
        global_id = str(
            GlobalID(ProjectSessionNodeType.__name__, str(sessions_with_traces[0][0].id))
        )
        session_id = sessions_with_traces[1][0].session_id

        response = await httpx_client.post(
            "v1/sessions/delete", json={"session_identifiers": [global_id, session_id]}
        )
        assert response.status_code == 422
        assert "same type" in response.text

    async def test_bulk_delete_empty_list(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.post("v1/sessions/delete", json={"session_identifiers": []})
        assert response.status_code == 422


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

        # Sessions should be ordered by id ASC by default
        returned_ids = [s["id"] for s in data["data"]]
        decoded_ids = [
            from_global_id_with_expected_type(
                GlobalID.from_id(gid), ProjectSessionNodeType.__name__
            )
            for gid in returned_ids
        ]
        assert decoded_ids == sorted(decoded_ids)

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
