import inspect
from argparse import Namespace
from datetime import datetime, timezone
from secrets import token_hex
from types import SimpleNamespace
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
    _join_url_path,
    _load_trace_fixture_initial_batches,
    _render_boot_message,
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


@pytest.mark.parametrize(
    "path, expected_url",
    [
        ("v1", "http://localhost:6006/phoenix/v1"),
        ("graphql", "http://localhost:6006/phoenix/graphql"),
        ("/mcp", "http://localhost:6006/phoenix/mcp"),
        ("v1/traces", "http://localhost:6006/phoenix/v1/traces"),
    ],
)
def test_join_url_path_preserves_deployment_root(path: str, expected_url: str) -> None:
    assert _join_url_path("http://localhost:6006/phoenix", path) == expected_url


def test_render_boot_message_adds_effective_assistant_config(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME", "custom_assistant")
    monkeypatch.setenv("PHOENIX_AGENTS_COLLECTOR_ENDPOINT", "http://collector.example:4318")
    monkeypatch.setenv("PHOENIX_AGENTS_COLLECTOR_API_KEY", "secret-api-key")
    monkeypatch.setenv("PHOENIX_AGENTS_FORCE_TRACING", "false")
    monkeypatch.setenv("PHOENIX_ALLOW_EXTERNAL_RESOURCES", "true")
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_WEB_ACCESS", "false")
    monkeypatch.setenv("PHOENIX_AGENTS_DISABLE_BASH", "true")
    boot_message = SimpleNamespace(agent_assistant_enabled=True)
    system_settings = SimpleNamespace(
        agent_assistant_enabled=SimpleNamespace(enabled=False),
        agent_trace_recording=SimpleNamespace(
            allow_local_traces=True,
            allow_remote_export=False,
        ),
    )
    captured: dict[str, Any] = {}

    class _RenderedBootMessage:
        def render(self) -> str:
            return "rendered"

    def capture_replace(message: Any, **changes: Any) -> _RenderedBootMessage:
        assert message is boot_message
        captured.update(changes)
        return _RenderedBootMessage()

    monkeypatch.setattr(serve, "replace", capture_replace)

    assert _render_boot_message(boot_message, system_settings) == "rendered"  # type: ignore[arg-type]
    assert captured["agent_assistant_enabled"] is False
    assistant_config = captured["assistant_config"]
    assert assistant_config.project_name == "custom_assistant"
    assert assistant_config.allow_local_traces is True
    assert assistant_config.allow_remote_export is False
    assert assistant_config.collector_endpoint == "http://collector.example:4318"
    assert assistant_config.api_key_configured is True
    assert assistant_config.force_tracing is False
    assert assistant_config.web_access_enabled is True
    assert assistant_config.server_bash_enabled is False


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


@pytest.mark.postgres_only
async def test_create_db_session_factory_routes_reads_to_replica_for_postgres(
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


@pytest.mark.postgres_only
async def test_create_db_session_factory_uses_primary_when_replica_not_configured_for_postgres(
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
