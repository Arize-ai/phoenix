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
    num_projects = 10
    num_sessions_per_project = 2
    num_traces_per_session = 5
    num_spans_per_trace = 10
    async with db() as session:
        for i in range(num_projects):
            project_row_id = await session.scalar(
                insert(models.Project).values(name=f"{i}").returning(models.Project.id)
            )
            for l in range(num_sessions_per_project):  # noqa: E741
                seconds = randint(1, 1000)
                start_time = orig_time + timedelta(seconds=seconds)
                session_row_id = await session.scalar(
                    insert(models.ProjectSession)
                    .values(
                        session_id=f"proj{i}_sess{l}",
                        project_id=project_row_id,
                        start_time=start_time,
                        end_time=start_time,
                    )
                    .returning(models.ProjectSession.id)
                )
                for j in range(num_traces_per_session):
                    seconds = randint(1, 1000)
                    start_time = orig_time + timedelta(seconds=seconds)
                    end_time = orig_time + timedelta(seconds=seconds * j * 2)
                    trace_row_id = await session.scalar(
                        insert(models.Trace)
                        .values(
                            trace_id=f"proj{i}_sess{l}_trace{j}",
                            project_rowid=project_row_id,
                            start_time=start_time,
                            end_time=end_time,
                            project_session_rowid=session_row_id,
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
                    for k in range(num_spans_per_trace):
                        llm_token_count_prompt = randint(1, 1000)
                        llm_token_count_completion = randint(1, 1000)
                        seconds = randint(1, 1000)
                        start_time = orig_time + timedelta(seconds=seconds)
                        end_time = orig_time + timedelta(seconds=seconds * 2)
                        span_row_id = await session.scalar(
                            insert(models.Span)
                            .values(
                                trace_rowid=trace_row_id,
                                span_id=f"proj{i}_sess{l}_trace{j}_span{k}",
                                parent_id=None,
                                name=f"proj{i}_sess{l}_trace{j}_span{k}",
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


@pytest.fixture
async def data_with_multiple_annotations(db: DbSessionFactory) -> None:
    """
    Creates one project, one trace, and three spans for testing "quality" annotations.

    Span 1: two "good" annotations (scores: 0.85, 0.95) and one "bad" (0.3).
    Span 2: one "good" (0.85) and one "bad" (0.3).
    Span 3: one "good" (0.85).

    The fixture uses fixed values for span attributes so that non-null constraints are met.
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="simple_multiple").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace1",
                project_rowid=project_id,
                start_time=orig_time,
                end_time=orig_time + timedelta(minutes=1),
            )
            .returning(models.Trace.id)
        )
        span_ids = []
        for i in range(3):
            span_id_val = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_id,
                    span_id=f"span{i+1}",
                    name=f"span{i+1}",
                    parent_id="",
                    span_kind="UNKNOWN",
                    start_time=orig_time + timedelta(seconds=10 * i),
                    end_time=orig_time + timedelta(seconds=10 * i + 5),
                    attributes={"llm": {"token_count": {"prompt": 100, "completion": 100}}},
                    events=[],  # ensure non-null list
                    status_code="OK",
                    status_message="okay",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=100,
                    llm_token_count_completion=100,
                )
                .returning(models.Span.id)
            )
            span_ids.append(span_id_val)
        # Span 1 annotations
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[0],
                label="good",
                score=0.85,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[0],
                label="good",
                score=0.95,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[0],
                label="bad",
                score=0.3,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        # Span 2 annotations
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[1],
                label="good",
                score=0.85,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[1],
                label="bad",
                score=0.3,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        # Span 3 annotations
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="quality",
                span_rowid=span_ids[2],
                label="good",
                score=0.85,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.commit()


@pytest.fixture
async def data_with_missing_labels(db: DbSessionFactory) -> None:
    """
    Creates one project, one trace, and three spans for testing "distribution" annotations.

    Span 1: two "X" annotations (score=0.8) and one "Y" annotation (score=0.6).
    Span 2: one "X" annotation (score=0.8).
    Span 3: one "X" annotation (score=0.8).

    Non-null constraints are satisfied by providing fixed attributes and events.
    """
    orig_time = datetime.fromisoformat("2021-01-01T00:00:00.000+00:00")
    async with db() as session:
        project_id = await session.scalar(
            insert(models.Project).values(name="simple_missing").returning(models.Project.id)
        )
        trace_id = await session.scalar(
            insert(models.Trace)
            .values(
                trace_id="trace_missing",
                project_rowid=project_id,
                start_time=orig_time,
                end_time=orig_time + timedelta(minutes=1),
            )
            .returning(models.Trace.id)
        )

        span_ids = []
        for i in range(3):
            span_id_val = await session.scalar(
                insert(models.Span)
                .values(
                    trace_rowid=trace_id,
                    span_id=f"missing_span{i+1}",
                    name=f"missing_span{i+1}",
                    parent_id="",
                    span_kind="UNKNOWN",
                    start_time=orig_time + timedelta(seconds=10 * i),
                    end_time=orig_time + timedelta(seconds=10 * i + 5),
                    attributes={"llm": {"token_count": {"prompt": 100, "completion": 100}}},
                    events=[],
                    status_code="OK",
                    status_message="okay",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                    llm_token_count_prompt=100,
                    llm_token_count_completion=100,
                )
                .returning(models.Span.id)
            )
            span_ids.append(span_id_val)
        # Span 1: two "X" and one "Y"
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="distribution",
                span_rowid=span_ids[0],
                label="X",
                score=0.8,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="distribution",
                span_rowid=span_ids[0],
                label="X",
                score=0.8,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="distribution",
                span_rowid=span_ids[0],
                label="Y",
                score=0.6,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        # Span 2: only "X"
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="distribution",
                span_rowid=span_ids[1],
                label="X",
                score=0.8,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        # Span 3: only "X"
        await session.execute(
            insert(models.SpanAnnotation).values(
                name="distribution",
                span_rowid=span_ids[2],
                label="X",
                score=0.8,
                metadata_={},
                annotator_kind="LLM",
            )
        )
        await session.commit()
