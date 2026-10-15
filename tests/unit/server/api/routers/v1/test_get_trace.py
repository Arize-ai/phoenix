from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex

import httpx
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.types import DbSessionFactory

BASE_TIME = datetime(2024, 1, 1, tzinfo=timezone.utc)


async def _insert_trace(
    db: DbSessionFactory,
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> tuple[models.Project, models.Trace]:
    """Insert a project with a single LLM-root trace and return both."""
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
        )
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id=token_hex(16),
                project_rowid=project_rowid,
                start_time=BASE_TIME,
                end_time=BASE_TIME + timedelta(minutes=5),
            )
            .returning(models.Trace.id)
        )
        await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_rowid,
                span_id=token_hex(8),
                parent_id=None,
                name="root",
                span_kind="LLM",
                start_time=BASE_TIME,
                end_time=BASE_TIME + timedelta(seconds=5),
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=prompt_tokens,
                cumulative_llm_token_count_completion=completion_tokens,
                llm_token_count_prompt=prompt_tokens,
                llm_token_count_completion=completion_tokens,
            )
            .returning(models.Span.id)
        )
        project = await session.get(models.Project, project_rowid)
        trace = await session.get(models.Trace, trace_rowid)
    assert project is not None and trace is not None
    return project, trace


async def test_get_trace_by_otel_trace_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    project, trace = await _insert_trace(db)
    response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["trace_id"] == trace.trace_id
    assert data["id"] == str(GlobalID(TraceNodeType.__name__, str(trace.id)))
    # The owning project is included so clients can navigate back without a project scope.
    assert data["project_id"] == str(GlobalID(ProjectNodeType.__name__, str(project.id)))


async def test_get_trace_by_global_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    _, trace = await _insert_trace(db)
    global_id = str(GlobalID(TraceNodeType.__name__, str(trace.id)))
    response = await httpx_client.get(f"v1/traces/{global_id}")
    assert response.status_code == 200
    assert response.json()["data"]["trace_id"] == trace.trace_id


async def test_get_trace_matches_list_endpoint_shape(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """The single-trace envelope must match the list endpoint's trace schema."""
    project, trace = await _insert_trace(db, prompt_tokens=7, completion_tokens=3)
    listed = await httpx_client.get(f"v1/projects/{project.name}/traces")
    assert listed.status_code == 200
    from_list = listed.json()["data"][0]

    single = await httpx_client.get(f"v1/traces/{trace.trace_id}")
    assert single.status_code == 200
    from_single = single.json()["data"]

    assert from_single == from_list


async def test_get_trace_includes_token_counts(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    _, trace = await _insert_trace(db, prompt_tokens=100, completion_tokens=50)
    response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["token_count_prompt"] == 100
    assert data["token_count_completion"] == 50
    assert data["token_count_total"] == 150


async def test_get_trace_zero_token_counts(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    _, trace = await _insert_trace(db)
    response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["token_count_prompt"] == 0
    assert data["token_count_completion"] == 0
    assert data["token_count_total"] == 0


async def test_get_trace_unknown_otel_trace_id_returns_404(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    await _insert_trace(db)
    response = await httpx_client.get(f"v1/traces/{token_hex(16)}")
    assert response.status_code == 404


async def test_get_trace_unknown_global_id_returns_404(
    httpx_client: httpx.AsyncClient,
) -> None:
    missing = str(GlobalID(TraceNodeType.__name__, "99999"))
    response = await httpx_client.get(f"v1/traces/{missing}")
    assert response.status_code == 404


async def test_get_trace_does_not_require_project_scope(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Two projects each own a trace; each is retrievable by ID alone."""
    _, trace_a = await _insert_trace(db)
    _, trace_b = await _insert_trace(db)
    for trace in (trace_a, trace_b):
        response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
        assert response.status_code == 200
        assert response.json()["data"]["trace_id"] == trace.trace_id
