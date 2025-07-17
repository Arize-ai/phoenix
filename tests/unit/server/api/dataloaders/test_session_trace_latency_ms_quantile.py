import numpy as np
import pandas as pd
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.dataloaders.session_trace_latency_ms_quantile import (
    Key,
    SessionTraceLatencyMsQuantileDataLoader,
)
from phoenix.server.types import DbSessionFactory


async def test_session_trace_latency_ms_quantile(
    db: DbSessionFactory,
    data_for_testing_dataloaders: None,
) -> None:
    psid = models.Trace.project_session_rowid
    async with db() as session:
        trace_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(psid, models.Trace.latency_ms.label("latency_ms")),
                s.connection(),
            )
        )
    expected = (
        trace_df.groupby("project_session_rowid")["latency_ms"]
        .quantile(np.array([0.25, 0.50, 0.75]))
        .sort_index()
        .to_list()
    )
    keys: list[Key] = [
        (
            id_ + 1,
            probability,
        )
        for id_ in range(20)
        for probability in (0.25, 0.50, 0.75)
    ]
    actual = await SessionTraceLatencyMsQuantileDataLoader(db)._load_fn(keys)
    assert actual == expected
