import re
from datetime import datetime, timezone
from typing import Any

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncConnection

from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.producer import OnlineEvalProducer
from phoenix.server.online_eval.sweeper import EvalSweeper
from phoenix.server.types import DbSessionFactory


async def test_per_tick_work_unit_reads_use_partial_indexes_on_sqlite(
    db: DbSessionFactory,
    request: pytest.FixtureRequest,
) -> None:
    if db.dialect is not SupportedSQLDialect.SQLITE:
        pytest.skip("asserts SQLite query plans")
    connection: AsyncConnection = request.getfixturevalue("_sqlite_test_conn")
    plan_steps: list[str] = []

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
            plan_steps.extend(row[3] for row in cursor.fetchall())

    event.listen(connection.sync_engine, "before_cursor_execute", explain)
    try:
        await OnlineEvalProducer(db)._admission_budget()
        for sweep_target in ("SESSION", "TRACE"):
            sweeper = EvalSweeper(db, evaluation_target=sweep_target, max_outstanding=10)
            async with db() as session:
                await sweeper._admission_budget(session)
                await sweeper._publish_watermark_lag(session, datetime.now(timezone.utc))
        for coordinator_target in ("SPAN", "SESSION", "TRACE"):
            await DbEvalWorkCoordinator(db, evaluation_target=coordinator_target).lag()
    finally:
        event.remove(connection.sync_engine, "before_cursor_execute", explain)

    work_unit_reads = [
        step for step in plan_steps if re.match(r"(SCAN|SEARCH) eval_\w*work_units\b", step)
    ]
    assert work_unit_reads
    assert [
        step
        for step in work_unit_reads
        if not re.match(r"SEARCH \S+ USING (COVERING )?INDEX ", step)
    ] == []
