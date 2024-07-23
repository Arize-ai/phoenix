from datetime import datetime
from typing import AsyncContextManager, Callable

import pandas as pd
from phoenix.db import models
from phoenix.server.api.dataloaders import RecordCountDataLoader
from phoenix.server.api.input_types.TimeRange import TimeRange
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_record_counts(
    db: Callable[[], AsyncContextManager[AsyncSession]],
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
                .where(models.Span.name.contains("_5_"))
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
    expected = trace_df.loc[:, "count"].to_list() + span_df.loc[:, "count"].to_list()
    actual = await RecordCountDataLoader(db)._load_fn(
        [
            (
                kind,
                id_ + 1,
                TimeRange(start=start_time, end=end_time),
                "'_5_' in name" if kind == "span" else None,
            )
            for kind in ("trace", "span")
            for id_ in range(10)
        ]
    )
    assert actual == expected
