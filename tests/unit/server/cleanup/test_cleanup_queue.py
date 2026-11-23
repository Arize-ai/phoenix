"""Unit tests for the cleanup queue, background reclamation, and domain fences."""

from __future__ import annotations

import asyncio
from collections import Counter
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from types import SimpleNamespace
from typing import Any, Optional, cast
from unittest.mock import MagicMock

import httpx2
import pytest
from sqlalchemy import event, func, select, update
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.eval_work import MAX_ATTEMPTS
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.span import insert_span
from phoenix.db.types.annotation_configs import (
    ContinuousAnnotationConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import Conflict, NotFound
from phoenix.server.app import _db
from phoenix.server.cleanup.coordinator import _CLEANUP_ADMISSION_LOCK_ID, CleanupCoordinator
from phoenix.server.cleanup.lifecycle import (
    TraceClearBatchResult,
    admit_exclusive_experiment_projects_delete,
    admit_project_delete,
    clear_project_traces_in_batches,
    logical_delete_dataset_evaluators,
    logical_delete_project_evaluators,
    resolve_experiment_project_delete_candidates,
)
from phoenix.server.cleanup.primitives import (
    PrimitiveResult,
    PrimitiveStatus,
    drain_dataset_evaluator_dependents_step,
    drain_eval_work_units_step,
    drain_project_annotation_config_links_step,
    drain_trace_scope_step,
)
from phoenix.server.daemons.cleanup_worker import CleanupWorker
from phoenix.server.dml_event import DmlEvent, SpanDeleteEvent
from phoenix.server.online_eval import coordinator as online_eval_coordinator_module
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.online_eval.coordinator import (
    CLAIM_LEASE_TTL_SECONDS,
    EvalWorkCoordinator,
    PublicationEvaluatorDisabledError,
    recover_lapsed_claims,
)
from phoenix.server.online_eval.executor import HydrationFailure, OnlineEvalExecutor
from phoenix.server.online_eval.tracing import marked_evaluator_tracer, persist_evaluator_traces
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.tracers import Tracer
from tests.unit._helpers import (
    _add_project,
    _add_project_session,
    _add_span,
    _add_trace,
    _bind_evaluator_trace_project,
)
from tests.unit.graphql import AsyncGraphQLClient


async def _drain_all(coordinator: CleanupCoordinator) -> int:
    steps = 0
    while (await coordinator.step_or_next_delay())[0]:
        steps += 1
    return steps


async def _clear_project(
    db: DbSessionFactory,
    project_id: int,
    *,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    batch_limit: int = 1000,
) -> list[TraceClearBatchResult]:
    return [
        batch
        async for batch in clear_project_traces_in_batches(
            db,
            project_id=project_id,
            start_time=start_time,
            end_time=end_time,
            batch_limit=batch_limit,
        )
    ]


class _DaemonController:
    """Drives ``CleanupWorker`` cycles deterministically in place of real sleeps."""

    def __init__(self) -> None:
        self._release = asyncio.Event()
        self._parked = asyncio.Event()
        self.sleep_delays: list[Optional[float]] = []
        self.original_sleep = CleanupWorker._sleep

    def install(self, monkeypatch: pytest.MonkeyPatch) -> None:
        controller = self

        async def _park(
            worker: CleanupWorker,
            delay_seconds: Optional[float] = None,
        ) -> None:
            controller.sleep_delays.append(delay_seconds)
            controller._parked.set()
            wake_waiter = asyncio.create_task(worker._woken.wait())
            release_waiter = asyncio.create_task(controller._release.wait())
            try:
                await asyncio.wait(
                    {wake_waiter, release_waiter},
                    return_when=asyncio.FIRST_COMPLETED,
                )
            finally:
                for waiter in (wake_waiter, release_waiter):
                    if not waiter.done():
                        waiter.cancel()
                await asyncio.gather(wake_waiter, release_waiter, return_exceptions=True)
                controller._release.clear()

        monkeypatch.setattr(CleanupWorker, "_sleep", _park)

    async def wait_until_parked(self, timeout: float = 30.0) -> None:
        await self._parked_within(timeout, "the cleanup worker never parked")

    async def run_once(self, timeout: float = 30.0) -> None:
        await self._parked_within(timeout, "the cleanup worker never parked")
        self._parked.clear()
        self._release.set()
        await self._parked_within(timeout, "the cleanup cycle did not finish")

    @asynccontextmanager
    async def expect_wake_cycle(self, timeout: float = 30.0) -> AsyncIterator[None]:
        await self._parked_within(timeout, "the cleanup worker never parked")
        self._parked.clear()
        yield
        await self._parked_within(timeout, "the cleanup worker was not woken or did not finish")

    async def _parked_within(self, timeout: float, failure: str) -> None:
        try:
            await asyncio.wait_for(self._parked.wait(), timeout)
        except asyncio.TimeoutError:
            pytest.fail(f"{failure} within {timeout:.0f}s")


@pytest.fixture
def cleanup_worker_controller(monkeypatch: pytest.MonkeyPatch) -> _DaemonController:
    controller = _DaemonController()
    controller.install(monkeypatch)
    return controller


async def _get_failure(
    db: DbSessionFactory, kind: models.CleanupTargetKind, target_id: int
) -> Optional[models.CleanupFailure]:
    async with db() as session:
        return await session.get(models.CleanupFailure, (kind, target_id))


async def _expire_retries(db: DbSessionFactory) -> None:
    async with db() as session:
        now = await current_database_time(session, SupportedSQLDialect(db.dialect.value))
        await session.execute(update(models.CleanupFailure).values(retry_at=now))


class TestCleanupSchedulingAndBackoff:
    async def test_error_backs_target_off_exponentially_and_progress_clears_failure(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"poison-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(db, error_retry_delay_seconds=10.0)

        async def _boom(*args: object, **kwargs: object) -> object:
            raise OperationalError("SELECT 1", {}, Exception("injected step failure"))

        monkeypatch.setattr(coordinator, "_run_domain_step", _boom)

        recorded: list[tuple[int, float]] = []
        for _ in range(3):
            assert (await coordinator.step()).outcome == "error"
            async with db() as session:
                now = await current_database_time(session, dialect)
                failure = await session.get(models.CleanupFailure, ("PROJECT", project_id))
                assert failure is not None
                recorded.append((failure.failure_count, (failure.retry_at - now).total_seconds()))
            await _expire_retries(db)
            # Until retry_at passes, the backed-off target is skipped and nothing else is due.
        assert [count for count, _ in recorded] == [1, 2, 3]
        assert 5.0 < recorded[0][1] <= 10.0
        assert 15.0 < recorded[1][1] <= 20.0
        assert 30.0 < recorded[2][1] <= 40.0

        monkeypatch.undo()
        assert await _drain_all(coordinator) >= 1
        async with db() as session:
            assert await session.get(models.Project, project_id) is None
        assert await _get_failure(db, "PROJECT", project_id) is None

    async def test_target_is_skipped_until_retry_at_and_worker_learns_the_delay(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"skip-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(db, error_retry_delay_seconds=60.0)

        async def _boom(*args: object, **kwargs: object) -> object:
            raise OperationalError("SELECT 1", {}, Exception("injected step failure"))

        monkeypatch.setattr(coordinator, "_run_domain_step", _boom)
        assert (await coordinator.step()).outcome == "error"
        monkeypatch.undo()

        ran_step, next_delay_seconds = await coordinator.step_or_next_delay()
        assert ran_step is False
        assert next_delay_seconds is not None and 30.0 < next_delay_seconds <= 60.0
        async with db() as session:
            assert await session.get(models.Project, project_id) is not None

        await _expire_retries(db)
        assert (await coordinator.step()).outcome == "completed"
        async with db() as session:
            assert await session.get(models.Project, project_id) is None

    async def test_lock_timeout_deadlock_and_yield_retry_shortly_without_counting_failure(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"contend-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(
            db, error_retry_delay_seconds=10.0, yield_delay_seconds=1.0
        )

        class _LockNotAvailable(Exception):
            sqlstate = "55P03"

        class _DeadlockDetected(Exception):
            sqlstate = "40P01"

        raised: Exception = OperationalError("SELECT 1", {}, Exception("injected step failure"))

        async def _boom(*args: object, **kwargs: object) -> object:
            raise raised

        monkeypatch.setattr(coordinator, "_run_domain_step", _boom)
        assert (await coordinator.step()).outcome == "error"
        await _expire_retries(db)

        async def _retry_state() -> tuple[int, float]:
            async with db() as session:
                now = await current_database_time(session, dialect)
                failure = await session.get(models.CleanupFailure, ("PROJECT", project_id))
                assert failure is not None
                return failure.failure_count, (failure.retry_at - now).total_seconds()

        for raised in (
            DBAPIError("stmt", {}, _LockNotAvailable()),
            DBAPIError("stmt", {}, _DeadlockDetected()),
        ):
            assert (await coordinator.step()).outcome == "yield"
            num_failures, delay_seconds = await _retry_state()
            assert num_failures == 1
            assert delay_seconds <= 1.0
            await _expire_retries(db)

        async def _yield(*args: object, **kwargs: object) -> PrimitiveResult:
            return PrimitiveResult(PrimitiveStatus.YIELD, 0)

        monkeypatch.setattr(coordinator, "_run_domain_step", _yield)
        assert (await coordinator.step()).outcome == "yield"
        num_failures, delay_seconds = await _retry_state()
        assert num_failures == 1
        assert delay_seconds <= 1.0

    async def test_non_sqlalchemy_programming_error_propagates_immediately(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"prog-bug-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(db)

        async def _programming_bug(*args: object, **kwargs: object) -> object:
            raise TypeError("unexpected programming bug")

        monkeypatch.setattr(coordinator, "_run_domain_step", _programming_bug)
        with pytest.raises(TypeError, match="unexpected programming bug"):
            await coordinator.step()
        assert await _get_failure(db, "PROJECT", project_id) is None

    async def test_failed_step_rolls_back_its_batch_and_emits_no_events(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        marker_name = f"rolled-back-{token_hex(4)}"
        async with db() as session:
            project = await _add_project(session, name=f"rollback-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        emitted_events: list[DmlEvent] = []
        event_queue = MagicMock()
        event_queue.put.side_effect = emitted_events.append
        coordinator = CleanupCoordinator(db, event_queue=event_queue)

        async def _fail_after_writing(
            session: Any,
            *,
            dialect: SupportedSQLDialect,
            target: Any,
            events_after_commit: list[DmlEvent],
        ) -> PrimitiveResult:
            session.add(models.Project(name=marker_name))
            await session.flush()
            events_after_commit.append(SpanDeleteEvent((project_id,)))
            raise OperationalError("SELECT 1", {}, Exception("injected step failure"))

        monkeypatch.setattr(coordinator, "_run_domain_step", _fail_after_writing)
        assert (await coordinator.step()).outcome == "error"
        assert emitted_events == []
        async with db() as session:
            marker_project = await session.scalar(
                select(models.Project.id).where(models.Project.name == marker_name)
            )
            assert marker_project is None

    async def test_cancelled_step_rolls_back_and_leaves_the_target_pending(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"cancel-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(db)
        step_started = asyncio.Event()

        async def _hang_in_step(*args: object, **kwargs: object) -> PrimitiveResult:
            step_started.set()
            await asyncio.Event().wait()
            return PrimitiveResult(PrimitiveStatus.EMPTY, 0)

        monkeypatch.setattr(coordinator, "_run_domain_step", _hang_in_step)
        step_task = asyncio.create_task(coordinator.step())
        await asyncio.wait_for(step_started.wait(), timeout=5.0)
        step_task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await step_task
        monkeypatch.undo()

        assert await _get_failure(db, "PROJECT", project_id) is None
        assert (await coordinator.step()).outcome == "completed"
        async with db() as session:
            assert await session.get(models.Project, project_id) is None

    async def test_oldest_tombstone_goes_first(self, db: DbSessionFactory) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            newer = await _add_project(session, name=f"newer-{token_hex(4)}")
            older = await _add_project(session, name=f"older-{token_hex(4)}")
            newer_id, older_id = newer.id, older.id
            await admit_project_delete(session, dialect=dialect, project_id=older_id)
        async with db() as session:
            await admit_project_delete(session, dialect=dialect, project_id=newer_id)

        coordinator = CleanupCoordinator(db)
        assert (await coordinator.step()).outcome == "completed"
        async with db() as session:
            assert await session.get(models.Project, older_id) is None
            assert await session.get(models.Project, newer_id) is not None

    async def test_project_is_not_selected_while_any_binding_references_it(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            trace_project = await _add_project(session, name=f"trace-{token_hex(4)}")
            binding = await _bind_evaluator_trace_project(session, trace_project)
            binding_id, host_id, trace_project_id = (
                binding.id,
                binding.project_id,
                trace_project.id,
            )
            now = await current_database_time(session, dialect)
            await session.execute(
                update(models.Project)
                .where(models.Project.id == trace_project_id)
                .values(deleted_at=now)
            )

        coordinator = CleanupCoordinator(db)
        assert (await coordinator.step()).outcome == "idle"
        async with db() as session:
            assert await session.get(models.Project, trace_project_id) is not None

        async with db() as session:
            await admit_project_delete(session, dialect=dialect, project_id=host_id)
        selected: list[tuple[str, int]] = []
        original_run = coordinator._run_domain_step

        async def _record(
            session: Any,
            *,
            dialect: SupportedSQLDialect,
            target: Any,
            events_after_commit: list[DmlEvent],
        ) -> PrimitiveResult:
            selected.append((target.kind, target.id))
            return await original_run(
                session, dialect=dialect, target=target, events_after_commit=events_after_commit
            )

        coordinator._run_domain_step = _record  # type: ignore[method-assign]
        await _drain_all(coordinator)

        assert ("PROJECT_EVALUATOR", binding_id) in selected
        assert ("PROJECT", trace_project_id) not in selected
        last_binding_step = max(
            index for index, target in enumerate(selected) if target[0] == "PROJECT_EVALUATOR"
        )
        first_host_step = min(
            index for index, target in enumerate(selected) if target == ("PROJECT", host_id)
        )
        assert first_host_step > last_binding_step
        async with db() as session:
            assert await session.get(models.Project, host_id) is None
            assert await session.get(models.Project, trace_project_id) is None
            assert await session.get(models.ProjectEvaluator, binding_id) is None

    async def test_purging_a_target_deletes_its_failure_row(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"purge-{token_hex(4)}")
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        coordinator = CleanupCoordinator(db)
        original_run = coordinator._run_domain_step
        calls = 0

        async def _fail_first(*args: object, **kwargs: Any) -> PrimitiveResult:
            nonlocal calls
            calls += 1
            if calls == 1:
                raise OperationalError("SELECT 1", {}, Exception("injected step failure"))
            return await original_run(*args, **kwargs)  # type: ignore[arg-type]

        monkeypatch.setattr(coordinator, "_run_domain_step", _fail_first)
        assert (await coordinator.step()).outcome == "error"
        assert await _get_failure(db, "PROJECT", project_id) is not None
        await _expire_retries(db)
        await _drain_all(coordinator)
        async with db() as session:
            assert await session.get(models.Project, project_id) is None
        assert await _get_failure(db, "PROJECT", project_id) is None

    async def test_ids_of_purged_targets_are_never_reused(self, db: DbSessionFactory) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        coordinator = CleanupCoordinator(db)

        async with db() as session:
            first = await _add_project(session, name=f"seq-1-{token_hex(4)}")
            first_id = first.id
            await admit_project_delete(session, dialect=dialect, project_id=first_id)
        await _drain_all(coordinator)

        async with db() as session:
            second = await _add_project(session, name=f"seq-2-{token_hex(4)}")
            assert second.id > first_id


class TestImmediateNameReuseAndHistoricalReferences:
    async def test_delete_project_allows_immediate_name_reuse_and_history_follows_the_name(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
    ) -> None:
        shared_name = f"reusable-app-{token_hex(4)}"
        t0 = datetime(2026, 5, 1, 12, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            old_project = await _add_project(session, name=shared_name)
            old_project_id = old_project.id
            for i in range(5):
                trace = await _add_trace(session, old_project, start_time=t0 + timedelta(seconds=i))
                await _add_span(session, trace=trace, start_time=t0 + timedelta(seconds=i))

            dataset = models.Dataset(name=f"ds-{token_hex(4)}", metadata_={})
            session.add(dataset)
            await session.flush()
            version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            session.add(version)
            await session.flush()
            exp = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                name="hist-exp",
                repetitions=1,
                metadata_={},
                project_name=shared_name,
            )
            agent = models.AgentSession(
                title="hist-agent",
                project_name=shared_name,
                model_provider="OPENAI",
                model_name="gpt-4o",
            )
            session.add_all([exp, agent])
            await session.flush()
            exp_id = exp.id
            agent_id = agent.id

        # Delete old_project via GraphQL; cleanup worker has NOT run yet.
        del_resp = await gql_client.execute(
            "mutation($id: ID!) { deleteProject(id: $id) { __typename } }",
            variables={"id": str(GlobalID("Project", str(old_project_id)))},
        )
        assert not del_resp.errors

        # While the old project drains, its tombstone is not what the experiment's name resolves to.
        tombstoned_query = await gql_client.execute(
            """query($id: ID!) {
                node(id: $id) {
                    ... on Experiment { projectName project { id } }
                }
            }""",
            variables={"id": str(GlobalID("Experiment", str(exp_id)))},
        )
        assert tombstoned_query.data and not tombstoned_query.errors
        assert tombstoned_query.data["node"] == {"projectName": shared_name, "project": None}

        # Immediately recreate a new project with the exact same name before old traces are purged.
        create_resp = await gql_client.execute(
            """mutation($input: CreateProjectInput!) {
                createProject(input: $input) { project { id name } }
            }""",
            variables={"input": {"name": shared_name}},
        )
        assert create_resp.data and not create_resp.errors
        new_project_gid = create_resp.data["createProject"]["project"]["id"]
        new_project_id = int(GlobalID.from_id(new_project_gid).node_id)
        assert new_project_id != old_project_id

        # Ingest a span by name — must land on new_project_id, not old_project_id.
        new_span = Span(
            name="live-span",
            context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
            span_kind=SpanKind.LLM,
            parent_id=None,
            start_time=t0 + timedelta(minutes=1),
            end_time=t0 + timedelta(minutes=1, seconds=1),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={},
            events=[],
            conversation=None,
        )
        async with db() as session:
            inserted = await insert_span(session, new_span, shared_name)
        assert inserted is not None
        assert inserted.project_rowid == new_project_id

        # The experiment follows its project name to the live project, not the tombstone.
        exp_query = await gql_client.execute(
            """query($id: ID!) {
                node(id: $id) {
                    ... on Experiment { projectName project { id } }
                }
            }""",
            variables={"id": str(GlobalID("Experiment", str(exp_id)))},
        )
        assert exp_query.data and not exp_query.errors
        assert exp_query.data["node"] == {
            "projectName": shared_name,
            "project": {"id": new_project_gid},
        }

        # Drain background cleanup in small batches (batch_limit=2).
        coordinator = CleanupCoordinator(db, batch_limit=2)
        steps = await _drain_all(coordinator)
        assert steps >= 3

        # Verify old_project and its traces are purged, new_project and its trace survive,
        # and historical Experiment / AgentSession rows survive linked by name.
        async with db() as session:
            assert await session.get(models.Project, old_project_id) is None
            surviving_new = await session.get(models.Project, new_project_id)
            assert surviving_new is not None and surviving_new.deleted_at is None
            new_trace_count = await session.scalar(
                select(func.count(models.Trace.id)).where(
                    models.Trace.project_rowid == new_project_id
                )
            )
            assert new_trace_count == 1
            exp_after = await session.get(models.Experiment, exp_id)
            agent_after = await session.get(models.AgentSession, agent_id)
            assert exp_after is not None
            assert exp_after.project_name == shared_name
            assert agent_after is not None
            assert agent_after.project_name == shared_name


class TestExperimentProjectsResolveByName:
    async def test_admit_exclusive_delete_targets_the_live_project_and_ignores_the_tombstone(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        shared_name = f"Experiment-{token_hex(12)}"
        async with db() as session:
            tombstone = models.Project(
                name=shared_name,
                deleted_at=datetime(2026, 5, 1, tzinfo=timezone.utc),
            )
            live_project = models.Project(name=shared_name)
            session.add_all([tombstone, live_project])
            await session.flush()
            tombstone_id, live_project_id = tombstone.id, live_project.id

            candidate_ids = await resolve_experiment_project_delete_candidates(
                session, candidate_project_names=[shared_name]
            )
            tombstoned_ids = await admit_exclusive_experiment_projects_delete(
                session, dialect=dialect, candidate_project_ids=candidate_ids
            )

            assert tombstoned_ids == [live_project_id]
            assert tombstone_id not in tombstoned_ids
            refreshed = await session.get(models.Project, live_project_id, populate_existing=True)
            assert refreshed is not None and refreshed.deleted_at is not None

    async def test_admit_exclusive_delete_keeps_project_still_named_by_another_experiment(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        shared_name = f"Experiment-{token_hex(12)}"
        async with db() as session:
            dataset = models.Dataset(name=f"ds-{token_hex(4)}", metadata_={})
            session.add(dataset)
            await session.flush()
            version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
            project = models.Project(name=shared_name)
            session.add_all([version, project])
            await session.flush()
            session.add(
                models.Experiment(
                    dataset_id=dataset.id,
                    dataset_version_id=version.id,
                    name="remaining",
                    repetitions=1,
                    metadata_={},
                    project_name=shared_name,
                )
            )
            await session.flush()

            candidate_ids = await resolve_experiment_project_delete_candidates(
                session, candidate_project_names=[shared_name]
            )
            tombstoned_ids = await admit_exclusive_experiment_projects_delete(
                session, dialect=dialect, candidate_project_ids=candidate_ids
            )

            assert tombstoned_ids == []
            refreshed = await session.get(models.Project, project.id, populate_existing=True)
            assert refreshed is not None and refreshed.deleted_at is None


class TestBatchedClear:
    async def test_range_clear_resets_done_session_evaluation_for_surviving_session(
        self, db: DbSessionFactory
    ) -> None:
        t0 = datetime(2026, 6, 2, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            project = await _add_project(session, name=f"sess-clear-{token_hex(4)}")
            trace_proj = models.Project(name=f"eval-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"builtin-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_proj, evaluator])
            await session.flush()
            pe = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_proj.id,
                name=Identifier(root="sess-eval"),
                evaluation_target="SESSION",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(pe)
            await session.flush()

            proj_session = await _add_project_session(session, project, start_time=t0)
            old_trace = await _add_trace(
                session, project, project_session=proj_session, start_time=t0
            )
            await _add_span(session, trace=old_trace, start_time=t0)
            await _add_span(session, trace=old_trace, start_time=t0 + timedelta(seconds=1))
            newer_trace = await _add_trace(
                session,
                project,
                project_session=proj_session,
                start_time=t0 + timedelta(hours=2),
            )
            await _add_span(session, trace=newer_trace, start_time=t0 + timedelta(hours=2))

            target_unit = models.EvalSessionWorkUnit(
                project_session_rowid=proj_session.id,
                project_evaluator_id=pe.id,
                decided_through=t0,
                status="DONE",
                attempts=1,
            )
            session.add(target_unit)
            await session.flush()

            unrelated_session = await _add_project_session(session, project, start_time=t0)
            unrelated_trace = await _add_trace(
                session,
                project,
                project_session=unrelated_session,
                start_time=t0 + timedelta(hours=3),
            )
            await _add_span(session, trace=unrelated_trace, start_time=t0 + timedelta(hours=3))
            unrelated_unit = models.EvalSessionWorkUnit(
                project_session_rowid=unrelated_session.id,
                project_evaluator_id=pe.id,
                decided_through=t0,
                status="DONE",
            )
            session.add(unrelated_unit)
            await session.flush()

        clear_batches = clear_project_traces_in_batches(
            db,
            project_id=project.id,
            start_time=t0 - timedelta(minutes=1),
            end_time=t0 + timedelta(hours=1),
            batch_limit=1,
        )
        first_batch = await anext(clear_batches)
        assert first_batch.status == "PROGRESS" and first_batch.num_affected_rows == 1
        async with db() as session:
            # Session ledger is not reset until old_trace's spans have all been drained.
            assert (
                await session.scalar(
                    select(models.EvalSessionWorkUnit.status).where(
                        models.EvalSessionWorkUnit.id == target_unit.id
                    )
                )
                == "DONE"
            )
        remaining_batches = [batch async for batch in clear_batches]
        assert remaining_batches[-1].status == "COMPLETE"

        async with db() as session:
            # Session survives because newer_trace is outside [start_time, end_time),
            # and its DONE EvalSessionWorkUnit was transitioned to DROPPED so future turns
            # can re-evaluate.
            assert await session.get(models.ProjectSession, proj_session.id) is not None
            assert await session.get(models.Trace, old_trace.id) is None
            assert await session.get(models.Trace, newer_trace.id) is not None
            remaining_statuses = (
                await session.scalars(
                    select(models.EvalSessionWorkUnit.status).where(
                        models.EvalSessionWorkUnit.project_session_rowid == proj_session.id
                    )
                )
            ).all()
            assert remaining_statuses == ["DROPPED"]
            assert (
                await session.scalar(
                    select(models.EvalSessionWorkUnit.status).where(
                        models.EvalSessionWorkUnit.id == unrelated_unit.id
                    )
                )
                == "DONE"
            )

    async def test_range_clear_resets_final_session_decisions_while_preserving_queued_work(
        self, db: DbSessionFactory
    ) -> None:
        base_time = datetime(2026, 6, 2, 6, 0, 0, tzinfo=timezone.utc)
        final_decision_statuses: tuple[models.EvalWorkStatus, ...] = (
            "DONE",
            "FILTERED_OUT",
            "SAMPLED_OUT",
        )
        final_unit_ids: list[int] = []
        cleared_trace_ids: list[int] = []
        surviving_trace_ids: list[int] = []
        surviving_session_ids: list[int] = []

        async with db() as session:
            project = await _add_project(session, name=f"sess-contract-clear-{token_hex(4)}")
            trace_project = models.Project(name=f"eval-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"builtin-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_project, evaluator])
            await session.flush()
            session_binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_project.id,
                name=Identifier(root="sess-eval"),
                evaluation_target="SESSION",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(session_binding)
            await session.flush()

            for final_status in final_decision_statuses:
                final_session = await _add_project_session(session, project, start_time=base_time)
                cleared_final_trace = await _add_trace(
                    session, project, project_session=final_session, start_time=base_time
                )
                await _add_span(session, trace=cleared_final_trace, start_time=base_time)
                surviving_final_trace = await _add_trace(
                    session,
                    project,
                    project_session=final_session,
                    start_time=base_time + timedelta(hours=2),
                )
                await _add_span(
                    session,
                    trace=surviving_final_trace,
                    start_time=base_time + timedelta(hours=2),
                )
                final_unit = models.EvalSessionWorkUnit(
                    project_session_rowid=final_session.id,
                    project_evaluator_id=session_binding.id,
                    decided_through=base_time + timedelta(hours=2),
                    status=final_status,
                    attempts=1 if final_status == "DONE" else 0,
                )
                session.add(final_unit)
                await session.flush()
                final_unit_ids.append(final_unit.id)
                cleared_trace_ids.append(cleared_final_trace.id)
                surviving_trace_ids.append(surviving_final_trace.id)
                surviving_session_ids.append(final_session.id)

            running_session = await _add_project_session(session, project, start_time=base_time)
            cleared_running_trace = await _add_trace(
                session, project, project_session=running_session, start_time=base_time
            )
            await _add_span(session, trace=cleared_running_trace, start_time=base_time)
            surviving_running_trace = await _add_trace(
                session,
                project,
                project_session=running_session,
                start_time=base_time + timedelta(hours=2),
            )
            await _add_span(
                session,
                trace=surviving_running_trace,
                start_time=base_time + timedelta(hours=2),
            )
            running_unit = models.EvalSessionWorkUnit(
                project_session_rowid=running_session.id,
                project_evaluator_id=session_binding.id,
                decided_through=base_time + timedelta(hours=2),
                status="PENDING",
                attempts=0,
            )
            session.add(running_unit)
            await session.flush()

            project_id = project.id
            session_binding_id = session_binding.id
            running_session_id = running_session.id
            running_unit_id = running_unit.id
            cleared_trace_ids.append(cleared_running_trace.id)
            surviving_trace_ids.append(surviving_running_trace.id)
            surviving_session_ids.append(running_session.id)

        work_coordinator = EvalWorkCoordinator(db, evaluation_target="SESSION")
        (claimed_unit,) = await work_coordinator.claim(claimed_by="session-worker", limit=1)
        assert claimed_unit.work_unit_id == running_unit_id

        async with db() as session:
            live_project = await session.get(models.Project, project_id)
            assert live_project is not None

            pending_session = await _add_project_session(
                session, live_project, start_time=base_time
            )
            cleared_pending_trace = await _add_trace(
                session, live_project, project_session=pending_session, start_time=base_time
            )
            await _add_span(session, trace=cleared_pending_trace, start_time=base_time)
            surviving_pending_trace = await _add_trace(
                session,
                live_project,
                project_session=pending_session,
                start_time=base_time + timedelta(hours=2),
            )
            await _add_span(
                session,
                trace=surviving_pending_trace,
                start_time=base_time + timedelta(hours=2),
            )
            pending_unit = models.EvalSessionWorkUnit(
                project_session_rowid=pending_session.id,
                project_evaluator_id=session_binding_id,
                decided_through=base_time + timedelta(hours=2),
                status="PENDING",
                attempts=0,
            )

            error_session = await _add_project_session(session, live_project, start_time=base_time)
            cleared_error_trace = await _add_trace(
                session, live_project, project_session=error_session, start_time=base_time
            )
            await _add_span(session, trace=cleared_error_trace, start_time=base_time)
            surviving_error_trace = await _add_trace(
                session,
                live_project,
                project_session=error_session,
                start_time=base_time + timedelta(hours=2),
            )
            await _add_span(
                session,
                trace=surviving_error_trace,
                start_time=base_time + timedelta(hours=2),
            )
            expected_cooldown_until = base_time + timedelta(minutes=5)
            error_unit = models.EvalSessionWorkUnit(
                project_session_rowid=error_session.id,
                project_evaluator_id=session_binding_id,
                decided_through=base_time + timedelta(hours=2),
                status="ERROR",
                claimed_at=base_time,
                claimed_by="prior-worker",
                cooldown_until=expected_cooldown_until,
                attempts=1,
                error="transient timeout",
            )
            session.add_all([pending_unit, error_unit])
            await session.flush()
            pending_unit_id = pending_unit.id
            error_unit_id = error_unit.id
            cleared_trace_ids.extend([cleared_pending_trace.id, cleared_error_trace.id])
            surviving_trace_ids.extend([surviving_pending_trace.id, surviving_error_trace.id])
            surviving_session_ids.extend([pending_session.id, error_session.id])

        await _clear_project(
            db,
            project_id,
            start_time=base_time - timedelta(minutes=1),
            end_time=base_time + timedelta(hours=1),
            batch_limit=2,
        )

        async with db() as session:
            for cleared_trace_id in cleared_trace_ids:
                assert await session.get(models.Trace, cleared_trace_id) is None
            for surviving_trace_id in surviving_trace_ids:
                assert await session.get(models.Trace, surviving_trace_id) is not None
            for surviving_session_id in surviving_session_ids:
                assert await session.get(models.ProjectSession, surviving_session_id) is not None

            final_statuses_after_clear = list(
                await session.scalars(
                    select(models.EvalSessionWorkUnit.status)
                    .where(models.EvalSessionWorkUnit.id.in_(final_unit_ids))
                    .order_by(models.EvalSessionWorkUnit.id.asc())
                )
            )
            assert final_statuses_after_clear == ["DROPPED"] * len(final_unit_ids)

            loaded_running_unit = await session.get(models.EvalSessionWorkUnit, running_unit_id)
            assert loaded_running_unit is not None
            assert loaded_running_unit.status == "RUNNING"
            assert loaded_running_unit.claimed_by == "session-worker"
            assert loaded_running_unit.claimed_at is not None

            loaded_pending_unit = await session.get(models.EvalSessionWorkUnit, pending_unit_id)
            assert loaded_pending_unit is not None
            assert loaded_pending_unit.status == "PENDING"
            assert loaded_pending_unit.attempts == 0

            loaded_error_unit = await session.get(models.EvalSessionWorkUnit, error_unit_id)
            assert loaded_error_unit is not None
            assert loaded_error_unit.status == "ERROR"
            assert loaded_error_unit.claimed_by == "prior-worker"
            assert loaded_error_unit.claimed_at == base_time
            assert loaded_error_unit.cooldown_until == expected_cooldown_until
            assert loaded_error_unit.attempts == 1
            assert loaded_error_unit.error == "transient timeout"

        async def _write_surviving_annotation(publish_session: AsyncSession) -> None:
            publish_session.add(
                models.ProjectSessionAnnotation(
                    project_session_id=running_session_id,
                    name="sess-eval",
                    label="pass",
                    score=1.0,
                    explanation="evaluated surviving session",
                    metadata_={},
                    annotator_kind="CODE",
                    source="API",
                    identifier="online:surviving",
                )
            )

        await work_coordinator.publish(
            work_unit_id=claimed_unit.work_unit_id,
            claimed_by=claimed_unit.claimed_by,
            project_evaluator_id=session_binding_id,
            write=_write_surviving_annotation,
        )

        async with db() as session:
            published_unit = await session.get(models.EvalSessionWorkUnit, running_unit_id)
            assert published_unit is not None
            assert published_unit.status == "DONE"
            num_annotations = await session.scalar(
                select(func.count(models.ProjectSessionAnnotation.id)).where(
                    models.ProjectSessionAnnotation.project_session_id == running_session_id
                )
            )
            assert num_annotations == 1

    async def test_range_clear_deletes_span_drained_trace_in_same_step_as_session_reset(
        self, db: DbSessionFactory
    ) -> None:
        base_time = datetime(2026, 6, 2, 8, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            project = await _add_project(session, name=f"sess-atomic-clear-{token_hex(4)}")
            trace_project = models.Project(name=f"eval-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"builtin-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_project, evaluator])
            await session.flush()
            session_binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_project.id,
                name=Identifier(root="sess-eval"),
                evaluation_target="SESSION",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(session_binding)
            await session.flush()

            project_session = await _add_project_session(session, project, start_time=base_time)
            cleared_trace = await _add_trace(
                session, project, project_session=project_session, start_time=base_time
            )
            await _add_span(session, trace=cleared_trace, start_time=base_time)
            surviving_trace = await _add_trace(
                session,
                project,
                project_session=project_session,
                start_time=base_time + timedelta(hours=2),
            )
            await _add_span(
                session,
                trace=surviving_trace,
                start_time=base_time + timedelta(hours=2),
            )
            session_unit = models.EvalSessionWorkUnit(
                project_session_rowid=project_session.id,
                project_evaluator_id=session_binding.id,
                decided_through=base_time + timedelta(hours=2),
                status="DONE",
                attempts=1,
            )
            session.add(session_unit)
            await session.flush()

            cleared_trace_id = cleared_trace.id
            session_unit_id = session_unit.id

        clear_batches = clear_project_traces_in_batches(
            db,
            project_id=project.id,
            start_time=base_time - timedelta(minutes=1),
            end_time=base_time + timedelta(hours=1),
            batch_limit=10,
        )
        first_batch = await anext(clear_batches)
        assert first_batch.status == "PROGRESS" and first_batch.num_affected_rows == 1
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.EvalSessionWorkUnit.status).where(
                        models.EvalSessionWorkUnit.id == session_unit_id
                    )
                )
                == "DONE"
            )
        second_batch = await anext(clear_batches)
        assert second_batch.status == "PROGRESS"
        async with db() as session:
            assert (
                await session.scalar(
                    select(models.EvalSessionWorkUnit.status).where(
                        models.EvalSessionWorkUnit.id == session_unit_id
                    )
                )
                == "DROPPED"
            )
            assert await session.get(models.Trace, cleared_trace_id) is None
        assert [batch async for batch in clear_batches][-1].status == "COMPLETE"

    async def test_empty_range_clear_leaves_surviving_session_evaluations_intact(
        self, db: DbSessionFactory
    ) -> None:
        t0 = datetime(2026, 6, 2, 12, 0, 0, tzinfo=timezone.utc)
        expected_statuses: dict[int, models.EvalWorkStatus] = {}

        async with db() as session:
            project = await _add_project(session, name=f"empty-range-clear-{token_hex(4)}")
            trace_project = models.Project(name=f"eval-trace-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"bi-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_project, evaluator])
            await session.flush()
            binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_project.id,
                name=Identifier(root="sess-eval"),
                evaluation_target="SESSION",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(binding)
            await session.flush()

            resettable_statuses: tuple[models.EvalWorkStatus, ...] = (
                "DONE",
                "FILTERED_OUT",
                "SAMPLED_OUT",
            )
            for offset, status in enumerate(resettable_statuses):
                project_session = await _add_project_session(
                    session, project, start_time=t0 + timedelta(hours=offset + 2)
                )
                trace = await _add_trace(
                    session,
                    project,
                    project_session=project_session,
                    start_time=t0 + timedelta(hours=offset + 2),
                )
                await _add_span(
                    session,
                    trace=trace,
                    start_time=t0 + timedelta(hours=offset + 2),
                )
                unit = models.EvalSessionWorkUnit(
                    project_session_rowid=project_session.id,
                    project_evaluator_id=binding.id,
                    decided_through=t0 + timedelta(hours=offset + 2),
                    status=status,
                )
                session.add(unit)
                await session.flush()
                expected_statuses[unit.id] = status

        await _clear_project(
            db,
            project.id,
            start_time=t0 - timedelta(hours=2),
            end_time=t0 - timedelta(hours=1),
            batch_limit=2,
        )

        async with db() as session:
            rows = (
                await session.execute(
                    select(
                        models.EvalSessionWorkUnit.id,
                        models.EvalSessionWorkUnit.status,
                    ).where(models.EvalSessionWorkUnit.id.in_(expected_statuses))
                )
            ).all()
            assert {row.id: row.status for row in rows} == expected_statuses

    async def test_clear_preserves_shared_session_and_annotations_when_other_project_is_tombstoned(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        base_time = datetime(2026, 6, 4, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            live_project = await _add_project(session, name=f"live-clear-{token_hex(4)}")
            tombstoned_project = await _add_project(
                session, name=f"tombstoned-other-{token_hex(4)}"
            )
            shared_session = await _add_project_session(
                session,
                live_project,
                session_id=f"shared-clear-{token_hex(4)}",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=5),
            )
            session_annotation = models.ProjectSessionAnnotation(
                project_session_id=shared_session.id,
                name="session-quality",
                label="good",
                score=1.0,
                explanation="keep on live project",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
            session.add(session_annotation)
            await session.flush()

            cleared_trace = await _add_trace(
                session,
                live_project,
                project_session=shared_session,
                start_time=base_time,
            )
            await _add_span(session, trace=cleared_trace, start_time=base_time)

            other_trace = await _add_trace(
                session,
                tombstoned_project,
                project_session=shared_session,
                start_time=base_time + timedelta(minutes=1),
            )
            await _add_span(
                session,
                trace=other_trace,
                start_time=base_time + timedelta(minutes=1),
            )

            live_project_id = live_project.id
            tombstoned_project_id = tombstoned_project.id
            shared_session_id = shared_session.id
            annotation_id = session_annotation.id
            cleared_trace_id = cleared_trace.id
            other_trace_id = other_trace.id

            await admit_project_delete(session, dialect=dialect, project_id=tombstoned_project_id)

        await _clear_project(db, live_project_id, batch_limit=1)
        coordinator = CleanupCoordinator(db, batch_limit=1)
        async with db() as session:
            owner_after_clear = await session.scalar(
                select(models.ProjectSession.project_id).where(
                    models.ProjectSession.id == shared_session_id
                )
            )
        await _drain_all(coordinator)

        async with db() as session:
            assert await session.get(models.Project, tombstoned_project_id) is None
            assert await session.get(models.Trace, cleared_trace_id) is None
            assert await session.get(models.Trace, other_trace_id) is None
            surviving_project = await session.get(models.Project, live_project_id)
            assert surviving_project is not None and surviving_project.deleted_at is None
            surviving_session = await session.get(models.ProjectSession, shared_session_id)
            surviving_annotation = await session.get(models.ProjectSessionAnnotation, annotation_id)
            assert (
                owner_after_clear,
                surviving_session is not None,
                surviving_annotation is not None,
            ) == (live_project_id, True, True)
            assert surviving_session is not None
            assert surviving_session.project_id == live_project_id
            assert surviving_annotation is not None

    async def test_clear_does_not_transfer_shared_session_to_live_other_project(
        self, db: DbSessionFactory
    ) -> None:
        base_time = datetime(2026, 6, 5, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            live_project = await _add_project(session, name=f"live-owner-{token_hex(4)}")
            other_live_project = await _add_project(session, name=f"live-other-{token_hex(4)}")
            shared_session = await _add_project_session(
                session,
                live_project,
                session_id=f"shared-live-{token_hex(4)}",
                start_time=base_time,
                end_time=base_time + timedelta(minutes=5),
            )
            session_annotation = models.ProjectSessionAnnotation(
                project_session_id=shared_session.id,
                name="session-quality",
                label="good",
                score=1.0,
                explanation="remains owned by live_project",
                metadata_={},
                annotator_kind="HUMAN",
                source="APP",
                identifier="",
            )
            session.add(session_annotation)
            await session.flush()

            cleared_trace = await _add_trace(
                session,
                live_project,
                project_session=shared_session,
                start_time=base_time,
            )
            await _add_span(session, trace=cleared_trace, start_time=base_time)

            other_trace = await _add_trace(
                session,
                other_live_project,
                project_session=shared_session,
                start_time=base_time + timedelta(minutes=1),
            )
            await _add_span(
                session,
                trace=other_trace,
                start_time=base_time + timedelta(minutes=1),
            )

            live_project_id = live_project.id
            shared_session_id = shared_session.id
            annotation_id = session_annotation.id
            cleared_trace_id = cleared_trace.id
            other_trace_id = other_trace.id

        await _clear_project(db, live_project_id, batch_limit=1)

        async with db() as session:
            assert await session.get(models.Trace, cleared_trace_id) is None
            assert await session.get(models.Trace, other_trace_id) is not None
            surviving_session = await session.get(models.ProjectSession, shared_session_id)
            assert surviving_session is not None
            assert surviving_session.project_id == live_project_id
            assert await session.get(models.ProjectSessionAnnotation, annotation_id) is not None

    async def test_clear_deletes_bounded_range_in_committed_batches_and_emits_events(
        self, db: DbSessionFactory
    ) -> None:
        t0 = datetime(2026, 6, 6, 0, 0, 0, tzinfo=timezone.utc)
        async with db() as session:
            project = await _add_project(session, name=f"batched-clear-{token_hex(4)}")
            boundary_session = await _add_project_session(session, project, start_time=t0)
            emptied_session = await _add_project_session(session, project, start_time=t0)
            trace_ids: list[int] = []
            for offset in range(6):
                trace = await _add_trace(
                    session,
                    project,
                    project_session=boundary_session if offset in (0, 5) else emptied_session,
                    start_time=t0 + timedelta(minutes=offset),
                )
                await _add_span(session, trace=trace, start_time=t0 + timedelta(minutes=offset))
                trace_ids.append(trace.id)
            project_id = project.id
            boundary_session_id = boundary_session.id
            emptied_session_id = emptied_session.id

        emitted_events: list[DmlEvent] = []

        class _RecordingQueue:
            def put(self, item: DmlEvent) -> None:
                emitted_events.append(item)

        batches = [
            batch
            async for batch in clear_project_traces_in_batches(
                db,
                project_id=project_id,
                start_time=t0 + timedelta(minutes=1),
                end_time=t0 + timedelta(minutes=5),
                event_queue=_RecordingQueue(),
                batch_limit=1,
            )
        ]

        num_progress_batches = sum(batch.status == "PROGRESS" for batch in batches)
        assert num_progress_batches > 4
        assert batches[-1].status == "COMPLETE"
        assert emitted_events == [SpanDeleteEvent((project_id,))] * num_progress_batches
        async with db() as session:
            surviving_trace_ids = set(
                await session.scalars(
                    select(models.Trace.id).where(models.Trace.project_rowid == project_id)
                )
            )
            assert surviving_trace_ids == {trace_ids[0], trace_ids[5]}
            assert await session.get(models.ProjectSession, boundary_session_id) is not None
            assert await session.get(models.ProjectSession, emptied_session_id) is None

    async def test_clear_stops_when_project_is_tombstoned_between_batches(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        t0 = datetime(2026, 6, 7, 0, 0, 0, tzinfo=timezone.utc)
        async with db() as session:
            project = await _add_project(session, name=f"tombstoned-clear-{token_hex(4)}")
            span_ids: list[int] = []
            for offset in range(3):
                trace = await _add_trace(
                    session, project, start_time=t0 + timedelta(minutes=offset)
                )
                span = await _add_span(
                    session, trace=trace, start_time=t0 + timedelta(minutes=offset)
                )
                span_ids.append(span.id)
            project_id = project.id

        clear_batches = clear_project_traces_in_batches(db, project_id=project_id, batch_limit=1)
        first_batch = await anext(clear_batches)
        assert first_batch.status == "PROGRESS"
        async with db() as session:
            await admit_project_delete(session, dialect=dialect, project_id=project_id)
        remaining_batches = [batch async for batch in clear_batches]

        assert [batch.status for batch in remaining_batches] == ["PROJECT_DELETED"]
        async with db() as session:
            assert await session.get(models.Span, span_ids[0]) is None
            assert await session.get(models.Span, span_ids[1]) is not None
            assert await session.get(models.Span, span_ids[2]) is not None

    async def test_clear_rejects_missing_tombstoned_and_evaluator_projects(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            tombstoned_project = await _add_project(session, name=f"gone-{token_hex(4)}")
            evaluator_project = models.Project(name=f"eval-sink-{token_hex(4)}")
            session.add(evaluator_project)
            await session.flush()
            await _bind_evaluator_trace_project(session, evaluator_project)
            await admit_project_delete(session, dialect=dialect, project_id=tombstoned_project.id)
            tombstoned_project_id = tombstoned_project.id
            evaluator_project_id = evaluator_project.id

        for missing_project_id in (tombstoned_project_id, 999_999):
            with pytest.raises(NotFound):
                await _clear_project(db, missing_project_id)
        with pytest.raises(Conflict, match="evaluator's traces"):
            await _clear_project(db, evaluator_project_id)


class TestOnlineEvalFences:
    async def test_online_eval_fences_tombstoned_binding_on_hydration_publish_and_traces(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"oe-{token_hex(4)}")
            trace_proj = models.Project(name=f"oe-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"oe-bi-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_proj, evaluator])
            await session.flush()
            pe = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_proj.id,
                name=Identifier(root="oe-eval"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
                enabled=True,
                tracing_enabled=True,
            )
            session.add(pe)
            await session.flush()
            trace = await _add_trace(session, project)
            span = await _add_span(session, trace=trace)
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span.id,
                    project_evaluator_id=pe.id,
                    status="PENDING",
                    attempts=0,
                )
            )
            await session.flush()

        work_coord = EvalWorkCoordinator(db, evaluation_target="SPAN")
        claimed_units = await work_coord.claim(claimed_by="worker-1", limit=10)
        assert len(claimed_units) == 1
        unit = claimed_units[0]

        # Tombstone the binding while `unit` is already claimed in RUNNING state.
        async with db() as session:
            await logical_delete_project_evaluators(
                session,
                dialect=dialect,
                binding_ids=[pe.id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )

        # 1. Hydration returns HydrationFailure(terminal_status='DROPPED') so consumer clears it.
        executor = OnlineEvalExecutor(
            db,
            evaluation_target="SPAN",
            coordinator=work_coord,
            decrypt=lambda b: b,
        )
        outcomes = await executor.hydrate_configuration_snapshots([unit])
        assert len(outcomes) == 1
        assert isinstance(outcomes[0], HydrationFailure)
        assert outcomes[0].terminal_status == "DROPPED"

        # 2. publish() rejects tombstoned binding with PublicationEvaluatorDisabledError.
        wrote = False

        async def _write(_session: object) -> None:
            nonlocal wrote
            wrote = True

        with pytest.raises(PublicationEvaluatorDisabledError):
            await work_coord.publish(
                work_unit_id=unit.work_unit_id,
                claimed_by=unit.claimed_by,
                project_evaluator_id=pe.id,
                write=_write,
            )
        assert wrote is False

        # 3. persist_evaluator_traces drops spans when the binding is tombstoned.
        tracer = marked_evaluator_tracer(
            Tracer(span_cost_calculator=cast(Any, MagicMock())),
            project_evaluator_rowid=pe.id,
            project_evaluator_name="oe-eval",
        )
        with tracer.start_as_current_span("eval-call"):
            pass
        await persist_evaluator_traces(db=db, tracer=tracer, project_evaluator_id=pe.id)
        async with db() as session:
            trace_sink_count = await session.scalar(
                select(func.count(models.Trace.id)).where(
                    models.Trace.project_rowid == trace_proj.id
                )
            )
            assert trace_sink_count == 0

    async def test_recover_lapsed_claims_ignores_tombstoned_project_evaluator(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        increments: Counter[tuple[str, str]] = Counter()

        def counter_labels(*, evaluation_target: str, outcome: str) -> SimpleNamespace:
            key = (evaluation_target, outcome)
            return SimpleNamespace(inc=lambda count=1: increments.update({key: count}))

        def lag_labels(*, evaluation_target: str, outcome: str) -> SimpleNamespace:
            return SimpleNamespace(observe=lambda _seconds: None)

        monkeypatch.setattr(
            online_eval_coordinator_module, "get_env_enable_prometheus", lambda: True
        )
        monkeypatch.setattr(
            online_eval_coordinator_module,
            "ONLINE_EVAL_COMPLETED_WORK_UNITS",
            SimpleNamespace(labels=counter_labels),
        )
        monkeypatch.setattr(
            online_eval_coordinator_module,
            "ONLINE_EVAL_QUEUE_TO_RESULT_SECONDS",
            SimpleNamespace(labels=lag_labels),
        )

        async with db() as session:
            database_now = await current_database_time(session, dialect)
            lapsed_claimed_at = database_now - timedelta(seconds=CLAIM_LEASE_TTL_SECONDS + 1)
            project = await _add_project(session, name=f"oe-lapsed-{token_hex(4)}")
            tombstoned_sink = models.Project(name=f"oe-tomb-sink-{token_hex(4)}")
            live_sink = models.Project(name=f"oe-live-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"oe-lapsed-bi-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([tombstoned_sink, live_sink, evaluator])
            await session.flush()

            tombstoned_binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=tombstoned_sink.id,
                name=Identifier(root="tombstoned-eval"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
                enabled=True,
            )
            live_binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=live_sink.id,
                name=Identifier(root="live-eval"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
                enabled=True,
            )
            session.add_all([tombstoned_binding, live_binding])
            await session.flush()

            trace = await _add_trace(session, project)
            span = await _add_span(session, trace=trace)
            tombstoned_unit = models.EvalWorkUnit(
                span_rowid=span.id,
                project_evaluator_id=tombstoned_binding.id,
                status="RUNNING",
                claimed_at=lapsed_claimed_at,
                claimed_by="crashed-worker",
                attempts=MAX_ATTEMPTS - 1,
            )
            live_unit = models.EvalWorkUnit(
                span_rowid=span.id,
                project_evaluator_id=live_binding.id,
                status="RUNNING",
                claimed_at=lapsed_claimed_at,
                claimed_by="crashed-worker",
                attempts=MAX_ATTEMPTS - 1,
            )
            session.add_all([tombstoned_unit, live_unit])
            await session.flush()

            tombstoned_binding_id = tombstoned_binding.id
            tombstoned_unit_id = tombstoned_unit.id
            live_unit_id = live_unit.id

            await logical_delete_project_evaluators(
                session,
                dialect=dialect,
                binding_ids=[tombstoned_binding_id],
                collect_unused_evaluator=False,
                delete_associated_prompt=False,
            )

        work_coordinator = EvalWorkCoordinator(db, evaluation_target="SPAN")
        assert await work_coordinator.claim(claimed_by="worker-2", limit=10) == []
        assert increments == {("SPAN", "failed"): 1}

        async with db() as session:
            database_now = await current_database_time(session, dialect)
            assert (
                await recover_lapsed_claims(
                    session,
                    models.EvalWorkUnit,
                    now=database_now,
                    max_attempts=MAX_ATTEMPTS,
                )
                == []
            )
            loaded_tombstoned_unit = await session.get(models.EvalWorkUnit, tombstoned_unit_id)
            loaded_live_unit = await session.get(models.EvalWorkUnit, live_unit_id)
            assert loaded_tombstoned_unit is not None
            assert loaded_tombstoned_unit.status == "RUNNING"
            assert loaded_live_unit is not None
            assert loaded_live_unit.status == "FAILED"

        await _drain_all(CleanupCoordinator(db))
        async with db() as session:
            assert await session.get(models.EvalWorkUnit, tombstoned_unit_id) is None
            assert await session.get(models.ProjectEvaluator, tombstoned_binding_id) is None


class TestStorageLockoutExemptionsAndCleanupWorker:
    async def test_deletions_and_cleanup_worker_succeed_under_storage_lockout(
        self,
        db: DbSessionFactory,
        gql_client: AsyncGraphQLClient,
        httpx_client: httpx2.AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        t0 = datetime(2026, 7, 1, 0, 0, 0, tzinfo=timezone.utc)
        async with db() as session:
            proj = await _add_project(session, name=f"locked-proj-{token_hex(4)}")
            tr = await _add_trace(session, proj, start_time=t0)
            sp = await _add_span(session, trace=tr, start_time=t0)
            trace_proj = models.Project(name=f"locked-sink-{token_hex(4)}")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"locked-bi-{token_hex(4)}"),
                kind="BUILTIN",
                key=token_hex(8),
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_proj, evaluator])
            await session.flush()
            pe = models.ProjectEvaluator(
                project_id=proj.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_proj.id,
                name=Identifier(root="locked-eval"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(pe)
            await session.flush()
            proj_id = proj.id
            pe_id = pe.id
            span_id_str = sp.span_id

        # Simulate storage-capacity lockout!
        monkeypatch.setattr(db, "should_not_insert_or_update", True)

        # 1. REST DELETE /v1/spans/{span_identifier} succeeds under storage lockout.
        span_del = await httpx_client.delete(f"v1/spans/{span_id_str}")
        assert span_del.status_code == 204

        # 2. GraphQL deleteProjectEvaluators succeeds under storage lockout.
        pe_del = await gql_client.execute(
            """mutation($input: DeleteProjectEvaluatorsInput!) {
                deleteProjectEvaluators(input: $input) { projectEvaluatorIds }
            }""",
            variables={
                "input": {"projectEvaluatorIds": [str(GlobalID("ProjectEvaluator", str(pe_id)))]}
            },
        )
        assert pe_del.data and not pe_del.errors

        # 3. GraphQL deleteProject succeeds under storage lockout.
        proj_del = await gql_client.execute(
            "mutation($id: ID!) { deleteProject(id: $id) { __typename } }",
            variables={"id": str(GlobalID("Project", str(proj_id)))},
        )
        assert not proj_del.errors

        # 4. CleanupCoordinator drains everything even while should_not_insert_or_update is True.
        coordinator = CleanupCoordinator(db)
        assert await _drain_all(coordinator) >= 2
        async with db() as session:
            assert await session.get(models.Project, proj_id) is None
            assert await session.get(models.ProjectEvaluator, pe_id) is None

    @pytest.mark.real_cleanup_worker
    async def test_live_cleanup_worker_wakes_and_drains(
        self,
        db: DbSessionFactory,
        cleanup_worker_controller: _DaemonController,
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        worker = CleanupWorker(db, idle_poll_seconds=10.0)
        async with worker:
            await cleanup_worker_controller.wait_until_parked()
            async with db() as session:
                project = await _add_project(session, name=f"daemon-proj-{token_hex(4)}")
                trace = await _add_trace(session, project)
                await _add_span(session, trace=trace)
                project_id = project.id
                await admit_project_delete(session, dialect=dialect, project_id=project_id)

            async with cleanup_worker_controller.expect_wake_cycle():
                worker.wake()

        async with db() as session:
            assert await session.get(models.Project, project_id) is None

    @pytest.mark.real_cleanup_worker
    async def test_cleanup_worker_sleeps_for_yield_delay_rather_than_idle_poll(
        self,
        db: DbSessionFactory,
        cleanup_worker_controller: _DaemonController,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"yield-proj-{token_hex(4)}")
            trace = await _add_trace(session, project)
            await _add_span(session, trace=trace)
            project_id = project.id
            await admit_project_delete(session, dialect=dialect, project_id=project_id)

        worker = CleanupWorker(db, idle_poll_seconds=30.0)
        original_run_domain_step = worker.coordinator._run_domain_step
        yielded_once = False

        async def _yield_then_run(*args: Any, **kwargs: Any) -> PrimitiveResult:
            nonlocal yielded_once
            if not yielded_once:
                yielded_once = True
                return PrimitiveResult(PrimitiveStatus.YIELD, 0)
            return await original_run_domain_step(*args, **kwargs)

        monkeypatch.setattr(worker.coordinator, "_run_domain_step", _yield_then_run)

        async with worker:
            await cleanup_worker_controller.wait_until_parked()
            assert len(cleanup_worker_controller.sleep_delays) == 1
            first_delay = cleanup_worker_controller.sleep_delays[0]
            assert first_delay is not None
            assert 0.0 < first_delay <= 0.5

            await _expire_retries(db)

            await cleanup_worker_controller.run_once()
            assert len(cleanup_worker_controller.sleep_delays) == 2
            second_delay = cleanup_worker_controller.sleep_delays[1]
            assert second_delay is not None
            assert second_delay >= 29.0

        async with db() as session:
            assert await session.get(models.Project, project_id) is None

        worker.wake()
        await asyncio.wait_for(cleanup_worker_controller.original_sleep(worker, 30.0), timeout=1.0)
        worker._woken.clear()
        await asyncio.wait_for(cleanup_worker_controller.original_sleep(worker, 0.01), timeout=1.0)

    @pytest.mark.real_cleanup_worker
    async def test_api_mutations_wake_lifespan_cleanup_worker(
        self,
        db: DbSessionFactory,
        cleanup_worker_controller: _DaemonController,
        gql_client: AsyncGraphQLClient,
        httpx_client: httpx2.AsyncClient,
    ) -> None:
        async with db() as session:
            clear_project = await _add_project(session, name=f"api-clear-{token_hex(4)}")
            clear_trace = await _add_trace(session, clear_project)
            await _add_span(session, trace=clear_trace)

            gql_delete_project = await _add_project(session, name=f"api-gql-del-{token_hex(4)}")
            gql_trace = await _add_trace(session, gql_delete_project)
            await _add_span(session, trace=gql_trace)

            rest_delete_project = await _add_project(session, name=f"api-rest-del-{token_hex(4)}")
            rest_trace = await _add_trace(session, rest_delete_project)
            await _add_span(session, trace=rest_trace)

            clear_project_id = clear_project.id
            clear_trace_id = clear_trace.id
            gql_delete_project_id = gql_delete_project.id
            rest_delete_project_id = rest_delete_project.id
            rest_delete_project_name = rest_delete_project.name

        clear_resp = await gql_client.execute(
            """mutation($input: ClearProjectInput!) {
                clearProject(input: $input) { __typename }
            }""",
            variables={"input": {"id": str(GlobalID("Project", str(clear_project_id)))}},
        )
        assert clear_resp.data and not clear_resp.errors

        async with db() as session:
            assert await session.get(models.Trace, clear_trace_id) is None
            surviving_project = await session.get(models.Project, clear_project_id)
            assert surviving_project is not None and surviving_project.deleted_at is None

        async with cleanup_worker_controller.expect_wake_cycle():
            del_resp = await gql_client.execute(
                "mutation($id: ID!) { deleteProject(id: $id) { __typename } }",
                variables={"id": str(GlobalID("Project", str(gql_delete_project_id)))},
            )
            assert del_resp.data and not del_resp.errors

        async with db() as session:
            assert await session.get(models.Project, gql_delete_project_id) is None

        async with cleanup_worker_controller.expect_wake_cycle():
            rest_resp = await httpx_client.delete(f"v1/projects/{rest_delete_project_name}")
            assert rest_resp.status_code == 204

        async with db() as session:
            assert await session.get(models.Project, rest_delete_project_id) is None

    async def test_heavy_child_fanout_drains_in_bounded_batches_without_large_final_cascade(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            proj = await _add_project(session, name=f"fanout-{token_hex(4)}")
            tr = await _add_trace(session, proj)
            sp = await _add_span(session, trace=tr)
            session.add_all(
                [
                    models.SpanAnnotation(
                        span_rowid=sp.id,
                        name=f"ann-{i}",
                        label="ok",
                        score=1.0,
                        explanation=None,
                        metadata_={},
                        annotator_kind="CODE",
                        source="API",
                        identifier="",
                    )
                    for i in range(6)
                ]
            )
            dataset = models.Dataset(name=f"fanout-ds-{token_hex(4)}", metadata_={})
            session.add(dataset)
            await session.flush()
            examples = [
                models.DatasetExample(dataset_id=dataset.id, span_rowid=sp.id) for _ in range(5)
            ]
            session.add_all(examples)
            await session.flush()
            example_ids = [ex.id for ex in examples]
            await admit_project_delete(session, dialect=dialect, project_id=proj.id)

        # With batch_limit=2, 6 annotations + 5 dataset_example refs + 1 span + 1 trace + finalize
        # must take multiple bounded steps and preserve DatasetExample rows with span_rowid=None.
        coordinator = CleanupCoordinator(db, batch_limit=2)
        steps = await _drain_all(coordinator)
        assert steps >= 6

        async with db() as session:
            assert await session.get(models.Project, proj.id) is None
            loaded_examples = (
                await session.scalars(
                    select(models.DatasetExample).where(models.DatasetExample.id.in_(example_ids))
                )
            ).all()
            assert len(loaded_examples) == 5
            assert all(ex.span_rowid is None for ex in loaded_examples)

    async def test_delete_project_reassigns_shared_cross_project_session_without_deleting_survivor(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        shared_sid = f"shared-session-{token_hex(4)}"
        t0 = datetime(2026, 7, 2, 0, 0, 0, tzinfo=timezone.utc)

        p1_span = Span(
            name="p1-span",
            context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
            span_kind=SpanKind.LLM,
            parent_id=None,
            start_time=t0,
            end_time=t0 + timedelta(seconds=1),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={"session": {"id": shared_sid}},
            events=[],
            conversation=None,
        )
        p2_span = Span(
            name="p2-span",
            context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
            span_kind=SpanKind.LLM,
            parent_id=None,
            start_time=t0 + timedelta(seconds=2),
            end_time=t0 + timedelta(seconds=3),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={"session": {"id": shared_sid}},
            events=[],
            conversation=None,
        )
        p1_name = f"cross-p1-{token_hex(4)}"
        p2_name = f"cross-p2-{token_hex(4)}"
        async with db() as session:
            ins1 = await insert_span(session, p1_span, p1_name)
            ins2 = await insert_span(session, p2_span, p2_name)
            assert ins1 is not None and ins2 is not None
            assert ins1.project_session_rowid == ins2.project_session_rowid
            assert ins1.project_session_rowid is not None
            shared_session_rowid = ins1.project_session_rowid
            p1_id = ins1.project_rowid
            p2_id = ins2.project_rowid
            p2_trace_id = ins2.trace_rowid
            await admit_project_delete(session, dialect=dialect, project_id=p1_id)

        coordinator = CleanupCoordinator(db, batch_limit=1)
        await _drain_all(coordinator)

        async with db() as session:
            assert await session.get(models.Project, p1_id) is None
            surviving_session = await session.get(models.ProjectSession, shared_session_rowid)
            assert surviving_session is not None
            assert surviving_session.project_id == p2_id
            assert await session.get(models.Trace, p2_trace_id) is not None


class TestTraceScopeDrain:
    async def test_traces_are_deleted_window_by_window_before_all_spans_are_gone(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        base = datetime(2024, 1, 1, tzinfo=timezone.utc)
        async with db() as session:
            proj = await _add_project(session, name=f"window-{token_hex(4)}")
            for i in range(6):
                tr = await _add_trace(session, proj, start_time=base + timedelta(minutes=i))
                await _add_span(session, trace=tr)
            project_id = proj.id

        steps = 0
        trace_deleted_while_spans_remain = False
        while True:
            async with db() as session:
                res = await drain_trace_scope_step(
                    session, dialect=dialect, project_id=project_id, batch_limit=2
                )
            if res.status is PrimitiveStatus.EMPTY:
                break
            assert res.status is PrimitiveStatus.PROGRESS
            steps += 1
            async with db() as session:
                traces = await session.scalar(
                    select(func.count())
                    .select_from(models.Trace)
                    .where(models.Trace.project_rowid == project_id)
                )
                spans = await session.scalar(select(func.count()).select_from(models.Span))
            if traces is not None and spans and traces < 6:
                trace_deleted_while_spans_remain = True
            assert steps < 20
        assert trace_deleted_while_spans_remain
        assert steps == 6


class TestBuiltinSyncStaleBindings:
    @pytest.mark.parametrize("binding_target", ["dataset", "project"])
    async def test_stale_builtin_with_live_binding_is_removed_and_binding_tombstoned(
        self, db: DbSessionFactory, binding_target: str
    ) -> None:
        from phoenix.server.evaluators.services.builtin_sync import sync_builtin_evaluators

        async with db() as session:
            trace_proj = models.Project(name=f"stale-proj-{token_hex(4)}")
            stale = models.BuiltinEvaluator(
                name=Identifier(root=f"stale-{token_hex(4)}"),
                description=None,
                metadata_={},
                user_id=None,
                key=f"stale_{token_hex(4)}",
                input_schema={},
                output_configs=[],
            )
            session.add_all([trace_proj, stale])
            await session.flush()
            if binding_target == "dataset":
                dataset = models.Dataset(name=f"stale-ds-{token_hex(4)}", metadata_={})
                session.add(dataset)
                await session.flush()
                dataset_binding = models.DatasetEvaluators(
                    dataset_id=dataset.id,
                    evaluator_id=stale.id,
                    project_id=trace_proj.id,
                    name=Identifier(root="stale-binding"),
                    input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                )
                session.add(dataset_binding)
                await session.flush()
                binding_id = dataset_binding.id
            else:
                owner_project = models.Project(name=f"stale-owner-{token_hex(4)}")
                session.add(owner_project)
                await session.flush()
                project_binding = models.ProjectEvaluator(
                    project_id=owner_project.id,
                    evaluator_id=stale.id,
                    trace_project_id=trace_proj.id,
                    name=Identifier(root="stale-binding"),
                    evaluation_target="TRACE",
                    filter_condition="",
                    sampling_rate=1.0,
                )
                session.add(project_binding)
                await session.flush()
                binding_id = project_binding.id
            stale_id, trace_proj_id = stale.id, trace_proj.id

        await sync_builtin_evaluators(db)

        async with db() as session:
            assert await session.get(models.Evaluator, stale_id) is None
            tombstoned_trace_proj = await session.get(models.Project, trace_proj_id)
            assert (
                tombstoned_trace_proj is not None and tombstoned_trace_proj.deleted_at is not None
            )
            if binding_target == "dataset":
                tombstoned_ds_binding = await session.get(models.DatasetEvaluators, binding_id)
                assert tombstoned_ds_binding is not None
                assert (
                    tombstoned_ds_binding.deleted_at is not None
                    and tombstoned_ds_binding.evaluator_id is None
                )
            else:
                tombstoned_proj_binding = await session.get(models.ProjectEvaluator, binding_id)
                assert tombstoned_proj_binding is not None
                assert (
                    tombstoned_proj_binding.deleted_at is not None
                    and tombstoned_proj_binding.evaluator_id is None
                )


async def test_cleanup_batches_cost_details_before_deleting_their_parent(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session, name=f"cost-fanout-{token_hex(4)}")
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace=trace)
        cost = models.SpanCost(
            span_rowid=span.id,
            trace_rowid=trace.id,
            span_start_time=span.start_time,
        )
        session.add(cost)
        await session.flush()
        session.add_all(
            [
                models.SpanCostDetail(
                    span_cost_id=cost.id,
                    token_type=f"token-{index}",
                    is_prompt=True,
                )
                for index in range(5)
            ]
        )
        await session.flush()
    async with db() as session:
        first_step = await drain_trace_scope_step(
            session,
            dialect=db.dialect,
            project_id=project.id,
            batch_limit=2,
        )
        assert first_step.status is PrimitiveStatus.PROGRESS and first_step.affected_rows == 2
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.SpanCostDetail)) == 3
        assert await session.get(models.SpanCost, cost.id) is not None
        assert await session.get(models.Span, span.id) is not None
    async with db() as session:
        second_step = await drain_trace_scope_step(
            session,
            dialect=db.dialect,
            project_id=project.id,
            batch_limit=2,
        )
        assert second_step.status is PrimitiveStatus.PROGRESS and second_step.affected_rows == 2
    async with db() as session:
        assert await session.scalar(select(func.count()).select_from(models.SpanCostDetail)) == 1
        assert await session.get(models.SpanCost, cost.id) is not None
        assert await session.get(models.Span, span.id) is not None
    async with db() as session:
        # Once both SpanCostDetail and SpanCost fit within batch_limit, they cascade directly
        # with the Span delete rather than consuming an extra transaction.
        third_step = await drain_trace_scope_step(
            session,
            dialect=db.dialect,
            project_id=project.id,
            batch_limit=2,
        )
        assert third_step.status is PrimitiveStatus.PROGRESS and third_step.affected_rows == 1
    async with db() as session:
        assert await session.get(models.Span, span.id) is None
        assert await session.get(models.SpanCost, cost.id) is None
        assert await session.scalar(select(func.count()).select_from(models.SpanCostDetail)) == 0


async def test_cleanup_batches_trace_work_units_before_deleting_trace(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session, name=f"trace-ledger-{token_hex(4)}")
        trace = await _add_trace(session, project)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(f"trace-ledger-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        for index in range(5):
            trace_project = await _add_project(session, name=f"ledger-sink-{token_hex(4)}")
            binding = models.ProjectEvaluator(
                project_id=project.id,
                evaluator_id=evaluator.id,
                trace_project_id=trace_project.id,
                name=Identifier(f"ledger-{index}"),
                evaluation_target="TRACE",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(binding)
            await session.flush()
            session.add(
                models.EvalTraceWorkUnit(
                    trace_rowid=trace.id,
                    project_evaluator_id=binding.id,
                    decided_through=trace.start_time,
                    status="DONE",
                )
            )
        await session.flush()
    async with db() as session:
        result = await drain_trace_scope_step(
            session,
            dialect=db.dialect,
            project_id=project.id,
            batch_limit=2,
        )
        assert result.status is PrimitiveStatus.PROGRESS and result.affected_rows == 2
    async with db() as session:
        assert await session.get(models.Trace, trace.id) is not None
        assert await session.scalar(select(func.count()).select_from(models.EvalTraceWorkUnit)) == 3


async def test_dataset_evaluator_delete_drains_eval_logs_and_links_in_batches(
    db: DbSessionFactory,
) -> None:
    dialect = SupportedSQLDialect(db.dialect.value)
    base_time = datetime(2026, 8, 1, 0, 0, 0, tzinfo=timezone.utc)

    async with db() as session:
        dataset = models.Dataset(name=f"de-del-ds-{token_hex(4)}", metadata_={})
        target_trace_project = models.Project(name=f"de-target-proj-{token_hex(4)}")
        other_trace_project = models.Project(name=f"de-other-proj-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"de-builtin-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([dataset, target_trace_project, other_trace_project, evaluator])
        await session.flush()

        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_example = models.DatasetExample(dataset_id=dataset.id)
        target_binding = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator.id,
            project_id=target_trace_project.id,
            name=Identifier(root="target-eval"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        other_binding = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator.id,
            project_id=other_trace_project.id,
            name=Identifier(root="other-eval"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        session.add_all([dataset_version, dataset_example, target_binding, other_binding])
        await session.flush()

        evaluator_trace = await _add_trace(session, target_trace_project, start_time=base_time)
        await _add_span(session, trace=evaluator_trace, start_time=base_time)

        experiments: list[models.Experiment] = []
        runs: list[models.ExperimentRun] = []
        for index in range(5):
            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name=f"exp-{index}-{token_hex(4)}",
                repetitions=1,
                metadata_={},
            )
            session.add(experiment)
            await session.flush()
            job = models.ExperimentEvalOnlyConfig(id=experiment.id, status="COMPLETED")
            run = models.ExperimentRun(
                experiment_id=experiment.id,
                dataset_example_id=dataset_example.id,
                repetition_number=1,
                output={},
                start_time=base_time + timedelta(seconds=index),
                end_time=base_time + timedelta(seconds=index + 1),
            )
            session.add_all(
                [
                    job,
                    run,
                    models.ExperimentDatasetEvaluator(
                        experiment_id=experiment.id,
                        dataset_evaluator_id=target_binding.id,
                    ),
                ]
            )
            await session.flush()
            experiments.append(experiment)
            runs.append(run)

        target_eval_logs = [
            models.ExperimentEvalLog(
                experiment_id=experiments[index].id,
                level="ERROR",
                message=f"target-eval-err-{index}",
                experiment_run_id=runs[index].id,
                dataset_evaluator_id=target_binding.id,
            )
            for index in range(5)
        ]
        preserved_task_log = models.ExperimentTaskLog(
            experiment_id=experiments[0].id,
            level="ERROR",
            message="preserved-task-log",
            dataset_example_id=dataset_example.id,
            repetition_number=1,
        )
        preserved_job_log = models.ExperimentJobLog(
            experiment_id=experiments[0].id,
            level="INFO",
            message="preserved-job-log",
        )
        other_eval_logs = [
            models.ExperimentEvalLog(
                experiment_id=experiments[index].id,
                level="ERROR",
                message=f"other-eval-err-{index}",
                experiment_run_id=runs[index].id,
                dataset_evaluator_id=other_binding.id,
            )
            for index in range(2)
        ]
        other_link = models.ExperimentDatasetEvaluator(
            experiment_id=experiments[0].id,
            dataset_evaluator_id=other_binding.id,
        )
        session.add_all(
            [*target_eval_logs, preserved_task_log, preserved_job_log, *other_eval_logs, other_link]
        )
        await session.flush()

        target_binding_id = target_binding.id
        other_binding_id = other_binding.id
        target_trace_project_id = target_trace_project.id
        target_eval_log_ids = [log.id for log in target_eval_logs]
        preserved_log_ids = {
            preserved_task_log.id,
            preserved_job_log.id,
            *(log.id for log in other_eval_logs),
        }
        preserved_task_log_id = preserved_task_log.id
        first_experiment_id = experiments[0].id

        await logical_delete_dataset_evaluators(
            session,
            dialect=dialect,
            binding_ids=[target_binding_id],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )

    coordinator = CleanupCoordinator(db, batch_limit=2)
    step_counts: list[int] = []
    for _ in range(3):
        step_result = await coordinator.step()
        assert step_result.outcome == "progress"
        step_counts.append(step_result.affected_rows)
    assert step_counts == [2, 2, 1]

    async with db() as session:
        remaining_target_logs = await session.scalar(
            select(func.count()).where(
                models.ExperimentEvalLog.__table__.c.dataset_evaluator_id == target_binding_id
            )
        )
        remaining_target_links = await session.scalar(
            select(func.count()).where(
                models.ExperimentDatasetEvaluator.dataset_evaluator_id == target_binding_id
            )
        )
        assert remaining_target_logs == 0
        assert remaining_target_links == 5

    link_step_counts: list[int] = []
    for _ in range(3):
        step_result = await coordinator.step()
        assert step_result.outcome == "progress"
        link_step_counts.append(step_result.affected_rows)
    assert link_step_counts == [2, 2, 1]

    remaining_steps = await _drain_all(coordinator)
    assert remaining_steps >= 2

    async with db() as session:
        assert await session.get(models.DatasetEvaluators, target_binding_id) is None
        assert await session.get(models.Project, target_trace_project_id) is None
        assert await session.get(models.DatasetEvaluators, other_binding_id) is not None
        surviving_target_logs = list(
            await session.scalars(
                select(models.ExperimentLog.id).where(
                    models.ExperimentLog.id.in_(target_eval_log_ids)
                )
            )
        )
        assert surviving_target_logs == []
        surviving_target_eval_subrows = await session.scalar(
            select(func.count()).where(
                models.ExperimentEvalLog.__table__.c.dataset_evaluator_id == target_binding_id
            )
        )
        assert surviving_target_eval_subrows == 0
        surviving_target_links = await session.scalar(
            select(func.count()).where(
                models.ExperimentDatasetEvaluator.dataset_evaluator_id == target_binding_id
            )
        )
        assert surviving_target_links == 0

        surviving_preserved_logs = set(
            await session.scalars(
                select(models.ExperimentLog.id).where(
                    models.ExperimentLog.id.in_(preserved_log_ids)
                )
            )
        )
        assert surviving_preserved_logs == preserved_log_ids
        surviving_task_subrow = await session.scalar(
            select(models.ExperimentTaskLog.__table__.c.id).where(
                models.ExperimentTaskLog.__table__.c.id == preserved_task_log_id
            )
        )
        assert surviving_task_subrow == preserved_task_log_id
        surviving_other_eval_subrows = await session.scalar(
            select(func.count()).where(
                models.ExperimentEvalLog.__table__.c.dataset_evaluator_id == other_binding_id
            )
        )
        assert surviving_other_eval_subrows == 2
        surviving_other_link = await session.scalar(
            select(func.count()).where(
                models.ExperimentDatasetEvaluator.experiment_id == first_experiment_id,
                models.ExperimentDatasetEvaluator.dataset_evaluator_id == other_binding_id,
            )
        )
        assert surviving_other_link == 1


async def test_sqlite_cleanup_primitives_use_fk_indexes_without_temp_btrees(
    db: DbSessionFactory,
) -> None:
    if db.dialect is not SupportedSQLDialect.SQLITE:
        pytest.skip("SQLite EXPLAIN QUERY PLAN check")

    base_time = datetime(2026, 8, 2, 0, 0, 0, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session, name=f"eqp-proj-{token_hex(4)}")
        trace_sink_a = models.Project(name=f"eqp-sink-a-{token_hex(4)}")
        trace_sink_b = models.Project(name=f"eqp-sink-b-{token_hex(4)}")
        dataset_trace_sink = models.Project(name=f"eqp-ds-sink-{token_hex(4)}")
        dataset = models.Dataset(name=f"eqp-ds-{token_hex(4)}", metadata_={})
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eqp-bi-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        annotation_configs = [
            models.AnnotationConfig(
                name=f"eqp-cfg-{index}-{token_hex(4)}",
                config=ContinuousAnnotationConfig(
                    type="CONTINUOUS",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                ),
            )
            for index in range(3)
        ]
        session.add_all(
            [
                trace_sink_a,
                trace_sink_b,
                dataset_trace_sink,
                dataset,
                evaluator,
                *annotation_configs,
            ]
        )
        await session.flush()

        session.add_all(
            [
                models.ProjectAnnotationConfig(
                    project_id=project.id,
                    annotation_config_id=config.id,
                )
                for config in annotation_configs
            ]
        )
        span_evaluator = models.ProjectEvaluator(
            project_id=project.id,
            evaluator_id=evaluator.id,
            trace_project_id=trace_sink_a.id,
            name=Identifier(root="eqp-span-eval"),
            evaluation_target="SPAN",
            filter_condition="",
            sampling_rate=1.0,
        )
        session_evaluator = models.ProjectEvaluator(
            project_id=project.id,
            evaluator_id=evaluator.id,
            trace_project_id=trace_sink_b.id,
            name=Identifier(root="eqp-session-eval"),
            evaluation_target="SESSION",
            filter_condition="",
            sampling_rate=1.0,
        )
        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_binding = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator.id,
            project_id=dataset_trace_sink.id,
            name=Identifier(root="eqp-ds-eval"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        session.add_all([span_evaluator, session_evaluator, dataset_version, dataset_binding])
        await session.flush()

        project_session = await _add_project_session(session, project, start_time=base_time)
        await _add_project_session(session, project, start_time=base_time + timedelta(minutes=1))
        first_trace = await _add_trace(
            session, project, project_session=project_session, start_time=base_time
        )
        second_trace = await _add_trace(
            session, project, start_time=base_time + timedelta(seconds=1)
        )
        first_span = await _add_span(session, trace=first_trace, start_time=base_time)
        second_span = await _add_span(
            session, trace=first_trace, start_time=base_time + timedelta(milliseconds=10)
        )
        third_span = await _add_span(
            session, trace=second_trace, start_time=base_time + timedelta(seconds=1)
        )

        dataset_examples = [
            models.DatasetExample(dataset_id=dataset.id, span_rowid=first_span.id) for _ in range(3)
        ]
        span_annotations = [
            models.SpanAnnotation(
                span_rowid=first_span.id,
                name=f"eqp-ann-{index}",
                label="ok",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="CODE",
                source="API",
                identifier="",
            )
            for index in range(4)
        ]
        work_units = [
            models.EvalWorkUnit(
                span_rowid=first_span.id,
                project_evaluator_id=span_evaluator.id,
                status="PENDING",
            ),
            models.EvalWorkUnit(
                span_rowid=second_span.id,
                project_evaluator_id=span_evaluator.id,
                status="DONE",
            ),
            models.EvalWorkUnit(
                span_rowid=third_span.id,
                project_evaluator_id=span_evaluator.id,
                status="DONE",
            ),
        ]
        session_work_unit = models.EvalSessionWorkUnit(
            project_session_rowid=project_session.id,
            project_evaluator_id=session_evaluator.id,
            decided_through=base_time,
            status="DONE",
        )
        session.add_all([*dataset_examples, *span_annotations, *work_units, session_work_unit])
        await session.flush()

        for index in range(3):
            experiment = models.Experiment(
                dataset_id=dataset.id,
                dataset_version_id=dataset_version.id,
                name=f"eqp-exp-{index}-{token_hex(4)}",
                repetitions=1,
                metadata_={},
                project_name=project.name,
            )
            session.add(experiment)
            await session.flush()
            job = models.ExperimentEvalOnlyConfig(id=experiment.id, status="COMPLETED")
            run = models.ExperimentRun(
                experiment_id=experiment.id,
                dataset_example_id=dataset_examples[0].id,
                repetition_number=1,
                output={},
                start_time=base_time,
                end_time=base_time + timedelta(seconds=1),
            )
            session.add_all(
                [
                    job,
                    run,
                    models.ExperimentDatasetEvaluator(
                        experiment_id=experiment.id,
                        dataset_evaluator_id=dataset_binding.id,
                    ),
                ]
            )
            await session.flush()
            session.add(
                models.ExperimentEvalLog(
                    experiment_id=experiment.id,
                    level="ERROR",
                    message=f"eqp-eval-log-{index}",
                    experiment_run_id=run.id,
                    dataset_evaluator_id=dataset_binding.id,
                )
            )
        session.add(
            models.AgentSession(
                title="eqp-agent",
                project_name=project.name,
                model_provider="OPENAI",
                model_name="gpt-4o",
            )
        )
        await session.flush()

        project_id = project.id
        span_evaluator_id = span_evaluator.id
        dataset_binding_id = dataset_binding.id

    recorded_selects: list[tuple[str, Any]] = []

    def record_select(
        _connection: Any,
        _cursor: Any,
        statement: str,
        parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        normalized = statement.lstrip()
        if normalized.upper().startswith("SELECT") and "EXPLAIN" not in normalized.upper():
            recorded_selects.append((statement, parameters))

    async with db() as session:
        bind = session.get_bind()
        event.listen(bind, "before_cursor_execute", record_select)
        try:
            while (
                await drain_dataset_evaluator_dependents_step(
                    session,
                    dialect=SupportedSQLDialect.SQLITE,
                    dataset_evaluator_id=dataset_binding_id,
                    batch_limit=2,
                )
            ).status is not PrimitiveStatus.EMPTY:
                pass
            while (
                await drain_eval_work_units_step(
                    session,
                    dialect=SupportedSQLDialect.SQLITE,
                    project_evaluator_id=span_evaluator_id,
                    batch_limit=2,
                )
            ).status is not PrimitiveStatus.EMPTY:
                pass
            while (
                await drain_project_annotation_config_links_step(
                    session,
                    dialect=SupportedSQLDialect.SQLITE,
                    project_id=project_id,
                    batch_limit=2,
                )
            ).status is not PrimitiveStatus.EMPTY:
                pass
            while (
                await drain_trace_scope_step(
                    session,
                    dialect=SupportedSQLDialect.SQLITE,
                    project_id=project_id,
                    batch_limit=2,
                )
            ).status is not PrimitiveStatus.EMPTY:
                pass
        finally:
            event.remove(bind, "before_cursor_execute", record_select)

        connection = await session.connection()
        plans_by_statement: list[tuple[str, Any, list[str]]] = []
        for statement, parameters in recorded_selects:
            plan_rows = (
                await connection.exec_driver_sql(f"EXPLAIN QUERY PLAN {statement}", parameters)
            ).all()
            plans_by_statement.append((statement, parameters, [str(row[-1]) for row in plan_rows]))

    eval_log_plans = [
        (statement, details)
        for statement, _parameters, details in plans_by_statement
        if "experiment_eval_logs" in statement and "EXISTS" not in statement
    ]
    assert eval_log_plans, "Expected ExperimentEvalLog candidate SELECT"
    for statement, details in eval_log_plans:
        joined = " | ".join(details)
        assert "ix_experiment_eval_logs_dataset_evaluator_id" in joined, (
            f"Expected ix_experiment_eval_logs_dataset_evaluator_id for {statement}, got: {joined}"
        )
        assert "sqlite_autoindex_experiment_logs_1" not in joined, (
            f"Unexpected experiment_logs category scan for {statement}: {joined}"
        )
        assert "TEMP B-TREE" not in joined, f"Unexpected TEMP B-TREE for {statement}: {joined}"

    trace_window_plans = [
        (statement, details)
        for statement, _parameters, details in plans_by_statement
        if "FROM traces" in statement and "ORDER BY" in statement
    ]
    assert trace_window_plans, "Expected window_stmt SELECT on traces"
    for statement, details in trace_window_plans:
        joined = " | ".join(details)
        assert "ix_traces_project_rowid_start_time" in joined, (
            f"Expected ix_traces_project_rowid_start_time for {statement}, got: {joined}"
        )
        assert "TEMP B-TREE" not in joined, f"Unexpected TEMP B-TREE for {statement}: {joined}"

    span_candidate_plans = [
        (statement, details)
        for statement, _parameters, details in plans_by_statement
        if "SELECT spans.id" in statement and "FROM spans" in statement
    ]
    assert span_candidate_plans, "Expected span_candidates_stmt SELECT"
    for statement, details in span_candidate_plans:
        joined = " | ".join(details)
        assert "ix_spans_trace_rowid" in joined, (
            f"Expected ix_spans_trace_rowid for {statement}, got: {joined}"
        )
        assert "TEMP B-TREE" not in joined, f"Unexpected TEMP B-TREE for {statement}: {joined}"

    span_annotation_delete_plans = [
        (statement, details)
        for statement, _parameters, details in plans_by_statement
        if "SELECT span_annotations.id" in statement and "FROM span_annotations" in statement
    ]
    assert span_annotation_delete_plans, "Expected _delete_by_ids SELECT on span_annotations"
    for statement, details in span_annotation_delete_plans:
        joined = " | ".join(details)
        assert "ix_span_annotations_span_rowid" in joined, (
            f"Expected ix_span_annotations_span_rowid for {statement}, got: {joined}"
        )
        assert "TEMP B-TREE" not in joined, f"Unexpected TEMP B-TREE for {statement}: {joined}"

    temp_btree_offenders = [
        (statement, details)
        for statement, _parameters, details in plans_by_statement
        if any("TEMP B-TREE" in detail for detail in details)
    ]
    assert temp_btree_offenders == []

    batch_plus_one_probes = [
        (statement, parameters)
        for statement, parameters, _details in plans_by_statement
        if isinstance(parameters, (tuple, list))
        and len(parameters) >= 2
        and parameters[-2:] == (3, 0)
    ]
    assert batch_plus_one_probes == [], (
        f"Expected .offset(batch_limit).limit(1) probes instead of limit(batch_limit + 1): "
        f"{batch_plus_one_probes}"
    )


@pytest.mark.postgres_only
async def test_postgres_dataset_evaluator_dependents_skip_locked_past_locked_prefix(
    postgresql_engine: Any,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    base_time = datetime(2026, 8, 3, 0, 0, 0, tzinfo=timezone.utc)

    async with db() as session:
        dataset = models.Dataset(name=f"pg-skip-ds-{token_hex(4)}", metadata_={})
        trace_project = models.Project(name=f"pg-skip-proj-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"pg-skip-bi-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add_all([dataset, trace_project, evaluator])
        await session.flush()

        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_example = models.DatasetExample(dataset_id=dataset.id)
        binding = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator.id,
            project_id=trace_project.id,
            name=Identifier(root="pg-skip-eval"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        session.add_all([dataset_version, dataset_example, binding])
        await session.flush()

        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"pg-skip-exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
        )
        session.add(experiment)
        await session.flush()
        job = models.ExperimentEvalOnlyConfig(id=experiment.id, status="COMPLETED")
        run = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=dataset_example.id,
            repetition_number=1,
            output={},
            start_time=base_time,
            end_time=base_time + timedelta(seconds=1),
        )
        session.add_all([job, run])
        await session.flush()

        eval_logs = [
            models.ExperimentEvalLog(
                experiment_id=experiment.id,
                level="ERROR",
                message=f"pg-skip-err-{index}",
                experiment_run_id=run.id,
                dataset_evaluator_id=binding.id,
            )
            for index in range(4)
        ]
        session.add_all(eval_logs)
        await session.flush()
        locked_prefix_ids = [eval_logs[0].id, eval_logs[1].id]
        binding_id = binding.id

    recorded_selects: list[tuple[str, Any]] = []

    def record_select(
        _connection: Any,
        _cursor: Any,
        statement: str,
        parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        normalized = statement.lstrip()
        if (
            normalized.upper().startswith("SELECT")
            and "experiment_eval_logs" in normalized
            and "EXISTS" not in normalized.upper()
            and "EXPLAIN" not in normalized.upper()
        ):
            recorded_selects.append((statement, parameters))

    async with db() as locker:
        await locker.execute(
            select(models.ExperimentLog.id)
            .where(models.ExperimentLog.id.in_(locked_prefix_ids))
            .order_by(models.ExperimentLog.id.asc())
            .with_for_update()
        )
        async with db() as session:
            bind = session.get_bind()
            event.listen(bind, "before_cursor_execute", record_select)
            try:
                first_result = await drain_dataset_evaluator_dependents_step(
                    session,
                    dialect=SupportedSQLDialect.POSTGRESQL,
                    dataset_evaluator_id=binding_id,
                    batch_limit=2,
                )
            finally:
                event.remove(bind, "before_cursor_execute", record_select)
            assert first_result == PrimitiveResult(PrimitiveStatus.PROGRESS, 2)

            assert recorded_selects
            statement, parameters = recorded_selects[0]
            connection = await session.connection()
            explain_rows = (
                await connection.exec_driver_sql(f"EXPLAIN {statement}", parameters)
            ).all()
            explain_text = "\n".join(str(row[0]) for row in explain_rows)
            assert "ix_experiment_eval_logs_dataset_evaluator_id" in explain_text
            assert "Seq Scan on experiment_logs" not in explain_text

        async with db() as session:
            yield_result = await drain_dataset_evaluator_dependents_step(
                session,
                dialect=SupportedSQLDialect.POSTGRESQL,
                dataset_evaluator_id=binding_id,
                batch_limit=2,
            )
            assert yield_result == PrimitiveResult(PrimitiveStatus.YIELD, 0)

    async with db() as session:
        final_logs_result = await drain_dataset_evaluator_dependents_step(
            session,
            dialect=SupportedSQLDialect.POSTGRESQL,
            dataset_evaluator_id=binding_id,
            batch_limit=2,
        )
        assert final_logs_result == PrimitiveResult(PrimitiveStatus.PROGRESS, 2)
        empty_result = await drain_dataset_evaluator_dependents_step(
            session,
            dialect=SupportedSQLDialect.POSTGRESQL,
            dataset_evaluator_id=binding_id,
            batch_limit=2,
        )
        assert empty_result == PrimitiveResult(PrimitiveStatus.EMPTY, 0)


async def test_late_spans_dropped_after_internal_projects_are_physically_purged(
    db: DbSessionFactory,
) -> None:
    dialect = SupportedSQLDialect(db.dialect.value)
    base_time = datetime(2026, 8, 4, 0, 0, 0, tzinfo=timezone.utc)
    deleted_experiment_project_name = f"Experiment-{token_hex(12)}"
    retained_experiment_project_name = f"Experiment-{token_hex(12)}"
    dataset_evaluator_project_name = f"dataset-evaluator-{token_hex(12)}"
    project_evaluator_project_name = f"project-evaluator-{token_hex(12)}"
    custom_user_project_name = f"my-custom-exp-{token_hex(4)}"

    async with db() as session:
        dataset = models.Dataset(name=f"late-span-ds-{token_hex(4)}", metadata_={})
        owner_project = models.Project(name=f"late-span-owner-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"late-span-bi-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        deleted_experiment_project = models.Project(name=deleted_experiment_project_name)
        retained_experiment_project = models.Project(name=retained_experiment_project_name)
        dataset_evaluator_project = models.Project(name=dataset_evaluator_project_name)
        project_evaluator_project = models.Project(name=project_evaluator_project_name)
        session.add_all(
            [
                dataset,
                owner_project,
                evaluator,
                deleted_experiment_project,
                retained_experiment_project,
                dataset_evaluator_project,
                project_evaluator_project,
            ]
        )
        await session.flush()

        version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_binding = models.DatasetEvaluators(
            dataset_id=dataset.id,
            evaluator_id=evaluator.id,
            project_id=dataset_evaluator_project.id,
            name=Identifier(root="late-ds-eval"),
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        project_binding = models.ProjectEvaluator(
            project_id=owner_project.id,
            evaluator_id=evaluator.id,
            trace_project_id=project_evaluator_project.id,
            name=Identifier(root="late-pe-eval"),
            sampling_rate=1.0,
            evaluation_target="SPAN",
            evaluation_delay_seconds=0,
        )
        session.add_all([version, dataset_binding, project_binding])
        await session.flush()

        retained_experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=version.id,
            name="retained-exp-record",
            repetitions=1,
            metadata_={},
            project_name=retained_experiment_project_name,
        )
        session.add(retained_experiment)
        await session.flush()

        purged_project_ids = [
            deleted_experiment_project.id,
            retained_experiment_project.id,
            dataset_evaluator_project.id,
            project_evaluator_project.id,
        ]
        await admit_project_delete(
            session, dialect=dialect, project_id=deleted_experiment_project.id
        )
        await admit_project_delete(
            session, dialect=dialect, project_id=retained_experiment_project.id
        )
        await logical_delete_dataset_evaluators(
            session,
            dialect=dialect,
            binding_ids=[dataset_binding.id],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )
        await logical_delete_project_evaluators(
            session,
            dialect=dialect,
            binding_ids=[project_binding.id],
            collect_unused_evaluator=False,
            delete_associated_prompt=False,
        )

    coordinator = CleanupCoordinator(db, batch_limit=10)
    await _drain_all(coordinator)

    async with db() as session:
        for project_id in purged_project_ids:
            assert await session.get(models.Project, project_id) is None

    for internal_name in (
        deleted_experiment_project_name,
        dataset_evaluator_project_name,
        project_evaluator_project_name,
    ):
        late_span = Span(
            name="late-buffered-span",
            context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
            span_kind=SpanKind.LLM,
            parent_id=None,
            start_time=base_time,
            end_time=base_time + timedelta(seconds=1),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={},
            events=[],
            conversation=None,
        )
        async with db() as session:
            assert await insert_span(session, late_span, internal_name) is None
            assert (
                await session.scalar(
                    select(models.Project.id).where(models.Project.name == internal_name)
                )
                is None
            )

    # A retained experiment still names its project, so a late span lands in a recreated
    # EXPERIMENT project instead of being dropped.
    retained_span = Span(
        name="late-retained-span",
        context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
        span_kind=SpanKind.LLM,
        parent_id=None,
        start_time=base_time,
        end_time=base_time + timedelta(seconds=1),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={},
        events=[],
        conversation=None,
    )
    async with db() as session:
        inserted = await insert_span(session, retained_span, retained_experiment_project_name)
        assert inserted is not None
        recreated = await session.get(models.Project, inserted.project_rowid)
        assert recreated is not None
        assert recreated.name == retained_experiment_project_name
        assert recreated.deleted_at is None

    custom_span = Span(
        name="custom-user-span",
        context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
        span_kind=SpanKind.LLM,
        parent_id=None,
        start_time=base_time,
        end_time=base_time + timedelta(seconds=1),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={},
        events=[],
        conversation=None,
    )
    async with db() as session:
        inserted = await insert_span(session, custom_span, custom_user_project_name)
        assert inserted is not None


@pytest.mark.postgres_only
async def test_postgres_only_one_coordinator_steps_while_the_advisory_lock_is_held(
    postgresql_engine: Any,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        project = await _add_project(session, name=f"pg-excl-{token_hex(4)}")
        project_id = project.id
        await admit_project_delete(
            session, dialect=SupportedSQLDialect.POSTGRESQL, project_id=project_id
        )

    coordinator_a = CleanupCoordinator(db)
    coordinator_b = CleanupCoordinator(db)

    async with db() as stepping_session:
        acquired = await stepping_session.scalar(
            select(func.pg_try_advisory_xact_lock(_CLEANUP_ADMISSION_LOCK_ID))
        )
        assert acquired is True
        assert (await coordinator_b.step()).outcome == "busy"
        assert await coordinator_b.step_or_next_delay() == (False, None)
        async with db() as inspector:
            assert await inspector.get(models.Project, project_id) is not None

    assert (await coordinator_a.step()).outcome == "completed"
    async with db() as session:
        assert await session.get(models.Project, project_id) is None


@pytest.mark.postgres_only
async def test_postgres_locked_span_causes_drain_traces_step_to_yield_without_deleting_trace(
    postgresql_engine: Any,
) -> None:
    from phoenix.server.cleanup.primitives import drain_traces_step, trace_scope_condition

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    base_time = datetime(2026, 8, 5, 0, 0, 0, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session, name=f"pg-span-lock-{token_hex(4)}")
        trace = await _add_trace(session, project, start_time=base_time)
        span = await _add_span(session, trace=trace, start_time=base_time)
        project_id, trace_id, span_id = project.id, trace.id, span.id

    trace_cond = trace_scope_condition(project_id)
    async with db() as locker:
        await locker.execute(
            select(models.Span.id).where(models.Span.id == span_id).with_for_update()
        )
        async with db() as cleaner:
            yield_result = await drain_traces_step(
                cleaner,
                dialect=SupportedSQLDialect.POSTGRESQL,
                trace_cond=trace_cond,
                batch_limit=10,
            )
            assert yield_result == PrimitiveResult(PrimitiveStatus.YIELD, 0)

        async with db() as inspector:
            assert await inspector.get(models.Trace, trace_id) is not None
            assert await inspector.get(models.Span, span_id) is not None

    async with db() as cleaner:
        span_progress = await drain_traces_step(
            cleaner,
            dialect=SupportedSQLDialect.POSTGRESQL,
            trace_cond=trace_cond,
            batch_limit=10,
        )
        assert span_progress == PrimitiveResult(PrimitiveStatus.PROGRESS, 1)
    async with db() as cleaner:
        trace_progress = await drain_traces_step(
            cleaner,
            dialect=SupportedSQLDialect.POSTGRESQL,
            trace_cond=trace_cond,
            batch_limit=10,
        )
        assert trace_progress == PrimitiveResult(PrimitiveStatus.PROGRESS, 1)
    async with db() as inspector:
        assert await inspector.get(models.Span, span_id) is None
        assert await inspector.get(models.Trace, trace_id) is None


async def test_postgres_clear_gives_up_with_conflict_and_keeps_committed_batches(
    postgresql_engine: Any,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    base_time = datetime(2026, 8, 6, 0, 0, 0, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session, name=f"pg-clear-contention-{token_hex(4)}")
        first_trace = await _add_trace(session, project, start_time=base_time)
        await _add_span(session, trace=first_trace, start_time=base_time)
        second_start_time = base_time + timedelta(minutes=1)
        second_trace = await _add_trace(session, project, start_time=second_start_time)
        locked_span = await _add_span(session, trace=second_trace, start_time=second_start_time)
        project_id = project.id
        first_trace_id, second_trace_id = first_trace.id, second_trace.id
        locked_span_id = locked_span.id

    async with db() as locker:
        await locker.execute(
            select(models.Span.id).where(models.Span.id == locked_span_id).with_for_update()
        )
        with pytest.raises(Conflict, match="run the clear again"):
            await _clear_project(db, project_id, batch_limit=1)

    async with db() as inspector:
        assert await inspector.get(models.Trace, first_trace_id) is None
        assert await inspector.get(models.Trace, second_trace_id) is not None

    batches = await _clear_project(db, project_id, batch_limit=1)
    assert batches[-1].status == "COMPLETE"
    async with db() as inspector:
        assert await inspector.get(models.Trace, second_trace_id) is None


async def test_delete_traces_handles_more_than_32767_trace_ids_without_bind_param_crash(
    db: DbSessionFactory,
) -> None:
    from phoenix.server.api.utils import delete_traces

    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        sdk_evaluators_project = models.Project(name="evaluators")
        tombstoned_evaluator_sink = models.Project(
            name=f"tombstoned-eval-{token_hex(4)}",
            deleted_at=base_time,
        )
        session.add_all([sdk_evaluators_project, tombstoned_evaluator_sink])
        await session.flush()

        sdk_trace = await _add_trace(session, sdk_evaluators_project, start_time=base_time)
        await _add_span(session, trace=sdk_trace, start_time=base_time)
        sink_trace = await _add_trace(session, tombstoned_evaluator_sink, start_time=base_time)
        await _add_span(session, trace=sink_trace, start_time=base_time)
        sdk_trace_rowid = sdk_trace.id
        sink_trace_rowid = sink_trace.id
        over_limit_trace_ids = [
            sdk_trace.trace_id,
            sink_trace.trace_id,
            *(f"nonexistent-trace-{idx:06d}" for idx in range(35_000)),
        ]

    await delete_traces(db, *over_limit_trace_ids)

    async with db() as session:
        assert await session.get(models.Trace, sdk_trace_rowid) is None
        assert await session.get(models.Trace, sink_trace_rowid) is not None


async def test_delete_traces_chunks_above_bind_param_limit_skips_evaluator_projects_and_emits_event(
    db: DbSessionFactory,
) -> None:
    from phoenix.db.helpers import (
        get_eval_trace_ids_for_datasets,
        get_eval_trace_ids_for_experiments,
    )
    from phoenix.server.api.utils import delete_traces

    base_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        sdk_evaluators_project = models.Project(name="evaluators")
        live_evaluator_sink = models.Project(name=f"live-eval-sink-{token_hex(4)}")
        tombstoned_evaluator_sink = models.Project(
            name=f"tombstoned-eval-sink-{token_hex(4)}",
            deleted_at=base_time,
        )
        tombstoned_standard_project = models.Project(
            name=f"tombstoned-std-{token_hex(4)}",
            deleted_at=base_time,
        )
        untouched_project = models.Project(name=f"untouched-{token_hex(4)}")
        dataset = models.Dataset(name=f"eval-trace-ds-{token_hex(4)}", metadata_={})
        session.add_all(
            [
                sdk_evaluators_project,
                live_evaluator_sink,
                tombstoned_evaluator_sink,
                tombstoned_standard_project,
                untouched_project,
                dataset,
            ]
        )
        await session.flush()
        await _bind_evaluator_trace_project(session, live_evaluator_sink)
        await _bind_evaluator_trace_project(session, tombstoned_evaluator_sink)

        sdk_trace_first = await _add_trace(session, sdk_evaluators_project, start_time=base_time)
        sdk_trace_second = await _add_trace(
            session, sdk_evaluators_project, start_time=base_time + timedelta(seconds=1)
        )
        sdk_trace_third = await _add_trace(
            session, sdk_evaluators_project, start_time=base_time + timedelta(seconds=2)
        )
        for sdk_trace in (sdk_trace_first, sdk_trace_second, sdk_trace_third):
            sdk_span = await _add_span(session, trace=sdk_trace, start_time=base_time)
            session.add_all(
                [
                    models.SpanAnnotation(
                        span_rowid=sdk_span.id,
                        name=f"note-{idx}",
                        label="ok",
                        score=1.0,
                        annotator_kind="CODE",
                        source="API",
                        metadata_={},
                    )
                    for idx in range(3)
                ]
            )

        live_sink_trace = await _add_trace(session, live_evaluator_sink, start_time=base_time)
        await _add_span(session, trace=live_sink_trace, start_time=base_time)
        tombstoned_sink_trace = await _add_trace(
            session, tombstoned_evaluator_sink, start_time=base_time
        )
        await _add_span(session, trace=tombstoned_sink_trace, start_time=base_time)
        tombstoned_std_trace = await _add_trace(
            session, tombstoned_standard_project, start_time=base_time
        )
        await _add_span(session, trace=tombstoned_std_trace, start_time=base_time)
        untouched_trace = await _add_trace(session, untouched_project, start_time=base_time)
        await _add_span(session, trace=untouched_trace, start_time=base_time)

        dataset_version = models.DatasetVersion(dataset_id=dataset.id, metadata_={})
        dataset_example = models.DatasetExample(dataset_id=dataset.id)
        session.add_all([dataset_version, dataset_example])
        await session.flush()
        experiment = models.Experiment(
            dataset_id=dataset.id,
            dataset_version_id=dataset_version.id,
            name=f"exp-{token_hex(4)}",
            repetitions=1,
            metadata_={},
        )
        session.add(experiment)
        await session.flush()
        experiment_run = models.ExperimentRun(
            experiment_id=experiment.id,
            dataset_example_id=dataset_example.id,
            repetition_number=1,
            output={"output": "ok"},
            start_time=base_time,
            end_time=base_time,
        )
        session.add(experiment_run)
        await session.flush()
        for idx, candidate_trace in enumerate(
            (
                sdk_trace_first,
                sdk_trace_second,
                sdk_trace_third,
                live_sink_trace,
                tombstoned_sink_trace,
                tombstoned_std_trace,
            )
        ):
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=experiment_run.id,
                    name=f"eval-{idx}",
                    annotator_kind="CODE",
                    score=1.0,
                    trace_id=candidate_trace.trace_id,
                    metadata_={},
                    start_time=base_time,
                    end_time=base_time,
                )
            )
        await session.flush()

        expected_sdk_trace_ids = {
            sdk_trace_first.trace_id,
            sdk_trace_second.trace_id,
            sdk_trace_third.trace_id,
        }
        dataset_eval_trace_ids = set(
            (await session.scalars(get_eval_trace_ids_for_datasets(dataset.id))).all()
        )
        experiment_eval_trace_ids = set(
            (await session.scalars(get_eval_trace_ids_for_experiments(experiment.id))).all()
        )
        assert dataset_eval_trace_ids == expected_sdk_trace_ids
        assert experiment_eval_trace_ids == expected_sdk_trace_ids

        sdk_evaluators_project_id = sdk_evaluators_project.id
        protected_trace_rowids = {
            live_sink_trace.id,
            tombstoned_sink_trace.id,
            tombstoned_std_trace.id,
            untouched_trace.id,
        }
        over_limit_trace_ids = [
            sdk_trace_first.trace_id,
            sdk_trace_second.trace_id,
            sdk_trace_third.trace_id,
            live_sink_trace.trace_id,
            tombstoned_sink_trace.trace_id,
            tombstoned_std_trace.trace_id,
            *(f"nonexistent-eval-trace-{idx:06d}" for idx in range(35_000)),
        ]

    recorded_events: list[DmlEvent] = []

    class _RecordingQueue:
        def put(self, item: DmlEvent) -> None:
            recorded_events.append(item)

    affected_project_ids = await delete_traces(
        db,
        *over_limit_trace_ids,
        event_queue=_RecordingQueue(),
        batch_limit=2,
    )
    assert set(affected_project_ids) == {sdk_evaluators_project_id}
    assert recorded_events == [SpanDeleteEvent((sdk_evaluators_project_id,))]

    async with db() as session:
        remaining_sdk_traces = list(
            await session.scalars(
                select(models.Trace.id).where(
                    models.Trace.project_rowid == sdk_evaluators_project_id
                )
            )
        )
        assert remaining_sdk_traces == []
        remaining_protected_traces = set(
            await session.scalars(
                select(models.Trace.id).where(models.Trace.id.in_(protected_trace_rowids))
            )
        )
        assert remaining_protected_traces == protected_trace_rowids
