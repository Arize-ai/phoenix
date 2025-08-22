from datetime import datetime
from typing import Literal

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.dataloaders import LatencyMsQuantileDataLoader
from phoenix.server.api.dataloaders.latency_ms_quantile import Key
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory


async def test_latency_ms_quantiles_p25_p50_p75(
    db: DbSessionFactory,
    data_for_testing_dataloaders: None,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:10.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T00:10:00.000+00:00")
    pid = models.Trace.project_rowid
    async with db() as session:
        span_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(pid, models.Span.latency_ms.label("latency_ms"))
                .join_from(models.Trace, models.Span)
                .where(models.Span.name.contains("_trace4_"))
                .where(start_time <= models.Span.start_time)
                .where(models.Span.start_time < end_time),
                s.connection(),
            )
        )
        trace_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(pid, models.Trace.latency_ms.label("latency_ms"))
                .where(start_time <= models.Trace.start_time)
                .where(models.Trace.start_time < end_time),
                s.connection(),
            )
        )
    expected = (
        trace_df.groupby("project_rowid")["latency_ms"]
        .quantile(np.array([0.25, 0.50, 0.75]))
        .sort_index()
        .to_list()
        + span_df.groupby("project_rowid")["latency_ms"]
        .quantile(np.array([0.25, 0.50, 0.75]))
        .sort_index()
        .to_list()
    )
    kinds: list[Literal["span", "trace"]] = ["trace", "span"]
    session_filter_condition = None
    keys: list[Key] = [
        (
            kind,
            id_ + 1,
            TimeRange(start=start_time, end=end_time),
            "'_trace4_' in name" if kind == "span" else None,
            session_filter_condition,
            probability,
        )
        for kind in kinds
        for id_ in range(10)
        for probability in (0.25, 0.50, 0.75)
    ]
    actual = await LatencyMsQuantileDataLoader(db)._load_fn(keys)
    assert actual == pytest.approx(expected, 1e-7)
