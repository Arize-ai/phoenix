import sys
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

        Test flow:
        1. Creates a project with more traces than we want to keep
        2. Sets up a retention policy to keep a fixed number of traces
        3. Runs multiple sweeps to verify consistent behavior:
           - Creates new traces to bring total back to initial count
           - Captures the set of most recent trace_ids using ordered query
           - Triggers sweeper and waits for processing
           - Verifies that the remaining trace_ids exactly match the most recent set
        """
        # Test configuration
        traces_to_keep = 3  # Number of traces to retain
        initial_traces = 2 * traces_to_keep  # Total traces to create
        assert initial_traces > traces_to_keep, "Must create more traces than we want to keep"  # noqa: E501

        # Configure retention policy
        retention_rule = TraceRetentionRule(root=MaxCountRule(max_count=traces_to_keep))
        hourly_schedule = TraceRetentionCronExpression(root="0 * * * *")

        # Setup: Create project and policy
        async with db() as session:
            project = models.Project(name=token_hex(8))
            session.add(project)

            if use_default_policy:
                policy = await session.get(
                    models.ProjectTraceRetentionPolicy,
                    DEFAULT_PROJECT_TRACE_RETENTION_POLICY_ID,
                )
                assert policy is not None, "Default policy should exist"  # noqa: E501
            else:
                policy = models.ProjectTraceRetentionPolicy(
                    name=token_hex(8),
                    projects=[project],
                )
            policy.rule = retention_rule
            policy.cron_expression = hourly_schedule
            await session.merge(policy)

        # Prepare query for counting traces
        count_traces = sa.select(func.count(models.Trace.id)).filter_by(project_rowid=project.id)
        get_all_trace_ids = sa.select(models.Trace.trace_id).filter_by(project_rowid=project.id)
        get_most_recent_trace_ids = get_all_trace_ids.order_by(
            models.Trace.start_time.desc()
        ).limit(traces_to_keep)

        # Run multiple sweeps to verify retention works consistently
        num_retention_cycles = 2
        assert num_retention_cycles >= 2, "Must run at least twice"  # noqa: E501
        current_trace_count = 0

        for retention_cycle in range(num_retention_cycles):
            # Create new batch of traces
            async with db() as session:
                traces_to_create = initial_traces - current_trace_count
                assert traces_to_create, "Must create more traces than we want to keep"  # noqa: E501
                base_time = datetime.now(timezone.utc)
                session.add_all(
                    [
                        models.Trace(
                            project_rowid=project.id,
                            trace_id=token_hex(16),
                            start_time=base_time + timedelta(seconds=i),
                            end_time=base_time + timedelta(seconds=i + 1),
                        )
                        for i in range(traces_to_create)
                    ]
                )

            # Verify initial state
            async with db() as session:
                traces_before_sweep = await session.scalar(count_traces)
                # Get the trace_ids of the most recent traces before sweep
                most_recent_trace_ids = set(
                    (await session.scalars(get_most_recent_trace_ids)).all()
                )

            assert (
                traces_before_sweep == initial_traces
            ), f"Initial trace count mismatch in cycle {retention_cycle}"  # noqa: E501

            # Execute sweeper
            sweeper_trigger.set()
            # Use longer wait time on Windows for CI
            wait_time = 1.0 if sys.platform == "win32" else 0.1
            await sleep(wait_time)  # Allow time for processing

            # Verify final state
            async with db() as session:
                # Get the trace_ids in the database after the sweep
                remaining_trace_ids = set((await session.scalars(get_all_trace_ids)).all())

            # Verify we have exactly the number of traces we want to keep
            assert remaining_trace_ids == (
                most_recent_trace_ids
            ), f"Trace IDs mismatch in cycle {retention_cycle}"  # noqa: E501
            traces_after_sweep = len(remaining_trace_ids)
            assert (
                traces_after_sweep == traces_to_keep
            ), f"Final trace count should match traces_to_keep in cycle {retention_cycle}"  # noqa: E501

            current_trace_count = traces_after_sweep


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
