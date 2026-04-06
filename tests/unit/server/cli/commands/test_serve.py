import inspect
from argparse import Namespace
from datetime import datetime, timezone
from secrets import token_hex
from typing import Any, Awaitable, Callable, Iterator, NamedTuple

import pandas as pd
import pytest
from pytest_postgresql.janitor import DatabaseJanitor
from sqlalchemy import URL, text

from phoenix.db import models
from phoenix.db.insertion.types import Precursors
from phoenix.server.cli.commands import serve
from phoenix.server.cli.commands.serve import (
    _create_db_session_factory,
    _load_trace_fixture_initial_batches,
    _resolve_grpc_port,
)
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode
from phoenix.trace.trace_dataset import TraceDataset


def test_resolve_grpc_port_uses_cli_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_GRPC_PORT", "4318")

    assert _resolve_grpc_port(Namespace(grpc_port=9000)) == 9000


def test_resolve_grpc_port_uses_env_when_cli_flag_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PHOENIX_GRPC_PORT", "4318")

    assert _resolve_grpc_port(Namespace(grpc_port=None)) == 4318


async def _run_shutdown_callbacks(
    shutdown_callbacks: list[Callable[[], None | Awaitable[None]]],
) -> None:
    for callback in shutdown_callbacks:
        maybe_awaitable = callback()
        if inspect.isawaitable(maybe_awaitable):
            await maybe_awaitable


class PostgresPrimaryAndReplicaUrls(NamedTuple):
    primary_url: str
    replica_url: str
    primary_db_name: str
    replica_db_name: str


@pytest.fixture
def postgresql_primary_and_replica_urls(
    postgresql_proc: Any,
) -> Iterator[PostgresPrimaryAndReplicaUrls]:
    primary_db_name = f"phoenix_primary_{token_hex(4)}"
    replica_db_name = f"phoenix_replica_{token_hex(4)}"
    janitors: list[DatabaseJanitor] = []

    for db_name in (primary_db_name, replica_db_name):
        janitor = DatabaseJanitor(
            user=postgresql_proc.user,
            host=postgresql_proc.host,
            port=postgresql_proc.port,
            version=postgresql_proc.version,
            dbname=db_name,
            password=postgresql_proc.password or None,
        )
        janitor.init()
        janitors.append(janitor)

    def _connection_str_for(db_name: str) -> str:
        return URL.create(
            "postgresql",
            username=postgresql_proc.user,
            password=postgresql_proc.password or None,
            host=postgresql_proc.host,
            port=postgresql_proc.port,
            database=db_name,
        ).render_as_string(hide_password=False)

    yield PostgresPrimaryAndReplicaUrls(
        primary_url=_connection_str_for(primary_db_name),
        replica_url=_connection_str_for(replica_db_name),
        primary_db_name=primary_db_name,
        replica_db_name=replica_db_name,
    )

    for janitor in reversed(janitors):
        janitor.drop()


@pytest.mark.parametrize("dialect", ["postgresql"], indirect=True)
async def test_create_db_session_factory_routes_reads_to_replica_for_postgres(
    dialect: str,
    postgresql_primary_and_replica_urls: PostgresPrimaryAndReplicaUrls,
) -> None:
    factory, shutdown_callbacks = _create_db_session_factory(
        db_connection_str=postgresql_primary_and_replica_urls.primary_url,
        read_replica_connection_str=postgresql_primary_and_replica_urls.replica_url,
        migrate=False,
        log_to_stdout=False,
        log_migrations=False,
    )
    try:
        async with factory() as session:
            assert (
                str(await session.scalar(text("SELECT current_database()")))
                == postgresql_primary_and_replica_urls.primary_db_name
            )
        async with factory.read() as session:
            assert (
                str(await session.scalar(text("SELECT current_database()")))
                == postgresql_primary_and_replica_urls.replica_db_name
            )
    finally:
        await _run_shutdown_callbacks(shutdown_callbacks)


@pytest.mark.parametrize("dialect", ["postgresql"], indirect=True)
async def test_create_db_session_factory_uses_primary_when_replica_not_configured_for_postgres(
    dialect: str,
    postgresql_primary_and_replica_urls: PostgresPrimaryAndReplicaUrls,
) -> None:
    factory, shutdown_callbacks = _create_db_session_factory(
        db_connection_str=postgresql_primary_and_replica_urls.primary_url,
        read_replica_connection_str=None,
        migrate=False,
        log_to_stdout=False,
        log_migrations=False,
    )
    try:
        async with factory() as session:
            assert (
                str(await session.scalar(text("SELECT current_database()")))
                == postgresql_primary_and_replica_urls.primary_db_name
            )
        async with factory.read() as session:
            assert (
                str(await session.scalar(text("SELECT current_database()")))
                == postgresql_primary_and_replica_urls.primary_db_name
            )
    finally:
        await _run_shutdown_callbacks(shutdown_callbacks)


def test_load_trace_fixture_initial_batches_remaps_evaluations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    trace_id = "0123456789abcdef0123456789abcdef"
    span_id = "0123456789abcdef"
    span = Span(
        name="fixture-span",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.RETRIEVER,
        parent_id=None,
        start_time=pd.Timestamp("2024-01-01T00:00:00Z").to_pydatetime(),
        end_time=pd.Timestamp("2024-01-01T00:00:01Z").to_pydatetime(),
        status_code=SpanStatusCode.OK,
        status_message="",
        attributes={"retrieval": {"documents": [{"document": {"content": "doc-0"}}]}},
        events=[],
        conversation=None,
    )
    now = datetime.now(timezone.utc)
    precursors = [
        (
            "span-eval",
            [
                Precursors.SpanAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    obj=models.SpanAnnotation(
                        name="span-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=1.0,
                        label=None,
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
        (
            "document-eval",
            [
                Precursors.DocumentAnnotation(
                    updated_at=now,
                    span_id=span_id,
                    document_position=0,
                    obj=models.DocumentAnnotation(
                        document_position=0,
                        name="document-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label="relevant",
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
        (
            "trace-eval",
            [
                Precursors.TraceAnnotation(
                    updated_at=now,
                    trace_id=trace_id,
                    obj=models.TraceAnnotation(
                        name="trace-eval",
                        identifier="",
                        source="API",
                        annotator_kind="LLM",
                        score=None,
                        label="good",
                        explanation=None,
                        metadata_={},
                    ),
                )
            ],
        ),
    ]
    dataset_fixture = object()

    monkeypatch.setattr(serve, "load_example_traces", lambda _: TraceDataset.from_spans([span]))
    monkeypatch.setattr(serve, "get_annotation_precursors_from_fixture", lambda _: iter(precursors))
    monkeypatch.setattr(serve, "get_dataset_fixtures", lambda _: [dataset_fixture])

    fixture_spans, fixture_annotation_precursors, dataset_fixtures = (
        _load_trace_fixture_initial_batches("fixture-name")
    )

    new_trace_id = fixture_spans[0].context.trace_id
    new_span_id = fixture_spans[0].context.span_id

    assert new_trace_id != trace_id
    assert new_span_id != span_id
    assert len(fixture_annotation_precursors) == 3
    span_precursor = fixture_annotation_precursors[0]
    doc_precursor = fixture_annotation_precursors[1]
    trace_precursor = fixture_annotation_precursors[2]
    assert isinstance(span_precursor, Precursors.SpanAnnotation)
    assert span_precursor.span_id == new_span_id
    assert isinstance(doc_precursor, Precursors.DocumentAnnotation)
    assert doc_precursor.span_id == new_span_id
    assert isinstance(trace_precursor, Precursors.TraceAnnotation)
    assert trace_precursor.trace_id == new_trace_id
    assert dataset_fixtures == [dataset_fixture]
