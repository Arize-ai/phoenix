from datetime import datetime

import pytest
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
async def default_project(session: AsyncSession) -> None:
    project_row_id = await session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_row_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="0123",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="2345",
            parent_id=None,
            name="root span",
            span_kind="UNKNOWN",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            attributes={
                "input": {"value": "210"},
                "output": {"value": "321"},
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        .returning(models.Span.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="4567",
            parent_id="2345",
            name="retriever span",
            span_kind="RETRIEVER",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "input": {
                    "value": "xyz",
                },
                "retrieval": {
                    "documents": [
                        {"document": {"content": "A", "score": 1}},
                        {"document": {"content": "B", "score": 2}},
                        {"document": {"content": "C", "score": 3}},
                    ],
                },
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        .returning(models.Span.id)
    )


@pytest.fixture
async def abc_project(session: AsyncSession) -> None:
    project_row_id = await session.scalar(
        insert(models.Project).values(name="abc").returning(models.Project.id)
    )
    trace_row_id = await session.scalar(
        insert(models.Trace)
        .values(
            trace_id="012",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="234",
            parent_id="123",
            name="root span",
            span_kind="UNKNOWN",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            attributes={
                "input": {"value": "xy%z*"},
                "output": {"value": "321"},
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=1,
            cumulative_llm_token_count_prompt=100,
            cumulative_llm_token_count_completion=200,
        )
        .returning(models.Span.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="345",
            parent_id="234",
            name="embedding span",
            span_kind="EMBEDDING",
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            attributes={
                "input": {
                    "value": "XY%*Z",
                },
                "metadata": {
                    "a.b.c": 123,
                    "1.2.3": "abc",
                    "x.y": {"z.a": {"b.c": 321}},
                },
                "embedding": {
                    "model_name": "xyz",
                    "embeddings": [
                        {"embedding": {"vector": [1, 2, 3], "text": "123"}},
                        {"embedding": {"vector": [2, 3, 4], "text": "234"}},
                    ],
                },
            },
            events=[],
            status_code="OK",
            status_message="no problemo",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        .returning(models.Span.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="456",
            parent_id="234",
            name="retriever span",
            span_kind="RETRIEVER",
            start_time=datetime.fromisoformat("2021-01-01T00:00:05.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            attributes={
                "attributes": "attributes",
                "input": {
                    "value": "xy%*z",
                },
                "retrieval": {
                    "documents": [
                        {"document": {"content": "A", "score": 1}},
                        {"document": {"content": "B", "score": 2}},
                        {"document": {"content": "C", "score": 3}},
                    ],
                },
            },
            events=[],
            status_code="OK",
            status_message="okay",
            cumulative_error_count=0,
            cumulative_llm_token_count_prompt=0,
            cumulative_llm_token_count_completion=0,
        )
        .returning(models.Span.id)
    )
    await session.execute(
        insert(models.Span)
        .values(
            trace_rowid=trace_row_id,
            span_id="567",
            parent_id="234",
            name="llm span",
            span_kind="LLM",
            start_time=datetime.fromisoformat("2021-01-01T00:00:20.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:00:30.000+00:00"),
            attributes={
                "attributes": {"attributes": "attributes"},
                "llm": {
                    "token_count": {
                        "prompt": 100,
                        "completion": 200,
                    },
                },
            },
            events=[],
            status_code="ERROR",
            status_message="uh-oh",
            cumulative_error_count=1,
            cumulative_llm_token_count_prompt=100,
            cumulative_llm_token_count_completion=200,
        )
        .returning(models.Span.id)
    )
