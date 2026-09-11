from datetime import datetime
from typing import Literal, Optional

import pandas as pd
from sqlalchemy import func, select

from phoenix.db import models
from phoenix.server.api.dataloaders.token_counts import Key, TokenCountDataLoader
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
    kinds: list[Literal["prompt", "completion", "total"]] = ["prompt", "completion", "total"]
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


async def test_token_counts_does_not_double_count_nested_llm_spans(
    db: DbSessionFactory,
) -> None:
    start_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project = models.Project(name="nested-llm")
        session.add(project)
        await session.flush()
        trace = models.Trace(
            trace_id="nested-llm-trace",
            project_rowid=project.id,
            start_time=start_time,
            end_time=start_time,
        )
        session.add(trace)
        await session.flush()

        def _llm_span(
            span_id: str,
            parent_id: Optional[str],
            prompt_count: int,
            completion_count: int,
        ) -> models.Span:
            return models.Span(
                trace_rowid=trace.id,
                span_id=span_id,
                parent_id=parent_id,
                name=span_id,
                span_kind="LLM",
                start_time=start_time,
                end_time=start_time,
                attributes={},
                events=[],
                status_code="OK",
                status_message="",
                cumulative_error_count=0,
                cumulative_llm_token_count_prompt=0,
                cumulative_llm_token_count_completion=0,
                llm_token_count_prompt=prompt_count,
                llm_token_count_completion=completion_count,
            )

        leaf_prompt_count = 100
        leaf_completion_count = 50
        session.add(_llm_span("wrapper", None, leaf_prompt_count, leaf_completion_count))
        session.add(_llm_span("leaf", "wrapper", leaf_prompt_count, leaf_completion_count))
        await session.flush()

    keys: list[Key] = [(kind, project.id, None, None) for kind in ("prompt", "completion", "total")]
    assert await TokenCountDataLoader(db)._load_fn(keys) == [
        leaf_prompt_count,
        leaf_completion_count,
        leaf_prompt_count + leaf_completion_count,
    ]
