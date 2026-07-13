from datetime import datetime
from typing import Literal

import pandas as pd
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.api.dataloaders.record_counts import Key, RecordCountDataLoader
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory


async def test_record_counts(
    db: DbSessionFactory,
    data_for_testing_dataloaders: None,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:10.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T00:10:00.000+00:00")
    pid = models.Trace.project_rowid
    async with db() as session:
        span_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(pid, func.count().label("count"))
                .join_from(models.Trace, models.Span)
                .group_by(pid)
                .order_by(pid)
                .where(models.Span.name.contains("_trace4_"))
                .where(start_time <= models.Span.start_time)
                .where(models.Span.start_time < end_time),
                s.connection(),
            )
        )
        trace_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(pid, func.count().label("count"))
                .group_by(pid)
                .order_by(pid)
                .where(start_time <= models.Trace.start_time)
                .where(models.Trace.start_time < end_time),
                s.connection(),
            )
        )
        session_pid = models.ProjectSession.project_id
        session_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                # sessions use interval-overlap time-range semantics: a session
                # counts iff [start_time, end_time] intersects [start, end)
                select(session_pid, func.count().label("count"))
                .group_by(session_pid)
                .order_by(session_pid)
                .where(start_time <= models.ProjectSession.end_time)
                .where(models.ProjectSession.start_time < end_time),
                s.connection(),
            )
        )
    # some projects may have zero matching sessions in the time window, unlike
    # traces/spans which are dense enough to always have at least one match
    session_counts_by_pid = dict(zip(session_df["project_id"], session_df["count"]))
    session_counts = [session_counts_by_pid.get(id_ + 1, 0) for id_ in range(10)]
    expected = (
        trace_df.loc[:, "count"].to_list() + span_df.loc[:, "count"].to_list() + session_counts
    )
    kinds: list[Literal["span", "trace", "session"]] = ["trace", "span", "session"]
    session_filter_condition = None
    keys: list[Key] = [
        (
            kind,
            id_ + 1,
            TimeRange(start=start_time, end=end_time),
            "'_trace4_' in name" if kind == "span" else None,
            session_filter_condition,
        )
        for kind in kinds
        for id_ in range(10)
    ]

    actual = await RecordCountDataLoader(db)._load_fn(keys)
    assert actual == expected
