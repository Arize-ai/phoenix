from asyncio import Event, sleep
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, AsyncIterator
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from sqlalchemy import func
from starlette.types import ASGIApp

from phoenix.db import models
from phoenix.db.constants import DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID
from phoenix.db.types.trace_retention import (
    MaxCountRule,
    MaxDaysOrCountRule,
    MaxDaysRule,
    TraceRetentionCronExpression,
    TraceRetentionRule,
)
from phoenix.server.retention import TraceDataSweeper
from phoenix.server.types import DbSessionFactory


class TestTraceDataSweeper:
    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_run(
        self,
        use_default_policy: bool,
        sweeper_trigger: Event,
        db: DbSessionFactory,
        app: ASGIApp,
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
            sweeper_trigger.set()
            wait_time = 1.0
            await sleep(wait_time)  # Allow time for processing

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

                    # Verify we have exactly the number of traces we want to keep
                    expected_trace_ids = project_expected_trace_ids[project_id]
                    assert remaining_trace_ids == expected_trace_ids, (
                        f"Project {project_id}: Trace IDs mismatch in cycle {retention_cycle}"
                    )
                    traces_after_sweep = len(remaining_trace_ids)
                    assert traces_after_sweep == traces_to_keep, (
                        f"Project {project_id}: Final trace count should match traces_to_keep "
                        f"in cycle {retention_cycle}"
                    )

                    project_current_trace_count[project_id] = traces_after_sweep

    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_max_days_rule(
        self,
        use_default_policy: bool,
        sweeper_trigger: Event,
        db: DbSessionFactory,
        app: ASGIApp,
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
        num_projects = 3  # Test with multiple projects
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
        sweeper_trigger.set()
        wait_time = 1.0
        await sleep(wait_time)  # Allow time for processing

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
                assert len(remaining_trace_ids) == recent_traces_count, (
                    f"Project {project_id} should have {recent_traces_count} traces, "
                    f"has {len(remaining_trace_ids)}"
                )

    @pytest.mark.parametrize("use_default_policy", [True, False])
    async def test_max_days_or_count_rule(
        self,
        use_default_policy: bool,
        sweeper_trigger: Event,
        db: DbSessionFactory,
        app: ASGIApp,
    ) -> None:
        """Test that TraceDataSweeper correctly enforces OR-based retention policies.

        This test verifies that the sweeper:
        1. Deletes traces that violate EITHER max_days OR max_count constraints
        2. Keeps traces that satisfy BOTH constraints (recent AND within count)
        3. Works with both default and custom policies
        4. Correctly applies to multiple projects

        Test flow:
        1. Creates multiple projects with traces spanning different ages
        2. Sets up a retention policy with both max_days and max_count thresholds
        3. Creates old traces (violate max_days) and excess recent traces (violate max_count)
        4. Triggers sweeper and waits for processing
        5. Verifies that only the most recent traces within both limits remain
        """
        # Test configuration
        num_projects = 3  # Test with multiple projects
        max_days = 7  # Keep traces from last 7 days
        max_count = 5  # Keep at most 5 traces
        old_traces_count = 3  # Old traces (> max_days) - should be deleted
        excess_recent_traces = 4  # Recent but exceed count - should be deleted
        kept_recent_traces = max_count  # Recent and within count - should be kept
        initial_traces = old_traces_count + excess_recent_traces + kept_recent_traces
        assert initial_traces > max_count, "Must create more traces than max_count"

        # Configure retention policy
        retention_rule = TraceRetentionRule(
            root=MaxDaysOrCountRule(max_days=max_days, max_count=max_count)
        )
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

        # Create traces for each project: old, excess recent, and kept recent
        project_expected_trace_ids = {}

        async with db() as session:
            now = datetime.now(timezone.utc)

            for project_id in project_ids:
                # Old traces (violate max_days) - should be deleted
                for i in range(old_traces_count):
                    trace = models.Trace(
                        project_rowid=project_id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(days=max_days + 3 + i),
                        end_time=now - timedelta(days=max_days + 3 + i) + timedelta(seconds=1),
                    )
                    session.add(trace)

                # Excess recent traces (within max_days but exceed max_count) - should be deleted
                # These are created with older timestamps within the max_days window
                for i in range(excess_recent_traces):
                    offset_days = max_days - 1 - (i * 0.1)  # Spread within max_days window
                    trace = models.Trace(
                        project_rowid=project_id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(days=offset_days),
                        end_time=now - timedelta(days=offset_days) + timedelta(seconds=1),
                    )
                    session.add(trace)

                # Most recent traces (within max_days AND within max_count) - should be kept
                expected_kept_trace_ids = set()
                for i in range(kept_recent_traces):
                    trace = models.Trace(
                        project_rowid=project_id,
                        trace_id=token_hex(16),
                        start_time=now - timedelta(hours=i),
                        end_time=now - timedelta(hours=i) + timedelta(seconds=1),
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
        sweeper_trigger.set()
        wait_time = 1.0
        await sleep(wait_time)  # Allow time for processing

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

                # Verify we kept only the most recent traces within both limits
                expected_trace_ids = project_expected_trace_ids[project_id]
                assert remaining_trace_ids == expected_trace_ids, (
                    f"Project {project_id} trace IDs mismatch: "
                    f"expected {expected_trace_ids}, got {remaining_trace_ids}"
                )
                assert len(remaining_trace_ids) == max_count, (
                    f"Project {project_id} should have {max_count} traces, "
                    f"has {len(remaining_trace_ids)}"
                )


@pytest.fixture
async def sweeper_trigger() -> AsyncIterator[Event]:
    """Control when the TraceDataSweeper runs by patching its sleep method.

    Returns an event that can be set to trigger the sweeper's next run.
    The sweeper will wait for this event instead of sleeping until the next hour.
    """
    event = Event()

    async def wait_for_event(*_: Any, **__: Any) -> None:
        await event.wait()
        event.clear()

    with patch.object(TraceDataSweeper, "_sleep_until_next_hour", wait_for_event):
        yield event
