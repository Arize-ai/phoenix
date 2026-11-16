"""Unit tests for the cleanup queue, background reclamation, and domain fences."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, cast
from unittest.mock import MagicMock

import httpx2
import pytest
from sqlalchemy import delete, func, select, update
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.span import insert_span
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.exceptions import Conflict
from phoenix.server.cleanup.coordinator import CleanupCoordinator
from phoenix.server.cleanup.lifecycle import (
    admit_exclusive_experiment_projects_delete,
    admit_or_reuse_project_clear,
    admit_project_delete,
    logical_delete_dataset_evaluators,
    logical_delete_project_evaluators,
)
from phoenix.server.daemons.cleanup_worker import CleanupWorker
from phoenix.server.evaluators.resolution import build_evaluator_from_definition
from phoenix.server.evaluators.snapshots import (
    pin_evaluator_definition,
    stored_evaluator_definition,
)
from phoenix.server.monty_runtime import MontyRuntime
from phoenix.server.online_eval.clock import current_database_time
from phoenix.server.online_eval.coordinator import (
    EvalWorkCoordinator,
    PublicationEvaluatorDisabledError,
)
from phoenix.server.online_eval.executor import HydrationFailure, OnlineEvalExecutor
from phoenix.server.online_eval.tracing import marked_evaluator_tracer, persist_evaluator_traces
from phoenix.server.sandbox.session_manager import SandboxSessionManager
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.tracers import Tracer
from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace
from tests.unit.graphql import AsyncGraphQLClient


async def _drain_all(coordinator: CleanupCoordinator) -> int:
    steps = 0
    while await coordinator.run_one_step():
        steps += 1
    return steps


class TestCleanupQueueSchedulingAndFencing:
    async def test_single_concurrency_lapsed_claim_recovery_and_error_retry_delay(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            p1 = await _add_project(session, name=f"p1-{token_hex(4)}")
            p2 = await _add_project(session, name=f"p2-{token_hex(4)}")
            await admit_project_delete(session, dialect=dialect, project_id=p1.id)
            await admit_project_delete(session, dialect=dialect, project_id=p2.id)

        coord_a = CleanupCoordinator(
            db,
            batch_limit=1,
            lease_ttl_seconds=30.0,
            error_retry_delay_seconds=15.0,
        )
        coord_b = CleanupCoordinator(
            db,
            batch_limit=1,
            lease_ttl_seconds=30.0,
            error_retry_delay_seconds=15.0,
        )

        # Replica A claims the first task; Replica B sees global concurrency = 1 and gets None.
        claimed_a = await coord_a.claim_next()
        assert claimed_a is not None
        assert await coord_b.claim_next() is None

        # Simulate lease expiry by moving claimed_at into the past.
        async with db() as session:
            now = await current_database_time(session, dialect)
            await session.execute(
                update(models.CleanupTask)
                .where(models.CleanupTask.id == claimed_a.task_id)
                .values(claimed_at=now - timedelta(seconds=31.0))
            )

        # Replica B recovers the lapsed claim onto the 15s error retry delay and immediately claims
        # the second eligible task instead.
        claimed_b = await coord_b.claim_next()
        assert claimed_b is not None
        assert claimed_b.task_id != claimed_a.task_id

        # Stale token from Replica A cannot execute or release the lapsed task.
        stale_res = await coord_a.execute_claimed_step(claimed_a)
        assert stale_res.outcome == "claim_lost"

        # Replica B finishes p2.
        res_b = await coord_b.execute_claimed_step(claimed_b)
        assert res_b.outcome == "completed"

        # Task 1 is still cooling down on available_at (> now); claim_next returns None until ready.
        assert await coord_a.claim_next() is None
        async with db() as session:
            now = await current_database_time(session, dialect)
            await session.execute(
                update(models.CleanupTask)
                .where(models.CleanupTask.id == claimed_a.task_id)
                .values(available_at=now)
            )
        reclaimed = await coord_a.claim_next()
        assert reclaimed is not None and reclaimed.task_id == claimed_a.task_id
        assert (await coord_a.execute_claimed_step(reclaimed)).outcome == "completed"

        async with db() as session:
            assert await session.get(models.Project, p1.id) is None
            assert await session.get(models.Project, p2.id) is None

    async def test_failed_step_schedules_durable_error_backoff_without_dropping_task(
        self, db: DbSessionFactory, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"fail-retry-{token_hex(4)}")
            await admit_project_delete(session, dialect=dialect, project_id=project.id)

        coordinator = CleanupCoordinator(db, error_retry_delay_seconds=10.0)
        claimed = await coordinator.claim_next()
        assert claimed is not None

        async def _boom(*args: object, **kwargs: object) -> object:
            raise RuntimeError("injected step failure")

        monkeypatch.setattr(coordinator, "_run_domain_step", _boom)
        result = await coordinator.execute_claimed_step(claimed)
        assert result.outcome == "error"

        async with db() as session:
            now = await current_database_time(session, dialect)
            task = await session.get(models.CleanupTask, claimed.task_id)
            assert task is not None
            assert task.claimed_at is None
            assert task.claimed_by is None
            assert task.available_at > now + timedelta(seconds=5.0)
            await session.execute(
                update(models.CleanupTask)
                .where(models.CleanupTask.id == claimed.task_id)
                .values(available_at=now)
            )

        monkeypatch.undo()
        assert await _drain_all(coordinator) >= 1
        async with db() as session:
            assert await session.get(models.Project, project.id) is None

    async def test_task_ids_are_monotonic_across_completions(self, db: DbSessionFactory) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        coordinator = CleanupCoordinator(db)

        async with db() as session:
            p1 = await _add_project(session, name=f"seq-1-{token_hex(4)}")
            t1 = await admit_or_reuse_project_clear(session, dialect=dialect, project_id=p1.id)
        await _drain_all(coordinator)

        async with db() as session:
            t2 = await admit_or_reuse_project_clear(session, dialect=dialect, project_id=p1.id)
        assert t2 > t1
        await _drain_all(coordinator)


class TestImmediateNameReuseAndHistoricalReferences:
    async def test_delete_project_allows_immediate_name_reuse_and_isolates_historical_references(
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
                project_id=old_project_id,
            )
            agent = models.AgentSession(
                title="hist-agent",
                project_name=shared_name,
                project_id=old_project_id,
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

        # Historical Experiment.project on GraphQL must NOT resolve to new_project_id.
        exp_query = await gql_client.execute(
            """query($id: ID!) {
                node(id: $id) {
                    ... on Experiment { projectName project { id } }
                }
            }""",
            variables={"id": str(GlobalID("Experiment", str(exp_id)))},
        )
        assert exp_query.data and not exp_query.errors
        assert exp_query.data["node"] == {"projectName": shared_name, "project": None}

        # Drain background cleanup in small batches (batch_limit=2).
        coordinator = CleanupCoordinator(db, batch_limit=2)
        steps = await _drain_all(coordinator)
        assert steps >= 3

        # Verify old_project and its traces are purged, new_project and its trace survive,
        # and historical Experiment / AgentSession rows survive with project_id = NULL.
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
            assert exp_after is not None and exp_after.project_id is None
            assert exp_after.project_name == shared_name
            assert agent_after is not None and agent_after.project_id is None
            assert agent_after.project_name == shared_name

            # Deleting the historical experiment afterward must NEVER delete new_project!
            await session.delete(exp_after)
            await session.flush()
            dialect = SupportedSQLDialect(db.dialect.value)
            deleted_by_exp = await admit_exclusive_experiment_projects_delete(
                session, dialect=dialect, candidate_project_ids=[new_project_id]
            )
            assert deleted_by_exp == []


class TestWatermarkClearAndOverlap:
    async def test_watermark_clear_preserves_above_watermark_traces_and_blocks_sqlite_id_recycling(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        t0 = datetime(2026, 6, 1, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            project = await _add_project(session, name=f"wm-{token_hex(4)}")
            other = await _add_project(session, name=f"other-{token_hex(4)}")
            t_below = await _add_trace(session, project, start_time=t0)
            await _add_span(session, trace=t_below, start_time=t0)
            t_other_tip = await _add_trace(session, other, start_time=t0 + timedelta(seconds=1))
            await _add_span(session, trace=t_other_tip, start_time=t0 + timedelta(seconds=1))

        # Admit watermark clear on `project`; watermark captures >= t_other_tip.id.
        async with db() as session:
            task_id = await admit_or_reuse_project_clear(
                session, dialect=dialect, project_id=project.id
            )
            # Equivalent duplicate clear reuses the exact same task_id.
            dup_task_id = await admit_or_reuse_project_clear(
                session, dialect=dialect, project_id=project.id
            )
            assert dup_task_id == task_id
            # Different range clear is rejected with Conflict while task_id is active.
            with pytest.raises(Conflict):
                await admit_or_reuse_project_clear(
                    session,
                    dialect=dialect,
                    project_id=project.id,
                    end_time=t0 + timedelta(hours=1),
                )

        # Delete the current global-max trace row so SQLite's plain MAX(id)+1 would recycle
        # t_other_tip.id (<= watermark) without our monotonic system_state allocator!
        async with db() as session:
            await session.execute(delete(models.Trace).where(models.Trace.id == t_other_tip.id))

        # Insert a fresh trace into `project` via insert_span after the watermark was captured.
        above_span = Span(
            name="above-watermark",
            context=SpanContext(trace_id=token_hex(16), span_id=token_hex(8)),
            span_kind=SpanKind.LLM,
            parent_id=None,
            start_time=t0 - timedelta(minutes=5),  # Even with an older start_time, id > watermark!
            end_time=t0 - timedelta(minutes=4),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={},
            events=[],
            conversation=None,
        )
        async with db() as session:
            inserted_above = await insert_span(session, above_span, project.name)
        assert inserted_above is not None
        assert inserted_above.trace_rowid > t_other_tip.id

        # Run the clear to completion; t_below is removed and inserted_above survives.
        coordinator = CleanupCoordinator(db, batch_limit=1)
        await _drain_all(coordinator)

        async with db() as session:
            assert await session.get(models.Trace, t_below.id) is None
            assert await session.get(models.Trace, inserted_above.trace_rowid) is not None

    async def test_range_clear_resets_done_session_evaluation_for_surviving_session(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        t0 = datetime(2026, 6, 2, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            project = await _add_project(session, name=f"sess-clear-{token_hex(4)}")
            trace_proj = models.Project(name=f"eval-sink-{token_hex(4)}", kind="EVALUATOR")
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
            newer_trace = await _add_trace(
                session,
                project,
                project_session=proj_session,
                start_time=t0 + timedelta(hours=2),
            )
            await _add_span(session, trace=newer_trace, start_time=t0 + timedelta(hours=2))

            session.add(
                models.EvalSessionWorkUnit(
                    project_session_rowid=proj_session.id,
                    project_evaluator_id=pe.id,
                    decided_through=t0,
                    status="DONE",
                    attempts=1,
                )
            )
            await session.flush()

            await admit_or_reuse_project_clear(
                session,
                dialect=dialect,
                project_id=project.id,
                start_time=t0 - timedelta(minutes=1),
                end_time=t0 + timedelta(hours=1),
            )

        coordinator = CleanupCoordinator(db, batch_limit=2)
        await _drain_all(coordinator)

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

    async def test_delete_during_active_clear_waits_for_clear_and_binding_tasks(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        t0 = datetime(2026, 6, 3, 0, 0, 0, tzinfo=timezone.utc)

        async with db() as session:
            project = await _add_project(session, name=f"overlap-{token_hex(4)}")
            trace_proj = models.Project(name=f"eval-trace-{token_hex(4)}", kind="EVALUATOR")
            evaluator = models.BuiltinEvaluator(
                name=Identifier(root=f"bi-{token_hex(4)}"),
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
                name=Identifier(root="span-eval"),
                evaluation_target="SPAN",
                filter_condition="",
                sampling_rate=1.0,
            )
            session.add(pe)
            await session.flush()
            tr = await _add_trace(session, project, start_time=t0)
            await _add_span(session, trace=tr, start_time=t0)

            clear_task_id = await admit_or_reuse_project_clear(
                session, dialect=dialect, project_id=project.id
            )
            await admit_project_delete(session, dialect=dialect, project_id=project.id)

        coordinator = CleanupCoordinator(db, batch_limit=1)
        # First claimed task must NOT be DELETE_PROJECT while clear_task_id and binding task exist.
        first_claim = await coordinator.claim_next()
        assert first_claim is not None
        assert first_claim.kind in ("CLEAR_PROJECT_TRACES", "DELETE_PROJECT_EVALUATOR")
        await coordinator.execute_claimed_step(first_claim)
        await _drain_all(coordinator)

        async with db() as session:
            assert await session.get(models.CleanupTask, clear_task_id) is None
            assert await session.get(models.Project, project.id) is None
            assert await session.get(models.Project, trace_proj.id) is None
            assert await session.get(models.ProjectEvaluator, pe.id) is None


class TestEvaluatorSnapshotsAndOnlineEvalFences:
    async def test_pinned_code_evaluator_snapshot_survives_synchronous_definition_gc(
        self,
        db: DbSessionFactory,
        sandbox_config: models.SandboxConfig,
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            dataset = models.Dataset(name=f"snap-ds-{token_hex(4)}", metadata_={})
            trace_proj = models.Project(name=f"snap-eval-proj-{token_hex(4)}", kind="EVALUATOR")
            code_eval_name = f"code-{token_hex(4)}"
            code_eval = models.CodeEvaluator(
                name=Identifier(root=code_eval_name),
                kind="CODE",
                language="PYTHON",
                sandbox_config_id=sandbox_config.id,
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[
                    ContinuousOutputConfig(
                        type="CONTINUOUS",
                        name="score",
                        optimization_direction=OptimizationDirection.MAXIMIZE,
                    )
                ],
                metadata_={},
            )
            session.add_all([dataset, trace_proj, code_eval])
            await session.flush()
            version = models.CodeEvaluatorVersion(
                code_evaluator_id=code_eval.id,
                source_code="def evaluate(output):\n    return {'score': 1.0}\n",
            )
            session.add(version)
            await session.flush()
            binding = models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=code_eval.id,
                project_id=trace_proj.id,
                name=Identifier(root="pinned-code"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            )
            session.add(binding)
            await session.flush()

            pinned = await pin_evaluator_definition(
                stored_evaluator_definition(
                    code_eval,
                    name=binding.name.root,
                    description=binding.description,
                    dataset_evaluator_id=binding.id,
                    code_evaluator_version_id=version.id,
                ),
                session=session,
            )

            # Logically delete the sole binding with synchronous definition GC.
            await logical_delete_dataset_evaluators(
                session,
                dialect=dialect,
                binding_ids=[binding.id],
                collect_unused_evaluator=True,
                collect_unused_source=False,
            )

        async with db() as session:
            # Both CodeEvaluator and CodeEvaluatorVersion are already deleted synchronously!
            assert await session.get(models.CodeEvaluator, code_eval.id) is None
            assert await session.get(models.CodeEvaluatorVersion, version.id) is None
            # Rebuilding the experiment's pinned definition still succeeds without DB rows!
            rebuilt = await build_evaluator_from_definition(
                definition=pinned,
                session=session,
                decrypt=lambda b: b,
                sandbox_runtime=SandboxRuntimeContext(monty=MontyRuntime()),
                sandbox_session_manager=SandboxSessionManager(),
                session_key="test-snap",
            )
            assert rebuilt.name == code_eval_name

    async def test_online_eval_fences_tombstoned_binding_on_hydration_publish_and_traces(
        self, db: DbSessionFactory
    ) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            project = await _add_project(session, name=f"oe-{token_hex(4)}")
            trace_proj = models.Project(name=f"oe-sink-{token_hex(4)}", kind="EVALUATOR")
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
                collect_unused_source=False,
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
            trace_proj = models.Project(name=f"locked-sink-{token_hex(4)}", kind="EVALUATOR")
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
    async def test_live_cleanup_worker_wakes_and_drains(self, db: DbSessionFactory) -> None:
        dialect = SupportedSQLDialect(db.dialect.value)
        async with db() as session:
            proj = await _add_project(session, name=f"daemon-proj-{token_hex(4)}")
            tr = await _add_trace(session, proj)
            await _add_span(session, trace=tr)
            await admit_project_delete(session, dialect=dialect, project_id=proj.id)
            task_id = await session.scalar(
                select(models.ProjectDeleteCleanupTask.id).where(
                    models.ProjectDeleteCleanupTask.project_id == proj.id
                )
            )
            assert task_id is not None

        worker = CleanupWorker(db, idle_poll_seconds=10.0)
        async with worker:
            worker.wake()
            finished = await worker.coordinator.wait_for_completion(
                task_id, timeout_seconds=5.0, drive=False
            )
            assert finished is True

        async with db() as session:
            assert await session.get(models.Project, proj.id) is None

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
