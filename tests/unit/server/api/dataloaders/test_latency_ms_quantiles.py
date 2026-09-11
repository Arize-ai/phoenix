from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, Literal, cast

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import Select, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.engine.interfaces import Dialect

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.api.dataloaders import latency_ms_quantile
from phoenix.server.api.dataloaders.latency_ms_quantile import Key, LatencyMsQuantileDataLoader
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory

_SQLITE_DIALECT = cast(Dialect, sqlite.dialect())
_POSTGRESQL_DIALECT = cast(Dialect, postgresql.dialect())  # type: ignore[no-untyped-call]


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


@pytest.mark.parametrize(
    "dialect",
    [_SQLITE_DIALECT, _POSTGRESQL_DIALECT],
)
async def test_trace_filter_compiles_to_correlated_span_exists(
    dialect: Dialect,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    statements: list[Select[Any]] = []

    async def capture_statement(
        session: Any,
        base_stmt: Select[Any],
        latency_column: Any,
        params: Any,
    ) -> AsyncIterator[tuple[int, float]]:
        statements.append(base_stmt)
        if False:
            yield 0, 0.0

    monkeypatch.setattr(latency_ms_quantile, "_get_results_sqlite", capture_statement)
    segment: latency_ms_quantile.Segment = (
        "trace",
        (None, None),
        'status_code == "ERROR"',
        None,
    )
    params = {(7, 0.5): [0]}
    assert not [
        result
        async for result in latency_ms_quantile._get_results(
            SupportedSQLDialect.SQLITE,
            cast(Any, None),
            segment,
            params,
        )
    ]

    assert len(statements) == 1
    sql = str(
        statements[0].compile(dialect=dialect, compile_kwargs={"literal_binds": True})
    ).lower()
    # Pin the inner FROM as well: an uncorrelated `exists (select 1 from spans, traces where
    # spans.trace_rowid = traces.id …)` would satisfy both fragments below on their own and
    # match every trace with any matching span anywhere.
    normalized = " ".join(sql.split())
    assert "exists (select 1 from spans where" in normalized
    assert "spans.trace_rowid = traces.id" in sql
    assert "traces.id in (select" not in sql
    assert "select distinct spans.trace_rowid" not in sql
