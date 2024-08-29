from datetime import datetime, timedelta
from random import randint, random, seed

import pytest
from sqlalchemy import insert

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


@pytest.fixture
async def data_for_testing_dataloaders(
    db: DbSessionFactory,
) -> None:
    seed(42)
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    I, J, K = 10, 10, 10  # noqa: E741
    async with db() as session:
        for i in range(I):
            project_row_id = await session.scalar(
                insert(models.Project).values(name=f"{i}").returning(models.Project.id)
            )
            for j in range(J):
                seconds = randint(1, 1000)
                start_time = orig_time + timedelta(seconds=seconds)
                end_time = orig_time + timedelta(seconds=seconds * K * 2)
                trace_row_id = await session.scalar(
                    insert(models.Trace)
                    .values(
                        trace_id=f"{i}_{j}",
                        project_rowid=project_row_id,
                        start_time=start_time,
                        end_time=end_time,
                    )
                    .returning(models.Trace.id)
                )
                for name in "ABCD":
                    await session.execute(
                        insert(models.TraceAnnotation).values(
                            name=name,
                            trace_rowid=trace_row_id,
                            label="XYZ"[randint(0, 2)],
                            score=random(),
                            metadata_={},
                            annotator_kind="LLM",
                        )
                    )
                for k in range(K):
                    llm_token_count_prompt = randint(1, 1000)
                    llm_token_count_completion = randint(1, 1000)
                    seconds = randint(1, 1000)
                    start_time = orig_time + timedelta(seconds=seconds)
                    end_time = orig_time + timedelta(seconds=seconds * 2)
                    span_row_id = await session.scalar(
                        insert(models.Span)
                        .values(
                            trace_rowid=trace_row_id,
                            span_id=f"{i}_{j}_{k}",
                            parent_id=None,
                            name=f"{i}_{j}_{k}",
                            span_kind="UNKNOWN",
                            start_time=start_time,
                            end_time=end_time,
                            attributes={
                                "llm": {
                                    "token_count": {
                                        "prompt": llm_token_count_prompt,
                                        "completion": llm_token_count_completion,
                                    }
                                }
                            },
                            events=[],
                            status_code="OK",
                            status_message="okay",
                            cumulative_error_count=0,
                            cumulative_llm_token_count_prompt=0,
                            cumulative_llm_token_count_completion=0,
                            llm_token_count_prompt=llm_token_count_prompt,
                            llm_token_count_completion=llm_token_count_completion,
                        )
                        .returning(models.Span.id)
                    )
                    for name in "ABCD":
                        await session.execute(
                            insert(models.SpanAnnotation).values(
                                name=name,
                                span_rowid=span_row_id,
                                label="XYZ"[randint(0, 2)],
                                score=random(),
                                metadata_={},
                                annotator_kind="LLM",
                            )
                        )
