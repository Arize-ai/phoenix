from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import func, insert, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory

_BASE_TIME = datetime(2024, 1, 1, tzinfo=timezone.utc)
_MODEL_NAME = "phoenix-test-model"
_INPUT_RATE = 0.15 / 1_000_000
_OUTPUT_RATE = 0.60 / 1_000_000


def _llm_attributes(
    model_name: Optional[str],
    prompt_tokens: Optional[int],
    completion_tokens: Optional[int],
) -> dict[str, Any]:
    """Build nested span attributes in the shape stored in the database."""
    llm: dict[str, Any] = {"provider": "test"}
    if model_name is not None:
        llm["model_name"] = model_name
    token_count: dict[str, Any] = {}
    if prompt_tokens is not None:
        token_count["prompt"] = prompt_tokens
    if completion_tokens is not None:
        token_count["completion"] = completion_tokens
    if token_count:
        llm["token_count"] = token_count
    return {"openinference": {"span": {"kind": "LLM"}}, "llm": llm}


async def _insert_generative_model(db: DbSessionFactory) -> models.GenerativeModel:
    model = models.GenerativeModel(
        name=_MODEL_NAME,
        provider="test",
        start_time=_BASE_TIME,
        name_pattern=re.compile(f"{_MODEL_NAME}.*"),
        is_built_in=False,
        token_prices=[
            models.TokenPrice(
                token_type="input", is_prompt=True, base_rate=_INPUT_RATE, customization=None
            ),
            models.TokenPrice(
                token_type="output", is_prompt=False, base_rate=_OUTPUT_RATE, customization=None
            ),
        ],
    )
    async with db() as session:
        session.add(model)
    return model


async def _reload_model_store(app: FastAPI) -> None:
    """Force the app's in-memory pricing store to reflect the current DB state."""
    store = app.state.span_cost_calculator._model_store
    store._last_fetch_time = None
    await store._fetch_models()


async def _insert_span(
    db: DbSessionFactory,
    trace_rowid: int,
    *,
    span_kind: str,
    attributes: dict[str, Any],
    start_time: datetime,
) -> int:
    async with db() as session:
        span_rowid = await session.scalar(
            insert(models.Span)
            .values(
                trace_rowid=trace_rowid,
                span_id=token_hex(8),
                parent_id=None,
                name="span",
                span_kind=span_kind,
                start_time=start_time,
                end_time=start_time + timedelta(seconds=1),
                attributes=attributes,
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
            )
            .returning(models.Span.id)
        )
    assert span_rowid is not None
    return span_rowid


async def _insert_project_and_trace(db: DbSessionFactory) -> tuple[models.Project, int]:
    async with db() as session:
        project_rowid = await session.scalar(
            insert(models.Project).values(name=token_hex(16)).returning(models.Project.id)
        )
        assert project_rowid is not None
        trace_rowid = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id=token_hex(16),
                project_rowid=project_rowid,
                start_time=_BASE_TIME,
                end_time=_BASE_TIME + timedelta(hours=1),
            )
            .returning(models.Trace.id)
        )
        assert trace_rowid is not None
        project = await session.get(models.Project, project_rowid)
    assert project is not None
    return project, trace_rowid


async def _count_span_costs(db: DbSessionFactory, trace_rowid: int) -> int:
    async with db() as session:
        return await session.scalar(  # type: ignore[return-value]
            select(func.count(models.SpanCost.id)).where(models.SpanCost.trace_rowid == trace_rowid)
        )


class TestBackfillSpanCosts:
    async def test_backfills_llm_spans_without_cost(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        for i in range(3):
            await _insert_span(
                db,
                trace_rowid,
                span_kind="LLM",
                attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
                start_time=_BASE_TIME + timedelta(minutes=i),
            )

        response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert response.status_code == 200
        body = response.json()
        assert body["next_cursor"] is None
        assert body["data"] == {
            "spans_scanned": 3,
            "costs_inserted": 3,
            "spans_skipped": 0,
        }
        assert await _count_span_costs(db, trace_rowid) == 3

    async def test_computed_cost_matches_pricing(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        span_rowid = await _insert_span(
            db,
            trace_rowid,
            span_kind="LLM",
            attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
            start_time=_BASE_TIME,
        )

        response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert response.status_code == 200

        async with db() as session:
            cost = await session.scalar(
                select(models.SpanCost).where(models.SpanCost.span_rowid == span_rowid)
            )
        assert cost is not None
        assert cost.prompt_cost == pytest.approx(1000 * _INPUT_RATE)
        assert cost.completion_cost == pytest.approx(500 * _OUTPUT_RATE)
        assert cost.total_cost == pytest.approx(1000 * _INPUT_RATE + 500 * _OUTPUT_RATE)
        assert cost.total_tokens == 1500

    async def test_is_idempotent(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        await _insert_span(
            db,
            trace_rowid,
            span_kind="LLM",
            attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
            start_time=_BASE_TIME,
        )

        first = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert first.json()["data"]["costs_inserted"] == 1

        second = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert second.status_code == 200
        assert second.json()["data"] == {
            "spans_scanned": 0,
            "costs_inserted": 0,
            "spans_skipped": 0,
        }
        assert await _count_span_costs(db, trace_rowid) == 1

    async def test_skips_non_llm_spans(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        await _insert_span(
            db,
            trace_rowid,
            span_kind="CHAIN",
            attributes={"openinference": {"span": {"kind": "CHAIN"}}},
            start_time=_BASE_TIME,
        )

        response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert response.status_code == 200
        assert response.json()["data"]["spans_scanned"] == 0
        assert await _count_span_costs(db, trace_rowid) == 0

    async def test_skips_llm_spans_without_model_name(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        # LLM span with tokens but no model name -> gated out, matching live ingestion.
        await _insert_span(
            db,
            trace_rowid,
            span_kind="LLM",
            attributes=_llm_attributes(None, 1000, 500),
            start_time=_BASE_TIME,
        )

        response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert response.status_code == 200
        assert response.json()["data"] == {
            "spans_scanned": 1,
            "costs_inserted": 0,
            "spans_skipped": 1,
        }
        assert await _count_span_costs(db, trace_rowid) == 0

    async def test_time_range_filter(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        early = _BASE_TIME
        late = _BASE_TIME + timedelta(hours=2)
        for start in (early, late):
            await _insert_span(
                db,
                trace_rowid,
                span_kind="LLM",
                attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
                start_time=start,
            )

        cutoff = _BASE_TIME + timedelta(hours=1)
        response = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs",
            params={"start_time": cutoff.isoformat()},
        )
        assert response.status_code == 200
        assert response.json()["data"]["costs_inserted"] == 1
        assert await _count_span_costs(db, trace_rowid) == 1

    async def test_pagination_covers_all_spans_once(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        num_spans = 5
        for i in range(num_spans):
            await _insert_span(
                db,
                trace_rowid,
                span_kind="LLM",
                attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
                start_time=_BASE_TIME + timedelta(minutes=i),
            )

        total_inserted = 0
        cursor: Optional[str] = None
        num_calls = 0
        while True:
            num_calls += 1
            assert num_calls <= num_spans + 2  # guard against infinite loops
            params: dict[str, int | str] = {"limit": 2}
            if cursor is not None:
                params["cursor"] = cursor
            response = await httpx_client.post(
                f"v1/projects/{project.name}/spans/backfill_costs", params=params
            )
            assert response.status_code == 200
            body = response.json()
            total_inserted += body["data"]["costs_inserted"]
            cursor = body["next_cursor"]
            if cursor is None:
                break

        assert total_inserted == num_spans
        assert await _count_span_costs(db, trace_rowid) == num_spans

    async def test_pagination_advances_past_existing_costs(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        for minute in range(2):
            await _insert_span(
                db,
                trace_rowid,
                span_kind="LLM",
                attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
                start_time=_BASE_TIME + timedelta(minutes=minute),
            )

        first = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs", params={"limit": 1}
        )
        cursor = first.json()["next_cursor"]
        assert cursor is not None

        restart = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs", params={"limit": 1}
        )
        assert restart.json()["data"]["spans_scanned"] == 0
        assert restart.json()["next_cursor"] == cursor

        second = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs",
            params={"limit": 1, "cursor": cursor},
        )
        assert second.json()["data"]["costs_inserted"] == 1
        assert second.json()["next_cursor"] is None
        assert await _count_span_costs(db, trace_rowid) == 2

    async def test_invalid_cursor_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _ = await _insert_project_and_trace(db)
        response = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs",
            params={"cursor": "not-a-valid-cursor"},
        )
        assert response.status_code == 422

    async def test_cursor_for_wrong_node_type_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _ = await _insert_project_and_trace(db)
        cursor = str(GlobalID("Project", str(project.id)))
        response = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs",
            params={"cursor": cursor},
        )
        assert response.status_code == 422

    async def test_invalid_time_range_returns_422(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, _ = await _insert_project_and_trace(db)
        response = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs",
            params={"start_time": _BASE_TIME.isoformat(), "end_time": _BASE_TIME.isoformat()},
        )
        assert response.status_code == 422

    async def test_rejects_oversized_batch(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.post(
            "v1/projects/does-not-exist/spans/backfill_costs",
            params={"limit": 1001},
        )
        assert response.status_code == 422

    async def test_skips_span_without_matching_price(
        self,
        httpx_client: httpx.AsyncClient,
        db: DbSessionFactory,
    ) -> None:
        project, trace_rowid = await _insert_project_and_trace(db)
        await _insert_span(
            db,
            trace_rowid,
            span_kind="LLM",
            attributes=_llm_attributes("unknown-model", 1000, 500),
            start_time=_BASE_TIME,
        )

        response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        assert response.status_code == 200
        assert response.json()["data"] == {
            "spans_scanned": 1,
            "costs_inserted": 0,
            "spans_skipped": 1,
        }
        assert await _count_span_costs(db, trace_rowid) == 0

    async def test_unknown_project_returns_404(
        self,
        httpx_client: httpx.AsyncClient,
    ) -> None:
        response = await httpx_client.post("v1/projects/does-not-exist/spans/backfill_costs")
        assert response.status_code == 404

    async def test_returns_507_when_writes_disabled(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        project, trace_rowid = await _insert_project_and_trace(db)
        app.state.db.should_not_insert_or_update = True
        try:
            response = await httpx_client.post(f"v1/projects/{project.name}/spans/backfill_costs")
        finally:
            app.state.db.should_not_insert_or_update = False
        assert response.status_code == 507

    async def test_cursor_roundtrips_span_global_id(
        self,
        httpx_client: httpx.AsyncClient,
        app: FastAPI,
        db: DbSessionFactory,
    ) -> None:
        await _insert_generative_model(db)
        await _reload_model_store(app)
        project, trace_rowid = await _insert_project_and_trace(db)
        span_rowids = [
            await _insert_span(
                db,
                trace_rowid,
                span_kind="LLM",
                attributes=_llm_attributes(_MODEL_NAME, 1000, 500),
                start_time=_BASE_TIME + timedelta(minutes=i),
            )
            for i in range(2)
        ]

        response = await httpx_client.post(
            f"v1/projects/{project.name}/spans/backfill_costs", params={"limit": 1}
        )
        body = response.json()
        assert body["next_cursor"] is not None
        cursor_rowid = int(GlobalID.from_id(body["next_cursor"]).node_id)
        # Cursor is anchored on the last processed span (the first one inserted).
        assert cursor_rowid == span_rowids[0]
