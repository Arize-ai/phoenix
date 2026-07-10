"""End-to-end wiring test for the online-eval producer daemon behind
``PHOENIX_ONLINE_EVAL_ENABLED``: the enabled app starts and stops the producer
through the lifespan, and a seeded criteria + span flows producer tick →
PENDING work unit. (The consumer daemon and its wiring land in the stacked
follow-up PR; until then materialized units rest as PENDING.)
"""

from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select, update

from phoenix.config import ENV_PHOENIX_ONLINE_EVAL_ENABLED
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.app import create_app
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)

from ..._helpers import _add_project, _add_span, _add_trace
from .test_producer import _seed_criteria


def _create_app(db: DbSessionFactory):  # type: ignore[no-untyped-def]
    return create_app(
        db=db,
        authentication_enabled=False,
        serve_ui=False,
        bulk_inserter_factory=TestBulkInserter,
    )


async def test_online_eval_producer_absent_by_default(db: DbSessionFactory) -> None:
    app = _create_app(db)
    assert app.state.online_eval_producer is None


async def test_enabled_app_materializes_seeded_criteria(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        producer = app.state.online_eval_producer
        assert isinstance(producer, OnlineEvalProducer)
        await stack.enter_async_context(LifespanManager(app))

        async with db() as session:
            project = await _add_project(session)
            trace = await _add_trace(session, project)
            span = await _add_span(
                session,
                trace,
                attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
            )
        _, criteria_id = await _seed_criteria(db, project.id)

        # Age the cursor's high-water observation past the frontier lag so the
        # next tick's scan window covers the seeded span. The daemon's own
        # startup tick may already have created (and leased) the cursor row.
        async with db() as session:
            await session.execute(
                insert_on_conflict(
                    {"grain": "SPAN", "consumer_group": "default", "produced_through_id": 0},
                    table=models.EvalWorkCursor,
                    dialect=db.dialect,
                    unique_by=("grain", "consumer_group"),
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
            await session.execute(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.grain == "SPAN",
                    models.EvalWorkCursor.consumer_group == "default",
                )
                .values(
                    produced_through_id=0,
                    observed_high_water_id=span.id,
                    observed_at=datetime.now(timezone.utc) - timedelta(seconds=120),
                )
            )

        await producer._tick()
        async with db() as session:
            unit = await session.scalar(
                select(models.EvalWorkUnit).where(models.EvalWorkUnit.span_rowid == span.id)
            )
        assert unit is not None
        assert unit.criteria_id == criteria_id
        assert unit.status == "PENDING"
