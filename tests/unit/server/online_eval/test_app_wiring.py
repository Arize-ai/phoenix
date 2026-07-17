"""End-to-end wiring test for the online-eval daemons behind
``PHOENIX_ONLINE_EVAL_ENABLED``: the enabled app starts target-specific consumers,
and a seeded criteria + span flows producer tick → consumer cycle → span annotation
with the work unit DONE.
"""

import asyncio
from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select, update

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_ENABLED,
    ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES,
    ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.app import create_app
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)

from ..._helpers import _add_project, _add_span, _add_trace
from .test_consumer import _patch_playground_client, _seed_llm_criteria, _StubLLMClient


def _create_app(db: DbSessionFactory, *, read_only: bool = False):  # type: ignore[no-untyped-def]
    return create_app(
        db=db,
        authentication_enabled=False,
        serve_ui=False,
        bulk_inserter_factory=TestBulkInserter,
        read_only=read_only,
    )


async def test_online_eval_daemons_absent_by_default(db: DbSessionFactory) -> None:
    app = _create_app(db)
    assert app.state.online_eval_producer is None
    assert app.state.online_eval_consumer is None
    assert app.state.online_eval_session_consumer is None
    assert app.state.online_eval_session_sweeper is None


async def test_online_eval_daemons_absent_in_read_only_mode(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")

    app = _create_app(db, read_only=True)
    assert app.state.online_eval_producer is None
    assert app.state.online_eval_consumer is None
    assert app.state.online_eval_session_consumer is None
    assert app.state.online_eval_session_sweeper is None


@pytest.mark.parametrize(
    ("env_name", "value"),
    [
        pytest.param(
            ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
            "255",
            id="transcript-below-floor",
        ),
        pytest.param(
            ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
            "not-an-integer",
            id="transcript-not-integer",
        ),
        pytest.param(
            ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES,
            "1023",
            id="sandbox-below-floor",
        ),
        pytest.param(
            ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES,
            "not-an-integer",
            id="sandbox-not-integer",
        ),
    ],
)
async def test_enabled_app_validates_session_byte_limits_at_startup(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    env_name: str,
    value: str,
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    monkeypatch.setenv(env_name, value)

    with pytest.raises(ValueError, match=env_name):
        _create_app(db)


async def test_enabled_app_runs_seeded_criteria_end_to_end(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    _patch_playground_client(monkeypatch, _StubLLMClient())

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        producer = app.state.online_eval_producer
        consumer = app.state.online_eval_consumer
        session_consumer = app.state.online_eval_session_consumer
        session_sweeper = app.state.online_eval_session_sweeper
        assert isinstance(producer, OnlineEvalProducer)
        assert isinstance(consumer, OnlineEvalConsumer)
        assert isinstance(session_consumer, OnlineEvalConsumer)
        assert session_consumer is not consumer
        assert session_consumer._evaluation_target == "SESSION"
        assert isinstance(session_sweeper, SessionEvalSweeper)
        await stack.enter_async_context(LifespanManager(app))
        await consumer.stop()
        await session_consumer.stop()
        await producer.stop()
        await session_sweeper.stop()

        async with db() as session:
            project = await _add_project(session)
            trace = await _add_trace(session, project)
            span = await _add_span(
                session,
                trace,
                attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
            )
        _, criteria_id = await _seed_llm_criteria(db, project.id)

        # Age the cursor's high-water observation past the frontier lag so the
        # next tick's scan window covers the seeded span. The daemon's own
        # startup tick may already have created (and leased) the cursor row.
        async with db() as session:
            await session.execute(
                insert_on_conflict(
                    {
                        "evaluation_target": "SPAN",
                        "consumer_group": "default",
                        "produced_through_id": 0,
                    },
                    table=models.EvalWorkCursor,
                    dialect=db.dialect,
                    unique_by=("evaluation_target", "consumer_group"),
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
            await session.execute(
                update(models.EvalWorkCursor)
                .where(
                    models.EvalWorkCursor.evaluation_target == "SPAN",
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

        await consumer._cycle()

        deadline = asyncio.get_running_loop().time() + 10
        while True:
            async with db() as session:
                refreshed = await session.get(models.EvalWorkUnit, unit.id)
                assert refreshed is not None
                status = refreshed.status
            if status == "DONE" or asyncio.get_running_loop().time() > deadline:
                break
            await asyncio.sleep(0.05)
        assert status == "DONE"

        async with db() as session:
            annotation = await session.scalar(
                select(models.SpanAnnotation).where(models.SpanAnnotation.span_rowid == span.id)
            )
        assert annotation is not None
        assert annotation.label == "good"
        assert annotation.source == "API"
