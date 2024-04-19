from datetime import datetime
from typing import Iterator

import pytest
import sqlean
from phoenix.config import DEFAULT_PROJECT_NAME
from phoenix.db import models
from phoenix.db.models import Base
from sqlalchemy import create_engine, insert
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture(scope="session")
def session_maker() -> sessionmaker:
    # `sqlean` is added to help with running the test on GitHub CI for Windows,
    # because its version of SQLite doesn't have `JSON_EXTRACT`.
    engine = create_engine("sqlite:///:memory:", module=sqlean, echo=True)
    Base.metadata.create_all(engine)
    session_maker = sessionmaker(engine)
    with session_maker.begin() as session:
        _insert_project_default(session)
        _insert_project_abc(session)
    return session_maker


@pytest.fixture()
def session(session_maker: sessionmaker) -> Iterator[Session]:
    with session_maker.begin() as session:
        yield session


def _insert_project_default(session: Session) -> None:
    project_row_id = session.scalar(
        insert(models.Project).values(name=DEFAULT_PROJECT_NAME).returning(models.Project.id)
    )
    trace_row_id = session.scalar(
        insert(models.Trace)
        .values(
            trace_id="0123",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    _ = session.scalar(
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
    _ = session.scalar(
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


def _insert_project_abc(session: Session) -> None:
    project_row_id = session.scalar(
        insert(models.Project).values(name="abc").returning(models.Project.id)
    )
    trace_row_id = session.scalar(
        insert(models.Trace)
        .values(
            trace_id="012",
            project_rowid=project_row_id,
            start_time=datetime.fromisoformat("2021-01-01T00:00:00.000+00:00"),
            end_time=datetime.fromisoformat("2021-01-01T00:01:00.000+00:00"),
        )
        .returning(models.Trace.id)
    )
    _ = session.scalar(
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
                "input": {"value": "210"},
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
    _ = session.scalar(
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
    _ = session.scalar(
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
    _ = session.scalar(
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
