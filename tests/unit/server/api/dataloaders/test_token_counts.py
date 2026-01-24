from datetime import datetime
from typing import Literal

import pandas as pd
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.api.dataloaders import TokenCountDataLoader
from phoenix.server.api.dataloaders.token_counts import Key
from phoenix.server.api.input_types.TimeRange import TimeRange
from phoenix.server.types import DbSessionFactory


async def test_token_counts(
    db: DbSessionFactory,
    data_for_testing_dataloaders: None,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:10.000+00:00")
    end_time = datetime.fromisoformat("2021-01-01T00:10:00.000+00:00")
    async with db() as session:
        prompt = models.Span.attributes[["llm", "token_count", "prompt"]].as_float()
        completion = models.Span.attributes[["llm", "token_count", "completion"]].as_float()
        pid = models.Trace.project_rowid
        span_df = await session.run_sync(
            lambda s: pd.read_sql_query(
                select(
                    pid,
                    func.sum(prompt).label("prompt"),
                    func.sum(completion).label("completion"),
                )
                .join(models.Span)
                .group_by(pid)
                .order_by(pid)
                .where(models.Span.name.contains("_trace4_"))
                .where(start_time <= models.Span.start_time)
                .where(models.Span.start_time < end_time),
                s.connection(),
            )
        )
    expected = (
        span_df.loc[:, "prompt"].to_list()
        + span_df.loc[:, "completion"].to_list()
        + (span_df.loc[:, "prompt"] + span_df.loc[:, "completion"]).to_list()
    )
    kinds: list[Literal["prompt", "completion", "total"]] = [
        "prompt",
        "completion",
        "total",
    ]
    keys: list[Key] = [
        (
            kind,
            id_ + 1,
            TimeRange(start=start_time, end=end_time),
            "'_trace4_' in name",
        )
        for kind in kinds
        for id_ in range(10)
    ]
    actual = await TokenCountDataLoader(db)._load_fn(keys)
    assert actual == expected
