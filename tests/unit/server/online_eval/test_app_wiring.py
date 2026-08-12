"""End-to-end wiring test for the online-eval daemons behind
``PHOENIX_ONLINE_EVAL_ENABLED``: the enabled app starts target-specific consumers,
and a seeded criteria + span flows producer tick → consumer cycle → span annotation
with the work unit DONE.
"""

import asyncio
from contextlib import AsyncExitStack
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from asgi_lifespan import LifespanManager
from sqlalchemy import select, update

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_CLAIM_BATCH_SIZE,
    ENV_PHOENIX_ONLINE_EVAL_ENABLED,
    ENV_PHOENIX_ONLINE_EVAL_MAX_DB_CONCURRENCY,
    ENV_PHOENIX_ONLINE_EVAL_MAX_EVALUATOR_CONCURRENCY,
    ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES,
    ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
    ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED,
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
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")

    app = _create_app(db, read_only=True)
    assert app.state.online_eval_producer is None
    assert app.state.online_eval_consumer is None
    assert app.state.online_eval_session_consumer is None
    assert app.state.online_eval_session_sweeper is None


@pytest.mark.parametrize(
    ("session_enabled", "session_daemons_expected"),
    [
        pytest.param(None, True, id="on-by-default"),
        pytest.param("false", False, id="opted-out"),
    ],
)
async def test_session_evaluation_runs_unless_it_is_turned_off(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    session_enabled: Optional[str],
    session_daemons_expected: bool,
) -> None:
    """Session evaluation follows the master gate unless its own flag turns it off, and
    both halves of its lifecycle follow that flag together.
    """
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    if session_enabled is None:
        monkeypatch.delenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, raising=False)
    else:
        monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, session_enabled)

    app = _create_app(db)
    assert isinstance(app.state.online_eval_producer, OnlineEvalProducer)
    if session_daemons_expected:
        assert isinstance(app.state.online_eval_session_sweeper, SessionEvalSweeper)
        assert isinstance(app.state.online_eval_session_consumer, OnlineEvalConsumer)
    else:
        assert app.state.online_eval_session_sweeper is None
        assert app.state.online_eval_session_consumer is None


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
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_CLAIM_BATCH_SIZE, "3")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_MAX_EVALUATOR_CONCURRENCY, "4")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_MAX_DB_CONCURRENCY, "5")
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
        assert consumer._claim_batch_size == session_consumer._claim_batch_size == 3
        assert consumer._evaluator_semaphore is session_consumer._evaluator_semaphore
        assert consumer._evaluator_semaphore._value == 4
        assert consumer._db_semaphore is session_consumer._db_semaphore
        assert consumer._db_semaphore is not None
        assert consumer._db_semaphore._value == 5
        assert consumer._executor._db_semaphore is consumer._db_semaphore
        assert session_consumer._executor._db_semaphore is consumer._db_semaphore
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
