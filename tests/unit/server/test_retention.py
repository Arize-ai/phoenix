from asyncio import Event, create_task, wait, wait_for
from asyncio import TimeoutError as AsyncTimeoutError
from datetime import datetime, timedelta, timezone
from math import ceil
from secrets import token_hex
from typing import Any, AsyncIterator, Literal, Union
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa
from prometheus_client import REGISTRY
from sqlalchemy import event, func
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import selectinload
from starlette.types import ASGIApp

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.trace_retention import (
    MaxCountRule,
    MaxDaysOrCountRule,
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.api.dataloaders import CacheForDataLoaders
from phoenix.server.api.dataloaders.record_counts import Key as RecordCountKey
from phoenix.server.api.dataloaders.record_counts import RecordCountDataLoader
from phoenix.server.dml_event import SpanDeleteEvent
from phoenix.server.dml_event_handler import DmlEventHandler
from phoenix.server.retention import TraceDataSweeper
from phoenix.server.types import DbSessionFactory


class _SweeperController:
    """Drives the TraceDataSweeper one sweep at a time in place of its hourly sleep.

    The sweeper parks in ``park`` where it would otherwise sleep. ``sweep`` releases it once
    and returns when it has parked again, which is after that sweep has run to completion,
    so a test never has to guess how long a sweep takes. Supports one caller at a time.
    """

    def __init__(self) -> None:
        self._release = Event()
        self._parked = Event()

    async def park(self, *_: Any, **__: Any) -> None:
        self._parked.set()
        await self._release.wait()
        self._release.clear()

    async def sweep(self, timeout: float = 30.0) -> None:
        await self._parked_within(timeout, "the sweeper never parked")
        self._parked.clear()
        self._release.set()
        await self._parked_within(timeout, "the sweep did not finish")

    async def _parked_within(self, timeout: float, failure: str) -> None:
        try:
            await wait_for(self._parked.wait(), timeout)
        except AsyncTimeoutError:
            pytest.fail(f"{failure} within {timeout:.0f}s")


class TestTraceDataSweeper:
    @pytest.fixture(autouse=True)
    async def sweeper_trigger(self) -> AsyncIterator[_SweeperController]:
        """Patch sleep before app startup for every test in this class.

        Autouse ensures the patch precedes ``asgi_app`` regardless of test parameter order.
        Each test gets a fresh controller, and app teardown runs before the patch is removed.
        """
        controller = _SweeperController()
        with patch.object(TraceDataSweeper, "_sleep_until_next_hour", controller.park):
            yield controller

    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_max_count_rule(
        self,
        use_default_policy: bool,
        db: DbSessionFactory,
        asgi_app: ASGIApp,
        sweeper_trigger: _SweeperController,
    ) -> None:
        """Test that TraceDataSweeper correctly enforces trace retention policies.

        This test verifies that the sweeper:
        1. Respects the retention rule by keeping exactly the specified number of traces
        2. Keeps the most recent traces by comparing sets of trace_ids before and after sweep
        3. Works with both default and custom policies
        4. Maintains correct retention across multiple sweeps
        5. Correctly applies to multiple projects

        Test flow:
        1. Creates multiple projects with more traces than we want to keep
        2. Sets up a retention policy to keep a fixed number of traces
        3. Runs multiple sweeps to verify consistent behavior:
           - Creates new traces to bring total back to initial count
           - Captures the set of most recent trace_ids using ordered query
           - Triggers sweeper and waits for processing
           - Verifies that the remaining trace_ids exactly match the most recent set
        """
        # Test configuration
        num_projects = 3  # Test with multiple projects
        traces_to_keep = 3  # Number of traces to retain per project
        initial_traces = 2 * traces_to_keep  # Total traces to create per project
        assert initial_traces > traces_to_keep, "Must create more traces than we want to keep"

        # Configure retention policy
        retention_rule = TraceRetentionRule(root=MaxCountRule(max_count=traces_to_keep))
        hourly_schedule = TraceRetentionCronExpression(root="0 * * * *")

        # Setup: Create projects and policy
        async with db() as session:
            projects = [models.Project(name=token_hex(8)) for _ in range(num_projects)]
            session.add_all(projects)
            await session.flush()
            project_ids = [p.id for p in projects]

            if use_default_policy:
                policy = await session.get(
                    models.ProjectTraceRetentionPolicy,
                    DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                )
                assert policy is not None, "Default policy should exist"
            else:
                policy = models.ProjectTraceRetentionPolicy(
                    name=token_hex(8),
                    projects=projects,
                )
            policy.rule = retention_rule
            policy.cron_expression = hourly_schedule
            await session.merge(policy)

        # Run multiple sweeps to verify retention works consistently
        num_retention_cycles = 2
        assert num_retention_cycles >= 2, "Must run at least twice"
        project_current_trace_count = {pid: 0 for pid in project_ids}

        for retention_cycle in range(num_retention_cycles):
            # Create new batch of traces for each project
            async with db() as session:
                for project_id in project_ids:
                    traces_to_create = initial_traces - project_current_trace_count[project_id]
                    assert traces_to_create, "Must create more traces than we want to keep"
                    base_time = datetime.now(timezone.utc)
                    session.add_all(
                        [
                            models.Trace(
                                project_rowid=project_id,
                                trace_id=token_hex(16),
                                start_time=base_time + timedelta(seconds=i),
                                end_time=base_time + timedelta(seconds=i + 1),
                            )
                            for i in range(traces_to_create)
                        ]
                    )

            # Verify initial state and capture expected trace_ids for each project
            project_expected_trace_ids = {}
            async with db() as session:
                for project_id in project_ids:
                    traces_before_sweep = await session.scalar(
                        sa.select(func.count(models.Trace.id)).filter_by(project_rowid=project_id)
                    )
                    assert traces_before_sweep == initial_traces, (
                        f"Project {project_id}: Initial trace count mismatch in cycle {retention_cycle}"
                    )

                    # Get the trace_ids of the most recent traces before sweep
                    expected_trace_ids = set(
                        (
                            await session.scalars(
                                sa.select(models.Trace.trace_id)
                                .filter_by(project_rowid=project_id)
                                .order_by(models.Trace.start_time.desc())
                                .limit(traces_to_keep)
                            )
                        ).all()
                    )
                    project_expected_trace_ids[project_id] = expected_trace_ids

            # Execute sweeper
            await sweeper_trigger.sweep()

            # Verify final state for each project
            async with db() as session:
                for project_id in project_ids:
                    # Get the trace_ids in the database after the sweep
                    remaining_trace_ids = set(
                        (
                            await session.scalars(
                                sa.select(models.Trace.trace_id).filter_by(project_rowid=project_id)
                            )
                        ).all()
                    )

                    # Verify we kept exactly the expected traces
                    expected_trace_ids = project_expected_trace_ids[project_id]
                    assert remaining_trace_ids == expected_trace_ids, (
                        f"Project {project_id}: Trace IDs mismatch in cycle {retention_cycle}"
                    )

                    project_current_trace_count[project_id] = len(remaining_trace_ids)

    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_max_days_rule(
        self,
        use_default_policy: bool,
        db: DbSessionFactory,
        asgi_app: ASGIApp,
        sweeper_trigger: _SweeperController,
    ) -> None:
        """Test that TraceDataSweeper correctly enforces time-based retention policies.

        This test verifies that the sweeper:
        1. Deletes traces older than the specified max_days threshold
        2. Keeps traces within the max_days window
        3. Works with both default and custom policies
        4. Correctly applies to multiple projects

        Test flow:
        1. Creates multiple projects with both old and recent traces
        2. Sets up a retention policy with max_days threshold
        3. Captures the set of expected trace_ids (within max_days window) for each project
        4. Triggers sweeper and waits for processing
        5. Verifies that only recent traces remain in each project
        """
        # Test configuration
        project_kinds = ("STANDARD", "PLAYGROUND", "EXPERIMENT", "EVALUATOR")
        max_days = 7  # Keep traces from last 7 days
        old_traces_count = 5  # Number of old traces (> max_days) per project
        recent_traces_count = 5  # Number of recent traces (< max_days) per project
        initial_traces = old_traces_count + recent_traces_count
        assert initial_traces > recent_traces_count, "Must create some old traces to delete"

        # Configure retention policy
        retention_rule = TraceRetentionRule(root=MaxDaysRule(max_days=max_days))
        hourly_schedule = TraceRetentionCronExpression(root="0 * * * *")

        # Setup: Create projects and policy
        async with db() as session:
            projects = [models.Project(name=token_hex(8), kind=kind) for kind in project_kinds]
            session.add_all(projects)
            await session.flush()
            project_ids = [p.id for p in projects]

            if use_default_policy:
                policy = await session.get(
                    models.ProjectTraceRetentionPolicy,
                    DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                )
                assert policy is not None, "Default policy should exist"
            else:
                policy = models.ProjectTraceRetentionPolicy(
                    name=token_hex(8),
                    projects=projects,
                )
            policy.rule = retention_rule
            policy.cron_expression = hourly_schedule
            await session.merge(policy)

        # Create traces for each project: mix of old and recent
        project_expected_trace_ids = {}

        async with db() as session:
            now = datetime.now(timezone.utc)

            for project_id in project_ids:
                # Old traces (should be deleted)
                for i in range(old_traces_count):
                    trace = models.Trace(
                        project_rowid=project_id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(days=max_days + 3 + i),
                        end_time=now - timedelta(days=max_days + 3 + i) + timedelta(seconds=1),
                    )
                    session.add(trace)

                # Recent traces (should be kept)
                expected_kept_trace_ids = set()
                for i in range(recent_traces_count):
                    trace = models.Trace(
                        project_rowid=project_id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(days=i),
                        end_time=now - timedelta(days=i) + timedelta(seconds=1),
                    )
                    session.add(trace)
                    expected_kept_trace_ids.add(trace.trace_id)

                project_expected_trace_ids[project_id] = expected_kept_trace_ids

        # Verify initial state for each project
        async with db() as session:
            for project_id in project_ids:
                traces_before_sweep = await session.scalar(
                    sa.select(func.count(models.Trace.id)).filter_by(project_rowid=project_id)
                )
                assert traces_before_sweep == initial_traces, (
                    f"Project {project_id} should have {initial_traces} traces before sweep, "
                    f"has {traces_before_sweep}"
                )

        # Execute sweeper
        await sweeper_trigger.sweep()

        # Verify final state for each project
        async with db() as session:
            for project_id in project_ids:
                remaining_trace_ids = set(
                    (
                        await session.scalars(
                            sa.select(models.Trace.trace_id).filter_by(project_rowid=project_id)
                        )
                    ).all()
                )

                # Verify we kept only the recent traces
                expected_trace_ids = project_expected_trace_ids[project_id]
                assert remaining_trace_ids == expected_trace_ids, (
                    f"Project {project_id} trace IDs mismatch: "
                    f"expected {expected_trace_ids}, got {remaining_trace_ids}"
                )

    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_max_days_or_count_rule(
        self,
        use_default_policy: bool,
        db: DbSessionFactory,
        asgi_app: ASGIApp,
        sweeper_trigger: _SweeperController,
    ) -> None:
        """Test that TraceDataSweeper correctly enforces OR-based retention policies.

        This test verifies that the sweeper:
        1. Deletes traces that violate EITHER max_days OR max_count constraints
        2. Keeps traces that satisfy BOTH constraints (recent AND within count)
        3. Works with both default and custom policies
        4. Correctly applies to multiple projects

        To ensure both rules are independently tested, we structure projects so that:
        - Project 0: Tests max_days enforcement (few traces, but some are old)
        - Project 1: Tests max_count enforcement (many recent traces, none are old)

        Test flow:
        1. Creates projects with different trace patterns to test each rule independently
        2. Sets up a retention policy with both max_days and max_count thresholds
        3. Triggers sweeper and waits for processing
        4. Verifies correct retention behavior for each project
        """
        # Test configuration
        max_days = 7  # Keep traces from last 7 days
        max_count = 5  # Keep at most 5 traces

        # Configure retention policy
        retention_rule = TraceRetentionRule(
            root=MaxDaysOrCountRule(max_days=max_days, max_count=max_count)
        )
        hourly_schedule = TraceRetentionCronExpression(root="0 * * * *")

        # Setup: Create projects and policy
        async with db() as session:
            # Project 0: Tests max_days (3 traces: 2 old, 1 recent)
            project_max_days = models.Project(name="test_max_days_" + token_hex(8))
            # Project 1: Tests max_count (10 recent traces, all within max_days)
            project_max_count = models.Project(name="test_max_count_" + token_hex(8))

            projects = [project_max_days, project_max_count]
            session.add_all(projects)
            await session.flush()

            if use_default_policy:
                policy = await session.get(
                    models.ProjectTraceRetentionPolicy,
                    DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                )
                assert policy is not None, "Default policy should exist"
            else:
                policy = models.ProjectTraceRetentionPolicy(
                    name=token_hex(8),
                    projects=projects,
                )
            policy.rule = retention_rule
            policy.cron_expression = hourly_schedule
            await session.merge(policy)

        # Create traces with different patterns per project
        project_test_cases = {}
        now = datetime.now(timezone.utc)

        async with db() as session:
            # Project 0: Test max_days enforcement
            # Create 2 old traces (should be deleted) and 1 recent trace (should be kept)
            project_max_days_tmp = await session.get(models.Project, projects[0].id)
            assert project_max_days_tmp is not None
            project_max_days = project_max_days_tmp
            for i in range(2):
                session.add(
                    models.Trace(
                        project_rowid=project_max_days.id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(days=max_days + 3 + i),
                        end_time=now - timedelta(days=max_days + 3 + i) + timedelta(seconds=1),
                    )
                )
            recent_trace_id = token_hex(16)
            session.add(
                models.Trace(
                    project_rowid=project_max_days.id,
                    trace_id=recent_trace_id,
                    start_time=now - timedelta(hours=1),
                    end_time=now - timedelta(hours=1) + timedelta(seconds=1),
                )
            )
            project_test_cases[project_max_days.id] = {
                "initial_count": 3,
                "expected_trace_ids": {recent_trace_id},
                "description": "max_days rule",
            }

            # Project 1: Test max_count enforcement
            # Create 10 recent traces (all within max_days), should keep only 5 most recent
            project_max_count_tmp = await session.get(models.Project, projects[1].id)
            assert project_max_count_tmp is not None
            project_max_count = project_max_count_tmp
            expected_trace_ids_max_count = set()
            for i in range(10):
                trace_id = token_hex(16)
                session.add(
                    models.Trace(
                        project_rowid=project_max_count.id,
                        trace_id=trace_id,
                        start_time=now - timedelta(hours=i),
                        end_time=now - timedelta(hours=i) + timedelta(seconds=1),
                    )
                )
                # The first 5 traces (i=0-4) are the most recent and should be kept
                if i < max_count:
                    expected_trace_ids_max_count.add(trace_id)
            project_test_cases[project_max_count.id] = {
                "initial_count": 10,
                "expected_trace_ids": expected_trace_ids_max_count,
                "description": "max_count rule",
            }

        # Verify initial state for each project
        async with db() as session:
            for project_id, test_case in project_test_cases.items():
                traces_before_sweep = await session.scalar(
                    sa.select(func.count(models.Trace.id)).filter_by(project_rowid=project_id)
                )
                assert traces_before_sweep == test_case["initial_count"], (
                    f"Project {project_id} ({test_case['description']}): "
                    f"should have {test_case['initial_count']} traces before sweep, "
                    f"has {traces_before_sweep}"
                )

        # Execute sweeper
        await sweeper_trigger.sweep()

        # Verify final state for each project
        async with db() as session:
            for project_id, test_case in project_test_cases.items():
                remaining_trace_ids = set(
                    (
                        await session.scalars(
                            sa.select(models.Trace.trace_id).filter_by(project_rowid=project_id)
                        )
                    ).all()
                )

                # Verify we kept the expected traces
                expected_trace_ids = test_case["expected_trace_ids"]
                assert remaining_trace_ids == expected_trace_ids, (
                    f"Project {project_id} ({test_case['description']}): "
                    f"trace IDs mismatch: expected {expected_trace_ids}, got {remaining_trace_ids}"
                )


class TestOrphanSessionSweep:
    """_delete_orphan_sessions removes sessions with no remaining traces once
    their last activity (end_time) is older than the grace period.
    """

    @staticmethod
    def _sweeper(db: DbSessionFactory) -> TraceDataSweeper:
        sweeper = TraceDataSweeper(db=db, dml_event_handler=MagicMock())
        # The batch loop checks self._running; start() is deliberately not called
        # so the sweep can be driven synchronously.
        sweeper._running = True
        return sweeper

    @staticmethod
    async def _add_session(
        session: Any,
        project_id: int,
        end_time: datetime,
        with_trace: bool,
    ) -> int:
        project_session = models.ProjectSession(
            session_id=token_hex(8),
            project_id=project_id,
            start_time=end_time - timedelta(minutes=5),
            end_time=end_time,
        )
        session.add(project_session)
        await session.flush()
        if with_trace:
            session.add(
                models.Trace(
                    trace_id=token_hex(16),
                    project_rowid=project_id,
                    project_session_rowid=project_session.id,
                    start_time=end_time - timedelta(minutes=5),
                    end_time=end_time,
                )
            )
            await session.flush()
        return int(project_session.id)

    async def test_deletes_only_old_orphans(
        self,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        old, recent = now - timedelta(hours=2), now - timedelta(minutes=10)
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()
            old_orphan = await self._add_session(session, project.id, old, with_trace=False)
            recent_orphan = await self._add_session(session, project.id, recent, with_trace=False)
            old_with_trace = await self._add_session(session, project.id, old, with_trace=True)
            recent_with_trace = await self._add_session(
                session, project.id, recent, with_trace=True
            )
            # An annotation on the old orphan must cascade away with the session.
            session.add(
                models.ProjectSessionAnnotation(
                    project_session_id=old_orphan,
                    name=token_hex(4),
                    metadata_={},
                    annotator_kind="HUMAN",
                    source="APP",
                )
            )

        await self._sweeper(db)._delete_orphan_sessions()

        async with db() as session:
            remaining = set((await session.scalars(sa.select(models.ProjectSession.id))).all())
            num_annotations = await session.scalar(
                sa.select(func.count(models.ProjectSessionAnnotation.id))
            )
        assert old_orphan not in remaining, "old orphan should be deleted"
        assert {recent_orphan, old_with_trace, recent_with_trace} <= remaining, (
            "recent orphans and sessions with traces should be kept"
        )
        assert num_annotations == 0, "the deleted session's annotation should cascade away"

    async def test_deletes_in_batches(
        self,
        db: DbSessionFactory,
    ) -> None:
        now = datetime.now(timezone.utc)
        num_orphans = 3
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()
            orphan_ids = {
                await self._add_session(
                    session, project.id, now - timedelta(hours=2), with_trace=False
                )
                for _ in range(num_orphans)
            }

        with patch("phoenix.server.retention._ORPHAN_SESSION_DELETE_BATCH_SIZE", 1):
            await self._sweeper(db)._delete_orphan_sessions()

        async with db() as session:
            remaining = set((await session.scalars(sa.select(models.ProjectSession.id))).all())
        assert not (orphan_ids & remaining), "all orphans should be deleted across batches"


class TestRetentionPolicyConcurrentSweep:
    """A replica's retention sweep must not queue behind another replica's in-flight delete."""

    async def test_skips_traces_locked_by_another_replica(
        self,
        dialect: str,
        db: DbSessionFactory,
    ) -> None:
        if dialect == "sqlite":
            pytest.skip("SQLite allows one writer at a time")
        max_days = 7
        num_expired = 20
        now = datetime.now(timezone.utc)
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()
            expired = [
                models.Trace(
                    project_rowid=project.id,
                    trace_id=token_hex(16),
                    start_time=now - timedelta(days=max_days + 1 + i),
                    end_time=now - timedelta(days=max_days + 1 + i) + timedelta(seconds=1),
                )
                for i in range(num_expired)
            ]
            recent = models.Trace(
                project_rowid=project.id,
                trace_id=token_hex(16),
                start_time=now - timedelta(hours=1),
                end_time=now - timedelta(hours=1) + timedelta(seconds=1),
            )
            session.add_all([*expired, recent])
            policy = await session.get(
                models.ProjectTraceRetentionPolicy,
                DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
            )
            assert policy is not None
            policy.rule = TraceRetentionRule(root=MaxDaysRule(max_days=max_days))
            policy.cron_expression = TraceRetentionCronExpression(root="0 * * * *")
        locked_trace_id = expired[0].trace_id

        sweeper = TraceDataSweeper(db=db, dml_event_handler=MagicMock())
        sweeper._running = True
        (policy,) = [
            p
            for p in await sweeper._get_policies()
            if p.id == DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
        ]

        async def count_traces() -> int:
            async with db() as session:
                return int(
                    await session.scalar(
                        sa.select(func.count(models.Trace.id)).filter_by(project_rowid=project.id)
                    )
                    or 0
                )

        # Another replica is partway through deleting one expired trace: its
        # transaction holds that row's lock and has not committed yet.
        async with db() as other_replica:
            await other_replica.execute(
                sa.delete(models.Trace).where(models.Trace.trace_id == locked_trace_id)
            )
            sweep = create_task(sweeper._apply(policy))
            await wait({sweep}, timeout=10)
            remaining_while_locked = await count_traces()
            await other_replica.rollback()
        await sweep

        # Every expired trace except the locked one is deletable now; this
        # replica should have deleted them rather than waiting on the lock.
        assert remaining_while_locked == 2, (
            f"{num_expired - 1} expired traces were not locked by anyone, but after 10s "
            f"{num_expired + 1 - remaining_while_locked} of them had been deleted "
            f"({remaining_while_locked} traces remain) while another replica held one row lock"
        )


class TestRetentionPolicyBatchedDelete:
    """Verify batch bounds, partial commits, and deletion events."""

    @staticmethod
    async def _seed_backlog(
        db: DbSessionFactory,
        rule: Union[MaxDaysRule, MaxCountRule, MaxDaysOrCountRule],
        num_expired: int,
    ) -> tuple[int, str, str]:
        """Add a project with `num_expired` expired traces and one recent trace, and a
        policy for it. Returns the project id, the recent trace id and the policy name."""
        now = datetime.now(timezone.utc)
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)
            await session.flush()
            session.add_all(
                models.Trace(
                    project_rowid=project.id,
                    trace_id=token_hex(16),
                    start_time=now - timedelta(days=8 + i),
                    end_time=now - timedelta(days=8 + i) + timedelta(seconds=1),
                )
                for i in range(num_expired)
            )
            recent = models.Trace(
                project_rowid=project.id,
                trace_id=token_hex(16),
                start_time=now - timedelta(hours=1),
                end_time=now - timedelta(hours=1) + timedelta(seconds=1),
            )
            session.add(recent)
            policy = models.ProjectTraceRetentionPolicy(
                name=token_hex(8),
                rule=TraceRetentionRule(root=rule),
                cron_expression=TraceRetentionCronExpression(root="0 * * * *"),
                projects=[project],
            )
            session.add(policy)
        return project.id, recent.trace_id, policy.name

    @staticmethod
    async def _get_policy(
        sweeper: TraceDataSweeper,
        policy_name: str,
    ) -> models.ProjectTraceRetentionPolicy:
        (policy,) = [p for p in await sweeper._get_policies() if p.name == policy_name]
        return policy

    @staticmethod
    async def _list_trace_ids(db: DbSessionFactory, project_id: int) -> set[str]:
        async with db() as session:
            return set(
                (
                    await session.scalars(
                        sa.select(models.Trace.trace_id).filter_by(project_rowid=project_id)
                    )
                ).all()
            )

    @staticmethod
    def _patched_batch_size(batch_size: int) -> Any:
        original = TraceRetentionRule.delete_traces_in_batches

        async def delete_with_batch_size(
            self: TraceRetentionRule, db: DbSessionFactory, project_rowids: Any, **kwargs: Any
        ) -> set[int]:
            return await original(self, db, project_rowids, batch_size=batch_size)

        return patch.object(TraceRetentionRule, "delete_traces_in_batches", delete_with_batch_size)

    @staticmethod
    def _count_executions(status: Literal["success", "error"]) -> float:
        return (
            REGISTRY.get_sample_value(
                "phoenix_retention_policy_executions_total", {"status": status}
            )
            or 0.0
        )

    @pytest.mark.parametrize(
        "rule",
        [
            pytest.param(MaxDaysRule(max_days=7), id="max_days"),
            pytest.param(MaxCountRule(max_count=1), id="max_count"),
            pytest.param(MaxDaysOrCountRule(max_days=7, max_count=1), id="max_days_or_count"),
        ],
    )
    async def test_deletes_backlog_in_bounded_batches(
        self,
        rule: Union[MaxDaysRule, MaxCountRule, MaxDaysOrCountRule],
        db: DbSessionFactory,
    ) -> None:
        batch_size = 2
        num_expired = 5
        project_id, recent_trace_id, policy_name = await self._seed_backlog(db, rule, num_expired)
        dml_event_handler = MagicMock()
        sweeper = TraceDataSweeper(db=db, dml_event_handler=dml_event_handler)
        sweeper._running = True
        policy = await self._get_policy(sweeper, policy_name)

        num_traces_deleted_per_statement: list[int] = []
        num_traces_before_statement: list[int] = []

        def count_traces(conn: Any) -> int:
            return int(conn.exec_driver_sql("SELECT count(*) FROM traces").scalar_one())

        def before_trace_delete(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            if "DELETE FROM traces" in statement:
                num_traces_before_statement.append(count_traces(conn))

        def after_trace_delete(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            if "DELETE FROM traces" in statement:
                num_traces_deleted_per_statement.append(
                    num_traces_before_statement.pop() - count_traces(conn)
                )

        sa.event.listen(sa.engine.Engine, "before_cursor_execute", before_trace_delete)
        sa.event.listen(sa.engine.Engine, "after_cursor_execute", after_trace_delete)
        try:
            with self._patched_batch_size(batch_size):
                await sweeper._apply(policy)
        finally:
            sa.event.remove(sa.engine.Engine, "before_cursor_execute", before_trace_delete)
            sa.event.remove(sa.engine.Engine, "after_cursor_execute", after_trace_delete)

        remaining_trace_ids = await self._list_trace_ids(db, project_id)
        assert remaining_trace_ids == {recent_trace_id}, "every expired trace should be deleted"
        assert sum(num_traces_deleted_per_statement) == num_expired
        dml_event_handler.put.assert_called_once_with(SpanDeleteEvent((project_id,)))
        min_num_statements = ceil(num_expired / batch_size)
        assert len(num_traces_deleted_per_statement) >= min_num_statements, (
            f"{num_expired} expired traces were deleted in "
            f"{len(num_traces_deleted_per_statement)} DELETE statement(s); with a batch size "
            f"of {batch_size} that takes at least {min_num_statements}"
        )
        assert max(num_traces_deleted_per_statement) <= batch_size, (
            f"a single DELETE removed {max(num_traces_deleted_per_statement)} traces; "
            f"each retention DELETE should remove at most {batch_size} "
            f"(deletes per statement: {num_traces_deleted_per_statement})"
        )

    @pytest.mark.parametrize("dialect", ["sqlite"], indirect=True)
    async def test_invalidates_cached_trace_count(self, db: DbSessionFactory) -> None:
        project_id, _, policy_name = await self._seed_backlog(
            db, MaxDaysRule(max_days=7), num_expired=1
        )
        cache = CacheForDataLoaders()
        count_key: RecordCountKey = ("trace", project_id, None, None, None)
        assert await RecordCountDataLoader(db, cache.record_count).load(count_key) == 2
        event_handler = DmlEventHandler(
            db=db, last_updated_at=MagicMock(), cache_for_dataloaders=cache
        )
        sweeper = TraceDataSweeper(db=db, dml_event_handler=event_handler)
        sweeper._running = True
        policy = await self._get_policy(sweeper, policy_name)

        await sweeper._apply(policy)
        for handler in event_handler._all_handlers:
            await handler()

        assert await RecordCountDataLoader(db, cache.record_count).load(count_key) == 1

    async def test_keeps_committed_batches_when_a_later_batch_fails(
        self,
        db: DbSessionFactory,
    ) -> None:
        batch_size = 2
        num_expired = 5
        project_id, _, policy_name = await self._seed_backlog(
            db, MaxDaysRule(max_days=7), num_expired
        )
        dml_event_handler = MagicMock()
        sweeper = TraceDataSweeper(db=db, dml_event_handler=dml_event_handler)
        sweeper._running = True
        policy = await self._get_policy(sweeper, policy_name)
        num_trace_deletes = 0

        def fail_second_trace_delete(
            conn: Any,
            cursor: Any,
            statement: str,
            parameters: Any,
            context: Any,
            executemany: bool,
        ) -> None:
            nonlocal num_trace_deletes
            if "DELETE FROM traces" in statement:
                num_trace_deletes += 1
                if num_trace_deletes == 2:
                    raise RuntimeError("the database failed the second batch")

        num_successes, num_errors = (
            self._count_executions("success"),
            self._count_executions("error"),
        )
        sa.event.listen(sa.engine.Engine, "before_cursor_execute", fail_second_trace_delete)
        try:
            with self._patched_batch_size(batch_size):
                await sweeper._apply(policy)
        finally:
            sa.event.remove(sa.engine.Engine, "before_cursor_execute", fail_second_trace_delete)

        remaining_trace_ids = await self._list_trace_ids(db, project_id)
        assert len(remaining_trace_ids) == num_expired + 1 - batch_size, (
            "the first batch committed before the second failed, so its deletes should stay"
        )
        assert self._count_executions("error") == num_errors + 1
        assert self._count_executions("success") == num_successes


@pytest.mark.postgres_only
async def test_retention_yields_when_trace_spans_are_locked(postgresql_engine: Any) -> None:
    from phoenix.server.app import _db
    from tests.unit._helpers import _add_project, _add_span, _add_trace

    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        locked_project = await _add_project(session, name=f"locked-retention-{token_hex(4)}")
        locked_trace = await _add_trace(
            session, locked_project, start_time=datetime(2020, 1, 1, tzinfo=timezone.utc)
        )
        locked_span = await _add_span(session, trace=locked_trace)
        unblocked_project = await _add_project(session, name=f"unblocked-retention-{token_hex(4)}")
        unblocked_trace = await _add_trace(
            session, unblocked_project, start_time=datetime(2020, 1, 2, tzinfo=timezone.utc)
        )
        await _add_span(session, trace=unblocked_trace)
    async with db() as locker:
        await locker.execute(
            sa.select(models.Span.id).where(models.Span.id == locked_span.id).with_for_update()
        )
        affected_project_ids = await wait_for(
            MaxDaysRule(max_days=1).delete_traces_in_batches(
                db, [locked_project.id, unblocked_project.id], batch_size=1
            ),
            5,
        )
        assert await locker.get(models.Trace, locked_trace.id) is not None
        assert await locker.get(models.Trace, unblocked_trace.id) is None
        assert affected_project_ids == {unblocked_project.id}
    affected_after_unlock = await MaxDaysRule(max_days=1).delete_traces_in_batches(
        db, [locked_project.id, unblocked_project.id], batch_size=1
    )
    assert affected_after_unlock == {locked_project.id}
    async with db() as session:
        assert await session.get(models.Trace, locked_trace.id) is None


async def test_count_retention_ranks_once_per_sweep_and_breaks_timestamp_ties(
    db: DbSessionFactory,
) -> None:
    from tests.unit._helpers import _add_project, _add_span, _add_trace

    shared_timestamp = datetime(2020, 1, 1, tzinfo=timezone.utc)
    newer_timestamp = datetime(2021, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session, name=f"rank-retention-{token_hex(4)}")
        tied_traces = [
            await _add_trace(session, project, start_time=shared_timestamp) for _ in range(4)
        ]
        for trace in tied_traces:
            for _ in range(2):
                await _add_span(session, trace=trace)
        newest_trace = await _add_trace(session, project, start_time=newer_timestamp)
        await _add_span(session, trace=newest_trace)
        engine = session.bind
        assert engine is not None

    row_number_queries: list[str] = []
    cutoff_queries: list[str] = []

    def record_query(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        if "row_number()" in statement:
            row_number_queries.append(statement)
        if "ORDER BY traces.start_time DESC, traces.id DESC" in statement:
            cutoff_queries.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", record_query)
    try:
        affected_project_ids = await MaxCountRule(max_count=2).delete_traces_in_batches(
            db, [project.id], batch_size=1
        )
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", record_query)
    assert row_number_queries == []
    assert len(cutoff_queries) == 1
    assert affected_project_ids == {project.id}
    async with db() as session:
        surviving_ids = set(
            (
                await session.scalars(
                    sa.select(models.Trace.id).where(models.Trace.project_rowid == project.id)
                )
            ).all()
        )
    assert surviving_ids == {newest_trace.id, tied_traces[-1].id}


@pytest.mark.parametrize("use_default_policy", [True, False])
@pytest.mark.parametrize("rule_kind", ["max_days", "max_count", "max_days_or_count"])
async def test_apply_emits_span_delete_event_only_for_affected_projects(
    rule_kind: Literal["max_days", "max_count", "max_days_or_count"],
    use_default_policy: bool,
    db: DbSessionFactory,
) -> None:
    from tests.unit._helpers import _add_project, _add_span, _add_trace

    now = datetime.now(timezone.utc)
    expected_affected_ids: set[int] = set()
    all_projects: list[models.Project] = []

    async with db() as session:
        unaffected_project = await _add_project(session, name=f"unaffected-{token_hex(4)}")
        all_projects.append(unaffected_project)
        unaffected_trace = await _add_trace(
            session, unaffected_project, start_time=now - timedelta(hours=1)
        )
        await _add_span(session, trace=unaffected_trace)

        if rule_kind == "max_days":
            rule = TraceRetentionRule(root=MaxDaysRule(max_days=7))
            affected_project = await _add_project(session, name=f"days-affected-{token_hex(4)}")
            all_projects.append(affected_project)
            expected_affected_ids.add(affected_project.id)
            expired_trace = await _add_trace(
                session, affected_project, start_time=now - timedelta(days=10)
            )
            await _add_span(session, trace=expired_trace)
            recent_trace = await _add_trace(
                session, affected_project, start_time=now - timedelta(hours=1)
            )
            await _add_span(session, trace=recent_trace)
        elif rule_kind == "max_count":
            rule = TraceRetentionRule(root=MaxCountRule(max_count=1))
            affected_project = await _add_project(session, name=f"count-affected-{token_hex(4)}")
            all_projects.append(affected_project)
            expected_affected_ids.add(affected_project.id)
            for hour_offset in range(3):
                trace = await _add_trace(
                    session,
                    affected_project,
                    start_time=now - timedelta(hours=hour_offset),
                )
                await _add_span(session, trace=trace)
        else:
            rule = TraceRetentionRule(root=MaxDaysOrCountRule(max_days=7, max_count=2))
            days_project = await _add_project(session, name=f"or-days-{token_hex(4)}")
            count_project = await _add_project(session, name=f"or-count-{token_hex(4)}")
            all_projects.extend([days_project, count_project])
            expected_affected_ids.update({days_project.id, count_project.id})
            expired_trace = await _add_trace(
                session, days_project, start_time=now - timedelta(days=10)
            )
            await _add_span(session, trace=expired_trace)
            kept_days_trace = await _add_trace(
                session, days_project, start_time=now - timedelta(hours=1)
            )
            await _add_span(session, trace=kept_days_trace)
            for hour_offset in range(3):
                trace = await _add_trace(
                    session,
                    count_project,
                    start_time=now - timedelta(hours=hour_offset),
                )
                await _add_span(session, trace=trace)

        if use_default_policy:
            policy_id = DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
            default_policy = await session.get(models.ProjectTraceRetentionPolicy, policy_id)
            assert default_policy is not None
            default_policy.rule = rule
            default_policy.cron_expression = TraceRetentionCronExpression(root="0 * * * *")
            await session.flush()
        else:
            custom_policy = models.ProjectTraceRetentionPolicy(
                name=f"policy-{token_hex(4)}",
                rule=rule,
                cron_expression=TraceRetentionCronExpression(root="0 * * * *"),
                projects=all_projects,
            )
            session.add(custom_policy)
            await session.flush()
            policy_id = custom_policy.id

    async with db() as session:
        policy = await session.scalar(
            sa.select(models.ProjectTraceRetentionPolicy)
            .where(models.ProjectTraceRetentionPolicy.id == policy_id)
            .options(
                selectinload(models.ProjectTraceRetentionPolicy.projects).load_only(
                    models.Project.id, models.Project.deleted_at
                )
            )
        )
        assert policy is not None

    dml_event_handler = MagicMock(spec=DmlEventHandler)
    sweeper = TraceDataSweeper(db=db, dml_event_handler=dml_event_handler)

    await sweeper._apply(policy)
    assert dml_event_handler.put.call_count == 1
    emitted_event = dml_event_handler.put.call_args[0][0]
    assert isinstance(emitted_event, SpanDeleteEvent)
    assert bool(emitted_event)
    assert set(emitted_event.ids) == expected_affected_ids
    assert unaffected_project.id not in emitted_event.ids

    dml_event_handler.reset_mock()
    await sweeper._apply(policy)
    assert dml_event_handler.put.call_count == 0


@pytest.mark.parametrize("contention_mode", ["yield", "lock_timeout", "deadlock"])
async def test_max_days_sweep_continues_past_yielding_project(
    contention_mode: Literal["yield", "lock_timeout", "deadlock"],
    db: DbSessionFactory,
) -> None:
    from phoenix.server.cleanup import primitives as cleanup_primitives
    from phoenix.server.cleanup.primitives import PrimitiveResult, PrimitiveStatus
    from tests.unit._helpers import _add_project, _add_span, _add_trace

    class _SqlStateDriverError(Exception):
        def __init__(self, code: str) -> None:
            super().__init__(code)
            self.sqlstate = code

    now = datetime.now(timezone.utc)
    async with db() as session:
        contended_project = await _add_project(session, name=f"contended-{token_hex(4)}")
        contended_trace = await _add_trace(
            session, contended_project, start_time=now - timedelta(days=10)
        )
        await _add_span(session, trace=contended_trace)

        unblocked_project = await _add_project(session, name=f"unblocked-{token_hex(4)}")
        expired_unblocked_trace = await _add_trace(
            session, unblocked_project, start_time=now - timedelta(days=8)
        )
        await _add_span(session, trace=expired_unblocked_trace)
        recent_unblocked_trace = await _add_trace(
            session, unblocked_project, start_time=now - timedelta(hours=1)
        )
        await _add_span(session, trace=recent_unblocked_trace)

    real_drain_traces_step = cleanup_primitives.drain_traces_step

    async def yield_on_contended_project(
        session: Any,
        *,
        dialect: Any,
        trace_cond: sa.ColumnElement[bool],
        batch_limit: int = 1_000,
        reset_session_evaluations: bool = False,
    ) -> PrimitiveResult:
        next_project_rowid = await session.scalar(
            sa.select(models.Trace.project_rowid)
            .where(trace_cond)
            .order_by(models.Trace.start_time.asc(), models.Trace.id.desc())
            .limit(1)
        )
        if next_project_rowid == contended_project.id:
            if contention_mode == "yield":
                return PrimitiveResult(PrimitiveStatus.YIELD, 0)
            sqlstate = "55P03" if contention_mode == "lock_timeout" else "40P01"
            raise OperationalError("SELECT 1", {}, _SqlStateDriverError(sqlstate))
        return await real_drain_traces_step(
            session,
            dialect=dialect,
            trace_cond=trace_cond,
            batch_limit=batch_limit,
            reset_session_evaluations=reset_session_evaluations,
        )

    with patch.object(cleanup_primitives, "drain_traces_step", yield_on_contended_project):
        affected_project_ids = await MaxDaysRule(max_days=7).delete_traces_in_batches(
            db, [contended_project.id, unblocked_project.id], batch_size=1
        )

    async with db() as session:
        assert await session.get(models.Trace, contended_trace.id) is not None
        assert await session.get(models.Trace, expired_unblocked_trace.id) is None
        assert await session.get(models.Trace, recent_unblocked_trace.id) is not None
    assert affected_project_ids == {unblocked_project.id}


@pytest.mark.parametrize("rule_kind", ["max_days", "max_count"])
async def test_retention_preserves_surviving_session_evaluation_work_units(
    rule_kind: Literal["max_days", "max_count"],
    db: DbSessionFactory,
) -> None:
    from tests.unit._helpers import _add_project, _add_project_session, _add_span, _add_trace

    now = datetime.now(timezone.utc)
    claimed_timestamp = now.replace(microsecond=0) - timedelta(minutes=1)
    async with db() as session:
        project = await _add_project(session, name=f"session-preserve-{token_hex(4)}")
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        project_evaluator = models.ProjectEvaluator(
            trace_project=models.Project(name=f"eval-sink-{token_hex(8)}", kind="EVALUATOR"),
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"session-criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SESSION",
        )
        session.add(project_evaluator)
        await session.flush()

        done_session = await _add_project_session(
            session, project, start_time=now - timedelta(days=10)
        )
        expired_done_trace = await _add_trace(
            session,
            project,
            project_session=done_session,
            start_time=now - timedelta(days=10),
        )
        await _add_span(session, trace=expired_done_trace, start_time=now - timedelta(days=10))
        recent_done_trace = await _add_trace(
            session,
            project,
            project_session=done_session,
            start_time=now - timedelta(hours=1),
        )
        await _add_span(session, trace=recent_done_trace, start_time=now - timedelta(hours=1))
        done_work_unit = models.EvalSessionWorkUnit(
            project_session_rowid=done_session.id,
            project_evaluator_id=project_evaluator.id,
            decided_through=now - timedelta(hours=1),
            status="DONE",
            attempts=1,
        )

        running_session = await _add_project_session(
            session, project, start_time=now - timedelta(days=9)
        )
        expired_running_trace = await _add_trace(
            session,
            project,
            project_session=running_session,
            start_time=now - timedelta(days=9),
        )
        await _add_span(session, trace=expired_running_trace, start_time=now - timedelta(days=9))
        recent_running_trace = await _add_trace(
            session,
            project,
            project_session=running_session,
            start_time=now - timedelta(hours=2),
        )
        await _add_span(session, trace=recent_running_trace, start_time=now - timedelta(hours=2))
        running_work_unit = models.EvalSessionWorkUnit(
            project_session_rowid=running_session.id,
            project_evaluator_id=project_evaluator.id,
            decided_through=now - timedelta(hours=2),
            status="RUNNING",
            claimed_at=claimed_timestamp,
            claimed_by="session-worker",
            attempts=1,
        )
        session.add_all([done_work_unit, running_work_unit])
        await session.flush()
        done_work_unit_id = done_work_unit.id
        running_work_unit_id = running_work_unit.id

    rule: MaxDaysRule | MaxCountRule = (
        MaxDaysRule(max_days=7) if rule_kind == "max_days" else MaxCountRule(max_count=2)
    )
    affected_project_ids = await rule.delete_traces_in_batches(db, [project.id], batch_size=1)

    async with db() as session:
        assert await session.get(models.ProjectSession, done_session.id) is not None
        assert await session.get(models.ProjectSession, running_session.id) is not None
        assert await session.get(models.Trace, expired_done_trace.id) is None
        assert await session.get(models.Trace, expired_running_trace.id) is None
        assert await session.get(models.Trace, recent_done_trace.id) is not None
        assert await session.get(models.Trace, recent_running_trace.id) is not None

        retained_done_unit = await session.get(models.EvalSessionWorkUnit, done_work_unit_id)
        assert retained_done_unit is not None
        assert retained_done_unit.status == "DONE"
        assert retained_done_unit.attempts == 1

        retained_running_unit = await session.get(models.EvalSessionWorkUnit, running_work_unit_id)
        assert retained_running_unit is not None
        assert retained_running_unit.status == "RUNNING"
        assert retained_running_unit.claimed_by == "session-worker"
        assert retained_running_unit.claimed_at == claimed_timestamp
        assert retained_running_unit.attempts == 1
    assert affected_project_ids == {project.id}
