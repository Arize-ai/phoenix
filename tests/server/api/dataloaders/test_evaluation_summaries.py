from datetime import datetime
from typing import AsyncContextManager, Callable

import pandas as pd
import pytest
from phoenix.db import models
from phoenix.server.api.dataloaders import EvaluationSummaryDataLoader
from phoenix.server.api.input_types.TimeRange import TimeRange
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def test_evaluation_summaries(
    db: Callable[[], AsyncContextManager[AsyncSession]],
    data_for_testing_dataloaders: None,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:10.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T00:10:00.000+00:00")
    pid = models.Trace.project_rowid
    async with db() as session:
        span_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(
                    pid,
                    models.SpanAnnotation.name,
                    func.avg(models.SpanAnnotation.score).label("mean_score"),
                )
                .group_by(pid, models.SpanAnnotation.name)
                .order_by(pid, models.SpanAnnotation.name)
                .join_from(models.Trace, models.Span)
                .join_from(models.Span, models.SpanAnnotation)
                .where(models.Span.name.contains("_5_"))
                .where(models.SpanAnnotation.name.in_(("A", "C")))
                .where(start_time <= models.Span.start_time)
                .where(models.Span.start_time < end_time),
                s.connection(),
            )
        )
        trace_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(
                    pid,
                    models.TraceAnnotation.name,
                    func.avg(models.TraceAnnotation.score).label("mean_score"),
                )
                .group_by(pid, models.TraceAnnotation.name)
                .order_by(pid, models.TraceAnnotation.name)
                .join_from(models.Trace, models.TraceAnnotation)
                .where(models.TraceAnnotation.name.in_(("B", "D")))
                .where(start_time <= models.Trace.start_time)
                .where(models.Trace.start_time < end_time),
                s.connection(),
            )
        )
    expected = trace_df.loc[:, "mean_score"].to_list() + span_df.loc[:, "mean_score"].to_list()
    actual = [
        smry.mean_score()
        for smry in (
            await EvaluationSummaryDataLoader(db)._load_fn(
                [
                    (
                        kind,
                        id_ + 1,
                        TimeRange(start=start_time, end=end_time),
                        "'_5_' in name" if kind == "span" else None,
                        eval_name,
                    )
                    for kind in ("trace", "span")
                    for id_ in range(10)
                    for eval_name in (("B", "D") if kind == "trace" else ("A", "C"))
                ]
            )
        )
    ]
    assert actual == pytest.approx(expected, 1e-7)
