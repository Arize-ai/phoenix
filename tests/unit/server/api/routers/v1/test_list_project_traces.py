from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Optional

import httpx
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.ProjectSession import ProjectSession as ProjectSessionNodeType
from phoenix.server.api.types.Span import Span as SpanNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.types import DbSessionFactory


async def _insert_project_with_traces(
    db: DbSessionFactory,
    num_traces: int = 3,
    num_spans_per_trace: int = 2,
    session_identifiers: Optional[list[str]] = None,
) -> tuple[models.Project, list[models.Trace], list[models.Span], list[models.ProjectSession]]:
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
        )
        assert project_row_id is not None

        # Create sessions if requested
        all_sessions: list[models.ProjectSession] = []
        if session_identifiers:
            base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
            for s_id in session_identifiers:
                session_row_id = await session.scalar(
                    insert(models.ProjectSession)
                    .values(
                        session_id=s_id,
                        project_id=project_row_id,
                        start_time=base_time,
                        end_time=base_time + timedelta(hours=10),
                    )
                    .returning(models.ProjectSession.id)
                )
                assert session_row_id is not None
                ps = await session.get(models.ProjectSession, session_row_id)
                assert ps is not None
                all_sessions.append(ps)

        base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
        all_traces: list[models.Trace] = []
        all_spans: list[models.Span] = []

        for t_idx in range(num_traces):
            trace_start = base_time + timedelta(hours=t_idx)
            trace_end = trace_start + timedelta(minutes=30 + t_idx * 10)

            # Assign sessions round-robin if available
            project_session_rowid = None
            if all_sessions:
                project_session_rowid = all_sessions[t_idx % len(all_sessions)].id

            trace_row_id = await session.scalar(
                insert(models.Trace)
                .values(
                    trace_id=token_hex(16),
                    project_rowid=project_row_id,
                    project_session_rowid=project_session_rowid,
                    start_time=trace_start,
                    end_time=trace_end,
                )
                .returning(models.Trace.id)
            )
            assert trace_row_id is not None
            # Create a lightweight Trace object for assertions
            trace = models.Trace(
                id=trace_row_id,
                trace_id=(await session.get(models.Trace, trace_row_id)).trace_id,  # type: ignore[union-attr]
                project_rowid=project_row_id,
                project_session_rowid=project_session_rowid,
                start_time=trace_start,
                end_time=trace_end,
            )
            all_traces.append(trace)

            for s_idx in range(num_spans_per_trace):
                span_start = trace_start + timedelta(seconds=s_idx * 10)
                span_end = span_start + timedelta(seconds=5)
                span_row_id = await session.scalar(
                    insert(models.Span)
                    .values(
                        trace_rowid=trace_row_id,
                        span_id=token_hex(8),
                        parent_id=None if s_idx == 0 else token_hex(8),
                        name=f"span-{t_idx}-{s_idx}",
                        span_kind="LLM" if s_idx == 0 else "CHAIN",
                        start_time=span_start,
                        end_time=span_end,
                        attributes={},
                        events=[],
                        status_code="OK",
                        status_message="",
                        cumulative_error_count=0,
                        cumulative_llm_token_count_prompt=0,
                        cumulative_llm_token_count_completion=0,
                    )
                    .returning(models.Span.id)
                )
                span = models.Span(
                    id=span_row_id,
                    trace_rowid=trace_row_id,
                    span_id=(await session.get(models.Span, span_row_id)).span_id,  # type: ignore[union-attr]
                    name=f"span-{t_idx}-{s_idx}",
                    span_kind="LLM" if s_idx == 0 else "CHAIN",
                    start_time=span_start,
                    end_time=span_end,
                    status_code="OK",
                )
                all_spans.append(span)

        project = await session.get(models.Project, project_row_id)
        assert project is not None
    return project, all_traces, all_spans, all_sessions


class TestListProjectTraces:
    async def test_list_traces_basic(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=3)
        response = await httpx_client.get(f"v1/projects/{project.name}/traces")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 3
        assert data["next_cursor"] is None

    async def test_list_traces_by_project_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=2)
        project_global_id = str(GlobalID(ProjectNodeType.__name__, str(project.id)))

        response = await httpx_client.get(f"v1/projects/{project_global_id}/traces")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 2

    async def test_list_traces_response_fields(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=1)
        response = await httpx_client.get(f"v1/projects/{project.name}/traces")
        assert response.status_code == 200

        trace_data = response.json()["data"][0]
        # Verify trace GlobalID
        trace_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(trace_data["id"]), TraceNodeType.__name__
        )
        assert trace_rowid == traces[0].id

        # Verify project GlobalID
        project_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(trace_data["project_id"]), ProjectNodeType.__name__
        )
        assert project_rowid == project.id

        assert "trace_id" in trace_data
        assert "start_time" in trace_data
        assert "end_time" in trace_data

    async def test_list_traces_default_order_is_desc(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=3)

        response = await httpx_client.get(f"v1/projects/{project.name}/traces")
        assert response.status_code == 200

        data = response.json()
        returned_ids = [
            from_global_id_with_expected_type(GlobalID.from_id(t["id"]), TraceNodeType.__name__)
            for t in data["data"]
        ]
        assert returned_ids == sorted(returned_ids, reverse=True)

    async def test_list_traces_order_asc(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=3)

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces", params={"order": "asc"}
        )
        assert response.status_code == 200

        data = response.json()
        start_times = [t["start_time"] for t in data["data"]]
        assert start_times == sorted(start_times)

    async def test_list_traces_sort_by_latency(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=3)

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"sort": "latency_ms", "order": "desc"},
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 3

    async def test_list_traces_pagination(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=5)

        # First page
        response = await httpx_client.get(f"v1/projects/{project.name}/traces", params={"limit": 2})
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["next_cursor"] is not None

        # Second page
        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"limit": 2, "cursor": data["next_cursor"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["next_cursor"] is not None

        # Third page (last)
        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"limit": 2, "cursor": data["next_cursor"]},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["next_cursor"] is None

    async def test_list_traces_time_range_filter(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, _ = await _insert_project_with_traces(db, num_traces=5)

        # Filter to only include the second and third traces (hours 1 and 2)
        start = "2024-01-01T01:00:00Z"
        end = "2024-01-01T03:00:00Z"

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"start_time": start, "end_time": end},
        )
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 2

    async def test_list_traces_empty(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project_row_id = await session.scalar(
                insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
            )
            project = await session.get(models.Project, project_row_id)
            assert project is not None

        response = await httpx_client.get(f"v1/projects/{project.name}/traces")
        assert response.status_code == 200

        data = response.json()
        assert data["data"] == []
        assert data["next_cursor"] is None

    async def test_list_traces_invalid_cursor(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        async with db() as session:
            project_row_id = await session.scalar(
                insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
            )
            project = await session.get(models.Project, project_row_id)
            assert project is not None

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces", params={"cursor": "invalid-cursor"}
        )
        assert response.status_code == 422
        assert "Invalid cursor" in response.text

    async def test_list_traces_project_not_found(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.get(f"v1/projects/{token_hex(16)}/traces")
        assert response.status_code == 404

    async def test_list_traces_only_returns_traces_for_given_project(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project_a, _, _, _ = await _insert_project_with_traces(db, num_traces=2)
        project_b, _, _, _ = await _insert_project_with_traces(db, num_traces=3)

        response_a = await httpx_client.get(f"v1/projects/{project_a.name}/traces")
        assert response_a.status_code == 200
        assert len(response_a.json()["data"]) == 2

        response_b = await httpx_client.get(f"v1/projects/{project_b.name}/traces")
        assert response_b.status_code == 200
        assert len(response_b.json()["data"]) == 3

    async def test_list_traces_spans_excluded_by_default(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _, _, _ = await _insert_project_with_traces(
            db, num_traces=1, num_spans_per_trace=3
        )

        response = await httpx_client.get(f"v1/projects/{project.name}/traces")
        assert response.status_code == 200

        trace_data = response.json()["data"][0]
        assert trace_data["spans"] is None

    async def test_list_traces_include_spans(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _, _, _ = await _insert_project_with_traces(
            db, num_traces=2, num_spans_per_trace=3
        )

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces", params={"include_spans": True}
        )
        assert response.status_code == 200

        data = response.json()
        for trace_data in data["data"]:
            assert len(trace_data["spans"]) == 3
            # Spans should be ordered by start_time ASC
            start_times = [s["start_time"] for s in trace_data["spans"]]
            assert start_times == sorted(start_times)

    async def test_list_traces_include_spans_fields(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _, _, _ = await _insert_project_with_traces(
            db, num_traces=1, num_spans_per_trace=1
        )

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces", params={"include_spans": True}
        )
        assert response.status_code == 200

        span_data = response.json()["data"][0]["spans"][0]
        assert "id" in span_data
        assert "span_id" in span_data
        assert "parent_id" in span_data
        assert "name" in span_data
        assert "span_kind" in span_data
        assert "status_code" in span_data
        assert "start_time" in span_data
        assert "end_time" in span_data

        # Verify the span GlobalID is valid
        span_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(span_data["id"]), SpanNodeType.__name__
        )
        assert span_rowid > 0

    async def test_list_traces_filter_by_session_id_string(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        # 4 traces, 2 sessions: traces 0,2 -> sess-a, traces 1,3 -> sess-b
        project, traces, _, sessions = await _insert_project_with_traces(
            db, num_traces=4, session_identifiers=["sess-a", "sess-b"]
        )

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"session_identifier": "sess-a"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        returned_trace_ids = {t["trace_id"] for t in data["data"]}
        expected_trace_ids = {traces[0].trace_id, traces[2].trace_id}
        assert returned_trace_ids == expected_trace_ids

    async def test_list_traces_filter_by_session_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, traces, _, sessions = await _insert_project_with_traces(
            db, num_traces=4, session_identifiers=["sess-a", "sess-b"]
        )

        # Use GlobalID for sess-b (sessions[1])
        session_global_id = str(GlobalID(ProjectSessionNodeType.__name__, str(sessions[1].id)))
        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"session_identifier": session_global_id},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        returned_trace_ids = {t["trace_id"] for t in data["data"]}
        expected_trace_ids = {traces[1].trace_id, traces[3].trace_id}
        assert returned_trace_ids == expected_trace_ids

    async def test_list_traces_filter_by_multiple_session_identifier(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        # 6 traces, 3 sessions: traces round-robin across sess-x, sess-y, sess-z
        project, traces, _, sessions = await _insert_project_with_traces(
            db, num_traces=6, session_identifiers=["sess-x", "sess-y", "sess-z"]
        )

        # Mix: string for sess-x, GlobalID for sess-z
        session_z_gid = str(GlobalID(ProjectSessionNodeType.__name__, str(sessions[2].id)))
        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"session_identifier": ["sess-x", session_z_gid]},
        )
        assert response.status_code == 200
        data = response.json()
        # sess-x -> traces 0,3; sess-z -> traces 2,5
        assert len(data["data"]) == 4
        returned_trace_ids = {t["trace_id"] for t in data["data"]}
        expected_trace_ids = {
            traces[0].trace_id,
            traces[3].trace_id,
            traces[2].trace_id,
            traces[5].trace_id,
        }
        assert returned_trace_ids == expected_trace_ids

    async def test_list_traces_filter_by_nonexistent_session_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _, _, _ = await _insert_project_with_traces(
            db, num_traces=3, session_identifiers=["real-session"]
        )

        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={"session_identifier": "nonexistent-session"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["next_cursor"] is None

    async def test_list_traces_session_filter_combined_with_time_range(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        # 4 traces with sess-a: traces at hours 0,2 and sess-b: traces at hours 1,3
        project, traces, _, sessions = await _insert_project_with_traces(
            db, num_traces=4, session_identifiers=["sess-a", "sess-b"]
        )

        # Filter by sess-a AND time range that only includes hours 2-4
        # sess-a traces are at hours 0 and 2; only hour 2 is in range
        response = await httpx_client.get(
            f"v1/projects/{project.name}/traces",
            params={
                "session_identifier": "sess-a",
                "start_time": "2024-01-01T02:00:00Z",
                "end_time": "2024-01-01T04:00:00Z",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["trace_id"] == traces[2].trace_id
