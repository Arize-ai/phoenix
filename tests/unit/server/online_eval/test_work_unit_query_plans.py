import re
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncConnection

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.dataloaders.evaluation_queues import EvaluationQueueProjectsDataLoader
from phoenix.server.api.dataloaders.project_evaluation_queues import (
    ProjectEvaluationQueueDataLoader,
)
from phoenix.server.api.dataloaders.project_evaluator_latest_outcomes import (
    ProjectEvaluatorLatestOutcomesDataLoader,
)
from phoenix.server.api.dataloaders.project_evaluator_queues import (
    ProjectEvaluatorQueuesDataLoader,
)
from phoenix.server.api.input_types.TimeBinConfig import TimeBucketSpec
from phoenix.server.online_eval.coordinator import EvalWorkCoordinator
from phoenix.server.online_eval.current_queue import (
    load_evaluation_queue,
    load_project_evaluator_queues,
)
from phoenix.server.online_eval.evaluation_activity import (
    load_added_and_completed,
    load_evaluation_activity,
    load_evaluation_lags,
)
from phoenix.server.online_eval.span_producer import SpanEvaluationProducer
from phoenix.server.online_eval.sweeping_producer import (
    SessionEvaluationProducer,
    TraceEvaluationProducer,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project
from .test_span_producer import _seed_criteria


async def test_work_unit_reads_never_scan_a_work_table(
    db: DbSessionFactory,
    request: pytest.FixtureRequest,
) -> None:
    """Every read of a work table on SQLite searches an index, the reads that take a few rows
    per evaluator do not sort into a temporary table, and the reads bounded by a time range
    do not walk an evaluator's whole history."""
    if db.dialect is not SupportedSQLDialect.SQLITE:
        pytest.skip("asserts SQLite query plans")
    connection: AsyncConnection = request.getfixturevalue("_sqlite_test_conn")
    async with db() as session:
        project = await _add_project(session)
    project_evaluator_ids = [
        (await _seed_criteria(db, project.id, evaluation_target=evaluation_target))[1]
        for evaluation_target in ("SPAN", "TRACE", "SESSION")
    ]
    plans: list[tuple[str, list[str]]] = []

    def explain(
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        if "work_units" in statement and not statement.startswith("EXPLAIN"):
            cursor.execute("EXPLAIN QUERY PLAN " + statement, parameters)
            plans.append((statement, [row[3] for row in cursor.fetchall()]))

    event.listen(connection.sync_engine, "before_cursor_execute", explain)
    try:
        producer = SpanEvaluationProducer(db)
        await producer._retention_cleanup(datetime.now(timezone.utc))
        for sweeper in (SessionEvaluationProducer(db), TraceEvaluationProducer(db)):
            async with db() as session:
                await sweeper._publish_decided_through_lag(session, datetime.now(timezone.utc))
        for coordinator_target in ("SPAN", "SESSION", "TRACE"):
            coordinator = EvalWorkCoordinator(db, evaluation_target=coordinator_target)
            await coordinator.claim(claimed_by="query-plan", limit=1)
        await load_evaluation_queue(db)
        first_per_evaluator_plan = len(plans)
        await load_project_evaluator_queues(db, project_evaluator_ids)
        await ProjectEvaluationQueueDataLoader(db, ProjectEvaluatorQueuesDataLoader(db)).load(
            project.id
        )
        await EvaluationQueueProjectsDataLoader(db, ProjectEvaluatorQueuesDataLoader(db)).load(5)
        await ProjectEvaluatorLatestOutcomesDataLoader(db).load(1)
        per_evaluator_plans = plans[first_per_evaluator_plan:]
        first_range_plan = len(plans)
        now = datetime.now(timezone.utc)
        await load_added_and_completed(db, project_id=None, start=now - timedelta(hours=1), end=now)
        await load_evaluation_lags(db, project_evaluator_ids, now - timedelta(hours=1), now)
        for project_id in (project.id, None):
            await load_evaluation_activity(
                db,
                project_id=project_id,
                start=now - timedelta(hours=1),
                end=now,
                time_bins=TimeBucketSpec(),
                read_queue_size=True,
            )
        range_plans = plans[first_range_plan:]
    finally:
        event.remove(connection.sync_engine, "before_cursor_execute", explain)

    work_unit_reads = [
        step
        for _, steps in plans
        for step in steps
        if re.match(r"(SCAN|SEARCH) eval_\w*work_units\b", step)
    ]
    assert work_unit_reads
    assert [
        step
        for step in work_unit_reads
        if not re.match(r"SEARCH \S+ USING (COVERING )?INDEX ", step)
    ] == []
    assert [
        step for _, steps in per_evaluator_plans for step in steps if "TEMP B-TREE" in step
    ] == []
    # Matching the evaluator as an expression keeps these reads on their time index. Without
    # it SQLite reads by the plain evaluator index: a search on these empty tables, a scan of
    # the table once it has rows.
    assert [
        step
        for _, steps in range_plans
        for step in steps
        if re.search(r"INDEX ix_\w+_project_evaluator_id\b", step)
    ] == []
