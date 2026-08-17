"""End-to-end wiring tests for the online-eval runtime behind
``PHOENIX_ONLINE_EVAL_ENABLED``: the enabled app composes one runtime owning the
producer, both consumers, the session sweeper, the signal drain, and the annotation
delta adapter, and a seeded criteria flows all the way to a published evaluation.
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
    ENV_PHOENIX_ONLINE_EVAL_FRONTIER_LAG_SECONDS,
    ENV_PHOENIX_ONLINE_EVAL_MAX_DB_CONCURRENCY,
    ENV_PHOENIX_ONLINE_EVAL_MAX_EVALUATOR_CONCURRENCY,
    ENV_PHOENIX_ONLINE_EVAL_MAX_SANDBOX_PAYLOAD_BYTES,
    ENV_PHOENIX_ONLINE_EVAL_MAX_TRANSCRIPT_BYTES,
    ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.api.dataloaders.evaluation_request_blocking_reasons import (
    EvaluationRequestBlockingReasonsDataLoader,
)
from phoenix.server.api.dataloaders.evaluation_requests import EvaluationRequestBlockingReason
from phoenix.server.app import create_app
from phoenix.server.online_eval.consumer import OnlineEvalConsumer
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.runtime import OnlineEvalRuntime
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.online_eval.triggering.annotations_adapter import AnnotationDeltaAdapter
from phoenix.server.online_eval.triggering.drain import SignalDrain
from phoenix.server.types import DaemonTask, DbSessionFactory
from tests.unit.conftest import (
    TestBulkInserter,
    patch_batched_caller,
    patch_grpc_server,
)

from ..._helpers import _add_project, _add_project_session, _add_span, _add_trace
from .test_consumer import (
    _materialize_session_unit,
    _materialize_unit,
    _patch_playground_client,
    _seed_builtin_criteria,
    _seed_llm_criteria,
    _StubLLMClient,
)


def _create_app(db: DbSessionFactory, *, read_only: bool = False):  # type: ignore[no-untyped-def]
    return create_app(
        db=db,
        authentication_enabled=False,
        serve_ui=False,
        bulk_inserter_factory=TestBulkInserter,
        read_only=read_only,
    )


def _runtime(db: DbSessionFactory, *, read_only: bool = False) -> OnlineEvalRuntime:
    app = _create_app(db, read_only=read_only)
    runtime = app.state.online_eval_runtime
    assert isinstance(runtime, OnlineEvalRuntime)
    return runtime


def _enable_online_eval(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")
    # The adapter holds both of its walks this far short of the present; without the
    # wait a test would have to sleep out the default lag to see its own annotation.
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_FRONTIER_LAG_SECONDS, "0")


def _record_stop(
    monkeypatch: pytest.MonkeyPatch,
    daemon: DaemonTask,
    stopped: list[DaemonTask],
) -> None:
    original = daemon.stop

    async def _stop() -> None:
        stopped.append(daemon)
        await original()

    monkeypatch.setattr(daemon, "stop", _stop)


async def _seed_quiet_session(
    db: DbSessionFactory,
) -> tuple[models.Project, models.ProjectSession, models.Span]:
    """A session whose content is old enough to be past the sweeper's quiet delay."""
    ingested_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project, start_time=ingested_at)
        project_session.last_span_ingested_at = ingested_at
        trace = await _add_trace(session, project, project_session, start_time=ingested_at)
        span = await _add_span(
            session,
            trace,
            span_kind="CHAIN",
            start_time=ingested_at,
            attributes={"input": {"value": "hi"}, "output": {"value": "there"}},
        )
    return project, project_session, span


async def _add_trigger(
    db: DbSessionFactory,
    criteria_id: int,
    *,
    signal_kind: models.EvaluatorSignalKind,
) -> None:
    async with db() as session:
        session.add(
            models.ProjectEvaluatorTrigger(criteria_id=criteria_id, signal_kind=signal_kind)
        )


async def _add_span_annotation(
    db: DbSessionFactory,
    span: models.Span,
) -> models.SpanAnnotation:
    async with db() as session:
        annotation = models.SpanAnnotation(
            span_rowid=span.id,
            name="human-review",
            label="incorrect",
            score=None,
            explanation=None,
            metadata_={},
            annotator_kind="HUMAN",
            identifier="",
            source="APP",
            user_id=None,
        )
        session.add(annotation)
        await session.flush()
    return annotation


async def _requests(db: DbSessionFactory) -> list[models.EvaluationRequest]:
    async with db() as session:
        return list(
            await session.scalars(
                select(models.EvaluationRequest).order_by(models.EvaluationRequest.id)
            )
        )


async def _evaluation_answering(
    db: DbSessionFactory,
    criteria_id: int,
) -> models.EvalSessionWorkUnit:
    """The session evaluation the request for ``criteria_id`` was answered with."""
    async with db() as session:
        request = await session.scalar(
            select(models.EvaluationRequest).where(
                models.EvaluationRequest.criteria_id == criteria_id
            )
        )
        assert request is not None
        assert request.materialized_by_session_work_unit_id is not None
        work_unit = await session.get(
            models.EvalSessionWorkUnit, request.materialized_by_session_work_unit_id
        )
    assert work_unit is not None
    return work_unit


async def _session_annotations(db: DbSessionFactory) -> list[models.ProjectSessionAnnotation]:
    async with db() as session:
        return list(await session.scalars(select(models.ProjectSessionAnnotation)))


async def test_online_eval_daemons_absent_by_default(db: DbSessionFactory) -> None:
    runtime = _runtime(db)
    assert runtime.daemons == ()


async def test_online_eval_daemons_absent_in_read_only_mode(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")

    runtime = _runtime(db, read_only=True)
    assert runtime.daemons == ()


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
    every part of its lifecycle follows that flag together.
    """
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    if session_enabled is None:
        monkeypatch.delenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, raising=False)
    else:
        monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, session_enabled)

    runtime = _runtime(db)
    assert isinstance(runtime.producer, OnlineEvalProducer)
    if session_daemons_expected:
        assert isinstance(runtime.session_sweeper, SessionEvalSweeper)
        assert isinstance(runtime.session_consumer, OnlineEvalConsumer)
        assert isinstance(runtime.signal_drain, SignalDrain)
        assert isinstance(runtime.annotation_adapter, AnnotationDeltaAdapter)
    else:
        assert runtime.session_sweeper is None
        assert runtime.session_consumer is None
        assert runtime.signal_drain is None
        assert runtime.annotation_adapter is None


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


async def test_a_failed_start_stops_the_daemons_it_already_started(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_online_eval(monkeypatch)
    runtime = _runtime(db)
    *started, failing = runtime.daemons
    stopped: list[DaemonTask] = []
    for daemon in started:
        _record_stop(monkeypatch, daemon, stopped)

    async def _fail() -> None:
        raise RuntimeError("daemon start failed")

    monkeypatch.setattr(failing, "start", _fail)

    with pytest.raises(RuntimeError, match="daemon start failed"):
        await runtime.start()

    assert stopped == list(reversed(started))
    assert not any(daemon._tasks for daemon in runtime.daemons)


async def test_shutdown_stops_every_daemon_and_repeats_harmlessly(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    _enable_online_eval(monkeypatch)
    runtime = _runtime(db)

    await runtime.start()
    assert all(daemon._tasks for daemon in runtime.daemons)

    await runtime.stop()
    assert not any(daemon._tasks for daemon in runtime.daemons)

    await runtime.stop()


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
        runtime = app.state.online_eval_runtime
        assert isinstance(runtime, OnlineEvalRuntime)
        producer = runtime.producer
        consumer = runtime.consumer
        session_consumer = runtime.session_consumer
        session_sweeper = runtime.session_sweeper
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
        await runtime.stop()

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


async def test_an_annotation_drives_a_session_evaluation_end_to_end(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An annotation reaches a published session evaluation through the composed
    runtime: adapter -> drain -> sweeper -> session consumer.
    """
    _enable_online_eval(monkeypatch)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        runtime = app.state.online_eval_runtime
        assert isinstance(runtime, OnlineEvalRuntime)
        await stack.enter_async_context(LifespanManager(app))
        # Every daemon shares the fixture's one connection, so they are quiesced before
        # this test drives the database itself.
        await runtime.stop()
        adapter, drain = runtime.annotation_adapter, runtime.signal_drain
        sweeper, session_consumer = runtime.session_sweeper, runtime.session_consumer
        assert adapter is not None and drain is not None
        assert sweeper is not None and session_consumer is not None

        project, _, span = await _seed_quiet_session(db)
        _, criteria_id = await _seed_llm_criteria(db, project.id, evaluation_target="SESSION")
        await _add_trigger(db, criteria_id, signal_kind="annotation_upserted")

        # The adapter starts both walks at the present, so an annotation is only
        # announced when it lands after a tick that has already positioned them.
        await adapter._tick()
        await _add_span_annotation(db, span)
        await adapter._tick()

        await drain._tick()
        await sweeper._tick()
        await session_consumer._cycle()

        assert [request.criteria_id for request in await _requests(db)] == [criteria_id]
        evaluation = await _evaluation_answering(db, criteria_id)
        assert evaluation.status == "DONE"
        (annotation,) = await _session_annotations(db)
        assert annotation.label == "good"


async def test_a_completed_span_evaluation_drives_a_session_evaluation_end_to_end(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A span evaluator's verdict reaches a published session evaluation through the
    composed runtime: span consumer -> drain -> sweeper -> session consumer.
    """
    _enable_online_eval(monkeypatch)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        runtime = app.state.online_eval_runtime
        assert isinstance(runtime, OnlineEvalRuntime)
        await stack.enter_async_context(LifespanManager(app))
        await runtime.stop()
        consumer, drain = runtime.consumer, runtime.signal_drain
        sweeper, session_consumer = runtime.session_sweeper, runtime.session_consumer
        assert consumer is not None and drain is not None
        assert sweeper is not None and session_consumer is not None

        project, _, span = await _seed_quiet_session(db)
        span_evaluator_id, span_criteria_id = await _seed_llm_criteria(db, project.id)
        _, session_criteria_id = await _seed_llm_criteria(
            db, project.id, evaluation_target="SESSION"
        )
        await _add_trigger(db, session_criteria_id, signal_kind="evaluation_completed")
        await _materialize_unit(db, span.id, span_evaluator_id, span_criteria_id)

        await consumer._cycle()
        await drain._tick()
        await sweeper._tick()
        await session_consumer._cycle()

        assert [request.criteria_id for request in await _requests(db)] == [session_criteria_id]
        evaluation = await _evaluation_answering(db, session_criteria_id)
        assert evaluation.status == "DONE"
        assert evaluation.criteria_id == session_criteria_id


async def test_a_verdict_never_requests_the_criteria_that_authored_it(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Both rules fire on any completed evaluation in the project; only the one owned by
    the criteria that authored the verdict has to decline it.
    """
    _enable_online_eval(monkeypatch)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        runtime = app.state.online_eval_runtime
        assert isinstance(runtime, OnlineEvalRuntime)
        await stack.enter_async_context(LifespanManager(app))
        await runtime.stop()
        drain, session_consumer = runtime.signal_drain, runtime.session_consumer
        assert drain is not None and session_consumer is not None

        project, project_session, _ = await _seed_quiet_session(db)
        authoring_evaluator_id, authoring_criteria_id = await _seed_llm_criteria(
            db, project.id, evaluation_target="SESSION"
        )
        _, downstream_criteria_id = await _seed_builtin_criteria(
            db, project.id, evaluation_target="SESSION"
        )
        for criteria_id in (authoring_criteria_id, downstream_criteria_id):
            await _add_trigger(db, criteria_id, signal_kind="evaluation_completed")
        await _materialize_session_unit(
            db,
            project_session.id,
            authoring_evaluator_id,
            authoring_criteria_id,
        )

        await session_consumer._cycle()
        await drain._tick()

        assert [request.criteria_id for request in await _requests(db)] == [downstream_criteria_id]


async def _add_session_annotation(
    db: DbSessionFactory,
    project_session: models.ProjectSession,
    name: str,
) -> None:
    async with db() as session:
        session.add(
            models.ProjectSessionAnnotation(
                project_session_id=project_session.id,
                name=name,
                label="yes",
                score=None,
                explanation=None,
                metadata_={},
                annotator_kind="HUMAN",
                identifier="",
                source="APP",
                user_id=None,
            )
        )


async def _session_work_units(db: DbSessionFactory) -> list[models.EvalSessionWorkUnit]:
    async with db() as session:
        return list(
            await session.scalars(
                select(models.EvalSessionWorkUnit).order_by(models.EvalSessionWorkUnit.id)
            )
        )


async def test_a_rule_request_waits_for_the_evaluators_own_session_filter(
    db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The trigger is the edge and the evaluator's filter is the level; a request is the
    composite of the two.

    The evaluator asks for sessions carrying both annotations, and triggers on either
    arriving. After the first one the request is standing demand the session does not yet
    satisfy — so it stays unfulfilled and says why, rather than being declined. When the
    second lands the pair evaluates, once.
    """
    _enable_online_eval(monkeypatch)
    _patch_playground_client(monkeypatch, _StubLLMClient())

    async with AsyncExitStack() as stack:
        await stack.enter_async_context(patch_batched_caller())
        await stack.enter_async_context(patch_grpc_server())
        app = _create_app(db)
        runtime = app.state.online_eval_runtime
        assert isinstance(runtime, OnlineEvalRuntime)
        await stack.enter_async_context(LifespanManager(app))
        await runtime.stop()
        adapter, drain = runtime.annotation_adapter, runtime.signal_drain
        sweeper, session_consumer = runtime.session_sweeper, runtime.session_consumer
        assert adapter is not None and drain is not None
        assert sweeper is not None and session_consumer is not None

        project, project_session, _ = await _seed_quiet_session(db)
        _, criteria_id = await _seed_llm_criteria(
            db,
            project.id,
            evaluation_target="SESSION",
            filter_condition=(
                "annotations[\"A\"].label == 'yes' and annotations[\"B\"].label == 'yes'"
            ),
        )
        await _add_trigger(db, criteria_id, signal_kind="annotation_upserted")

        await adapter._tick()
        await _add_session_annotation(db, project_session, "A")
        await adapter._tick()
        await drain._tick()
        await sweeper._tick()

        # The ask was recorded and is being held, not answered and not declined.
        (request,) = await _requests(db)
        assert request.criteria_id == criteria_id
        assert request.materialized_generation < request.requested_generation
        assert await _session_work_units(db) == []
        blocking_reasons = EvaluationRequestBlockingReasonsDataLoader(db)
        assert (
            await blocking_reasons.load((project_session.id, criteria_id))
            is EvaluationRequestBlockingReason.SESSION_FILTER_NOT_MATCHED
        )

        await _add_session_annotation(db, project_session, "B")
        await adapter._tick()
        await drain._tick()
        await sweeper._tick()
        await session_consumer._cycle()

        # One evaluation for the pair, however many occurrences asked for it.
        evaluations = [
            unit for unit in await _session_work_units(db) if unit.criteria_id == criteria_id
        ]
        assert len(evaluations) == 1
        assert evaluations[0].status == "DONE"
        assert evaluations[0].scheduling_origin == "RULE"

        await sweeper._tick()
        assert (
            len([unit for unit in await _session_work_units(db) if unit.criteria_id == criteria_id])
            == 1
        )
