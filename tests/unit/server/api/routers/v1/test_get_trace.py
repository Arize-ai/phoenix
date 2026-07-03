from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex

import httpx
from sqlalchemy import insert
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
from phoenix.server.api.types.Project import Project as ProjectNodeType
from phoenix.server.api.types.Trace import Trace as TraceNodeType
from phoenix.server.types import DbSessionFactory


async def _insert_trace(
    db: DbSessionFactory,
    *,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> tuple[models.Project, models.Trace]:
    base_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project_row_id = await session.scalar(
            insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
        )
        assert project_row_id is not None
        trace_row_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id=token_hex(16),
                project_rowid=project_row_id,
                start_time=base_time,
                end_time=base_time + timedelta(minutes=5),
            )
            .returning(models.Trace.id)
        )
        assert trace_row_id is not None
        await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_row_id,
                span_id=token_hex(8),
                parent_id=None,
                name="root",
                span_kind="LLM",
                start_time=base_time,
                end_time=base_time + timedelta(seconds=5),
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
        project = await session.get(models.Project, project_row_id)
        trace = await session.get(models.Trace, trace_row_id)
        assert project is not None
        assert trace is not None
    return project, trace


class TestGetTrace:
    async def test_get_trace_by_otel_trace_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, trace = await _insert_trace(db)
        response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
        assert response.status_code == 200

        trace_data = response.json()["data"]
        assert trace_data["trace_id"] == trace.trace_id

        trace_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(trace_data["id"]), TraceNodeType.__name__
        )
        assert trace_rowid == trace.id

        project_rowid = from_global_id_with_expected_type(
            GlobalID.from_id(trace_data["project_id"]), ProjectNodeType.__name__
        )
        assert project_rowid == project.id

    async def test_get_trace_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, trace = await _insert_trace(db)
        trace_global_id = str(GlobalID(TraceNodeType.__name__, str(trace.id)))

        response = await httpx_client.get(f"v1/traces/{trace_global_id}")
        assert response.status_code == 200

        trace_data = response.json()["data"]
        assert trace_data["trace_id"] == trace.trace_id
        assert trace_data["id"] == trace_global_id

    async def test_get_trace_response_fields(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, trace = await _insert_trace(db)
        response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
        assert response.status_code == 200

        trace_data = response.json()["data"]
        assert "id" in trace_data
        assert "trace_id" in trace_data
        assert "project_id" in trace_data
        assert "start_time" in trace_data
        assert "end_time" in trace_data
        assert "token_count_prompt" in trace_data
        assert "token_count_completion" in trace_data
        assert "token_count_total" in trace_data

    async def test_get_trace_token_counts(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        _, trace = await _insert_trace(db, prompt_tokens=100, completion_tokens=50)
        response = await httpx_client.get(f"v1/traces/{trace.trace_id}")
        assert response.status_code == 200

        trace_data = response.json()["data"]
        assert trace_data["token_count_prompt"] == 100
        assert trace_data["token_count_completion"] == 50
        assert trace_data["token_count_total"] == 150

    async def test_get_trace_not_found_by_trace_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.get(f"v1/traces/{token_hex(16)}")
        assert response.status_code == 404

    async def test_get_trace_not_found_by_global_id(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        missing_global_id = str(GlobalID(TraceNodeType.__name__, "123456789"))
        response = await httpx_client.get(f"v1/traces/{missing_global_id}")
        assert response.status_code == 404
