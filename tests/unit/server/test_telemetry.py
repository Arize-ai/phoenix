import asyncio
import contextlib
import logging
from argparse import ArgumentParser
from functools import partial
from pathlib import Path
from typing import Any, AsyncIterator, Iterator, Optional
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import grpc
import grpc.aio
import httpx2
import pytest
import sqlean
import strawberry
from asgi_lifespan import LifespanManager
from fastapi import FastAPI
from graphql import parse, print_ast
from opentelemetry import baggage, trace
from opentelemetry import context as otel_context
from opentelemetry._logs import SeverityNumber
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import TraceServiceStub
from opentelemetry.sdk._logs import LoggerProvider
from opentelemetry.sdk._logs.export import InMemoryLogRecordExporter, SimpleLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.attributes.service_attributes import SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import NonRecordingSpan, SpanContext, SpanKind, StatusCode
from sqlalchemy import event, make_url, text

from phoenix.config import (
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
    ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
)
from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine
from phoenix.server import app as app_module
from phoenix.server import telemetry as telemetry_module
from phoenix.server.api.redaction import Redacted, RedactingOpenTelemetryExtension
from phoenix.server.app import (
    CapacityInterceptor,
    ServerSpanContextMiddleware,
    _native_telemetry_config,
    create_app,
)
from phoenix.server.cli.commands import serve
from phoenix.server.cli.commands.serve import _create_db_session_factory
from phoenix.server.grpc_server import GrpcServer, TracingServerInterceptor, _peer_attributes
from phoenix.server.lifecycle import Cleanup
from phoenix.server.telemetry import (
    SCHEMA_URL,
    ServerTelemetry,
    _extract_db_engine_attributes,
    _extract_sql_operation,
    _OtelLoggingHandler,
    _server_resource,
    bind_server_span,
    get_bound_server_span,
    instrument_sqlalchemy_engine,
    normalize_http_log_collector_endpoint,
    normalize_http_trace_collector_endpoint,
    resolve_server_parent_context,
)
from phoenix.server.types import DbSessionFactory
from phoenix.session.session import ThreadSession
from phoenix.tracers import detached_otel_context
from phoenix.version import __version__
from tests.unit.conftest import (
    TestBulkInserter,
    _serialized,
    patch_dml_event_handler,
    patch_grpc_server,
)


def test_suppress_instrumentation_key_is_resolved() -> None:
    assert telemetry_module._SUPPRESS_INSTRUMENTATION_KEY is not None
    assert telemetry_module._SUPPRESS_INSTRUMENTATION_KEY == _SUPPRESS_INSTRUMENTATION_KEY


def test_normalize_http_trace_collector_endpoint() -> None:
    expected = "http://localhost:4318/v1/traces"
    assert normalize_http_trace_collector_endpoint("http://localhost:4318") == expected
    assert normalize_http_trace_collector_endpoint("http://localhost:4318/") == expected
    assert normalize_http_trace_collector_endpoint("localhost:4318") == expected
    assert normalize_http_trace_collector_endpoint("http://localhost:4318/v1/traces") == expected
    assert normalize_http_trace_collector_endpoint("localhost:4318/v1/traces") == expected
    assert (
        normalize_http_trace_collector_endpoint("https://localhost:4318/v1/traces")
        == "https://localhost:4318/v1/traces"
    )


def test_normalize_http_log_collector_endpoint() -> None:
    expected = "http://localhost:4318/v1/logs"
    assert normalize_http_log_collector_endpoint("http://localhost:4318") == expected
    assert normalize_http_log_collector_endpoint("localhost:4318") == expected
    assert normalize_http_log_collector_endpoint("http://localhost:4318/v1/logs") == expected


def test_server_resource_carries_service_name_and_version() -> None:
    attributes = _server_resource().attributes
    assert attributes[SERVICE_NAME] == "arize-phoenix-server"
    assert attributes[SERVICE_VERSION] == __version__


class TestGraphQLTracingExtension:
    @strawberry.input
    class CredentialInput:
        name: str
        value: Redacted[str]

    @strawberry.input
    class CreateUserInput:
        email: Redacted[str]
        role: str
        password: Redacted[Optional[str]] = strawberry.UNSET
        credentials: Optional[list["TestGraphQLTracingExtension.CredentialInput"]] = None

    @strawberry.type
    class Item:
        value: strawberry.Private[int]

        @strawberry.field
        async def label(self) -> str:
            return f"item-{self.value}"

    @strawberry.type
    class Query:
        @strawberry.field
        def spans(self, filter_condition: str) -> str:
            return filter_condition

        @strawberry.field
        def boom(self) -> str:
            raise RuntimeError("boom")

        @strawberry.field
        def items(self) -> list["TestGraphQLTracingExtension.Item"]:
            return [TestGraphQLTracingExtension.Item(value=i) for i in range(3)]

    @strawberry.type
    class Mutation:
        @strawberry.mutation
        def create_user(
            self,
            input: "TestGraphQLTracingExtension.CreateUserInput",
            note: Redacted[str] = "",
        ) -> str:
            return input.email

        @strawberry.mutation
        def create_project(self, name: str) -> str:
            return name

    @strawberry.type
    class Subscription:
        @strawberry.subscription
        async def counter(self) -> AsyncIterator[int]:
            yield 1
            yield 2

        @strawberry.subscription
        async def traced_counter(self) -> AsyncIterator[int]:
            for value in (1, 2):
                binding = get_bound_server_span()
                assert binding is not None
                _, provider = binding
                provider.get_tracer("test").start_span(
                    f"stream step {value}", context=resolve_server_parent_context(provider)
                ).end()
                yield value

    @pytest.fixture
    def exporter(self) -> InMemorySpanExporter:
        return InMemorySpanExporter()

    @pytest.fixture
    def schema(self, exporter: InMemorySpanExporter) -> Iterator[strawberry.Schema]:
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        try:
            yield strawberry.Schema(
                query=self.Query,
                mutation=self.Mutation,
                subscription=self.Subscription,
                extensions=[
                    partial(RedactingOpenTelemetryExtension, tracer_provider=tracer_provider)
                ],
            )
        finally:
            tracer_provider.shutdown()

    @staticmethod
    def _spans(exporter: InMemorySpanExporter) -> dict[str, dict[str, Any]]:
        return {span.name: dict(span.attributes or {}) for span in exporter.get_finished_spans()}

    async def test_redacted_fields_are_blanked_and_the_rest_recorded(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        document = (
            "mutation CreateUser($input: CreateUserInput!, $note: String!)"
            " { createUser(input: $input, note: $note) }"
        )
        variables = {
            "input": {
                "email": "alice@example.com",
                "role": "ADMIN",
                "password": "hunter2",
                "credentials": [{"name": "OPENAI_API_KEY", "value": "sk-live-123"}],
            },
            "note": "reset by alice@example.com",
        }

        result = await schema.execute(document, variable_values=variables)

        assert result.errors is None
        spans = self._spans(exporter)
        assert spans["GraphQL Query: CreateUser"]["query"] == print_ast(parse(document))
        assert spans["GraphQL Resolving: createUser"] == {
            "component": "graphql",
            "graphql.parentType": "Mutation",
            "graphql.path": "createUser",
            "graphql.param.input": (
                "{email: [redacted], role: ADMIN, password: [redacted], "
                "credentials: {name: OPENAI_API_KEY, value: [redacted]}}"
            ),
            "graphql.param.note": "[redacted]",
        }
        for secret in ("alice@example.com", "hunter2", "sk-live-123"):
            assert all(secret not in str(attributes) for attributes in spans.values())

    async def test_inlined_literals_are_redacted_in_the_recorded_document(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        document = (
            'mutation CreateUser { createUser(note: "reset by alice@example.com", input: {'
            'email: "alice@example.com", role: "ADMIN", password: "hunter2", '
            'credentials: [{name: "OPENAI_API_KEY", value: "sk-live-123"}]}) }'
        )

        result = await schema.execute(document)

        assert result.errors is None
        query = self._spans(exporter)["GraphQL Query: CreateUser"]["query"]
        assert query.count('"[redacted]"') == 4
        assert 'role: "ADMIN"' in query
        assert 'name: "OPENAI_API_KEY"' in query
        for secret in ("alice@example.com", "hunter2", "sk-live-123"):
            assert secret not in query

    async def test_variable_default_values_on_redacted_fields_are_blanked(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        document = (
            "mutation CreateUser("
            '$input: CreateUserInput! = {email: "alice@example.com", role: "ADMIN", password: "hunter2"}, '
            '$note: String! = "secret note", '
            '$projectName: String! = "public-demo"'
            ") { createUser(input: $input, note: $note) createProject(name: $projectName) }"
        )

        result = await schema.execute(document)

        assert result.errors is None
        query = self._spans(exporter)["GraphQL Query: CreateUser"]["query"]
        assert '"public-demo"' in query
        for secret in ("alice@example.com", "hunter2", "secret note"):
            assert secret not in query

    async def test_unparseable_request_records_no_document(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute('mutation { createUser(input: {email: "alice@example.com" ')

        assert result.errors
        spans = self._spans(exporter)
        assert "query" not in spans["GraphQL Query"]
        assert all("alice@example.com" not in str(attributes) for attributes in spans.values())

    @pytest.mark.parametrize(
        "document",
        [
            'mutation BadVarType($input: WrongInputType! = {password: "secret-hunter2"}) { createUser(input: $input) }',
            'mutation MismatchedVarType($input: String! = "secret-hunter2") { createUser(input: $input) }',
            'mutation UnusedVar($unused: String = "secret-hunter2") { createProject(name: "demo") }',
            'mutation BadArgName { createUser(inp_typo: {password: "secret-hunter2"}) }',
            'mutation BadFieldName { createUser(input: {email: "a@b.com", role: "ADMIN", passwrod: "secret-hunter2"}) }',
            'mutation BadInputShape { createUser(input: ["secret-hunter2"]) }',
        ],
    )
    async def test_validation_failing_queries_fail_closed_and_redact_literals(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter, document: str
    ) -> None:
        result = await schema.execute(document)

        assert result.errors
        spans = self._spans(exporter)
        operation = next(attrs for name, attrs in spans.items() if name.startswith("GraphQL Query"))
        assert "[redacted]" in operation["query"]
        assert all("secret-hunter2" not in str(attributes) for attributes in spans.values())

    async def test_operation_with_resolver_error_still_records_query(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute("query Partial { boom }")

        assert result.errors
        assert (
            self._spans(exporter)["GraphQL Query: Partial"]["query"] == "query Partial {\n  boom\n}"
        )

    async def test_other_resolver_arguments_are_recorded(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute('mutation CreateProject { createProject(name: "demo") }')
        assert result.errors is None
        result = await schema.execute(
            "query Spans { spans(filterCondition: \"span_kind == 'LLM'\") }"
        )
        assert result.errors is None

        spans = self._spans(exporter)
        assert spans["GraphQL Resolving: createProject"]["graphql.param.name"] == "demo"
        assert spans["GraphQL Resolving: spans"]["graphql.param.filterCondition"] == (
            "span_kind == 'LLM'"
        )

    async def test_subscription_aclose_from_different_task_does_not_raise_contextvar_error(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        stream: Any = await schema.subscribe("subscription Count { counter }")
        assert hasattr(stream, "__anext__")
        first = await stream.__anext__()
        assert first.data == {"counter": 1}

        async def _close_in_other_task() -> None:
            await stream.aclose()

        await asyncio.create_task(_close_in_other_task())
        spans = self._spans(exporter)
        assert "GraphQL Query: Count" in spans
        assert "counter" in spans["GraphQL Query: Count"]["query"]

    async def test_tracing_failures_never_affect_graphql_results(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        with (
            patch.object(
                RedactingOpenTelemetryExtension, "add_tags", side_effect=RuntimeError("bug")
            ),
            patch("phoenix.server.api.redaction.redact_document", side_effect=RuntimeError("bug")),
        ):
            result = await schema.execute('mutation CreateProject { createProject(name: "demo") }')

        assert result.errors is None
        assert result.data == {"createProject": "demo"}
        spans = self._spans(exporter)
        assert "query" not in spans["GraphQL Query: CreateProject"]
        assert "graphql.param.name" not in spans["GraphQL Resolving: createProject"]

    async def test_resolvers_inside_list_items_are_not_traced(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute("query Items { items { label } }")

        assert result.errors is None
        assert result.data == {"items": [{"label": f"item-{i}"} for i in range(3)]}
        names = [span.name for span in exporter.get_finished_spans()]
        assert "GraphQL Resolving: items" in names
        assert "GraphQL Resolving: label" not in names

    async def test_subscription_stream_work_is_parented_to_the_operation_span(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        stream: Any = await schema.subscribe("subscription Traced { tracedCounter }")
        values = [result.data async for result in stream]

        assert values == [{"tracedCounter": 1}, {"tracedCounter": 2}]
        spans = {span.name: span for span in exporter.get_finished_spans()}
        operation = spans["GraphQL Query: Traced"]
        for name in ("stream step 1", "stream step 2"):
            parent = spans[name].parent
            assert parent is not None
            assert parent.span_id == operation.context.span_id

    async def test_variable_redaction_is_scoped_per_operation(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        document = (
            'mutation Public($v: String! = "public-demo") { createProject(name: $v) }\n'
            'mutation Secret($v: String! = "secret-note") { createUser('
            'input: {email: "a@b.com", role: "ADMIN"}, note: $v) }'
        )

        result = await schema.execute(document, operation_name="Public")

        assert result.errors is None
        query = self._spans(exporter)["GraphQL Query: Public"]["query"]
        assert '"public-demo"' in query
        assert "secret-note" not in query


def test_phoenix_schema_marks_user_and_credential_fields() -> None:
    from types import SimpleNamespace

    from phoenix.server.api.redaction import redact_arguments
    from phoenix.server.api.schema import build_graphql_schema

    mutation = build_graphql_schema()._schema.type_map["Mutation"]
    info = SimpleNamespace(parent_type=mutation, field_name="createUser")
    args = {
        "input": {
            "email": "alice@example.com",
            "username": "alice",
            "password": "hunter2",
            "role": "ADMIN",
            "sendWelcomeEmail": True,
        }
    }

    assert redact_arguments(args, info) == {  # type: ignore[arg-type]
        "input": {
            "email": "[redacted]",
            "username": "[redacted]",
            "password": "[redacted]",
            "role": "ADMIN",
            "sendWelcomeEmail": True,
        }
    }

    info = SimpleNamespace(parent_type=mutation, field_name="createGenerativeModelCustomProvider")
    args = {
        "input": {
            "name": "my-openai",
            "provider": "openai",
            "clientConfig": {
                "openai": {"openaiAuthenticationMethod": {"apiKey": "sk-live-123"}},
            },
        }
    }
    redacted = redact_arguments(args, info)  # type: ignore[arg-type]
    assert "sk-live-123" not in str(redacted)
    assert redacted["input"]["name"] == "my-openai"

    info = SimpleNamespace(parent_type=mutation, field_name="createSpanNotes")
    notes: dict[str, Any] = {
        "input": [{"span": {"id": "U3Bhbjox"}, "note": "customer said their SSN is ..."}]
    }
    assert redact_arguments(notes, info) == {  # type: ignore[arg-type]
        "input": [{"span": {"id": "U3Bhbjox"}, "note": "[redacted]"}]
    }


def _new_tracer_provider(
    resource: Optional[Resource] = None,
) -> tuple[TracerProvider, InMemorySpanExporter]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    return provider, exporter


def _fake_server_generator() -> Iterator[Mock]:
    thread = Mock()
    thread.is_alive.return_value = True
    try:
        yield thread
    finally:
        thread.is_alive.return_value = False


class TestSqlAlchemyEngineTracing:
    def test_db_engine_static_attributes_sanitizes_sqlite_paths_and_omits_default_pg_port(
        self,
    ) -> None:
        assert _extract_db_engine_attributes(
            "sqlite", make_url("sqlite+aiosqlite:///:memory:")
        ) == (
            {"db.system.name": "sqlite", "db.namespace": ":memory:"},
            ":memory:",
        )
        assert _extract_db_engine_attributes(
            "sqlite", make_url("sqlite+aiosqlite:////private/user/dir/phoenix.db")
        ) == (
            {"db.system.name": "sqlite", "db.namespace": "phoenix.db"},
            "phoenix.db",
        )
        assert _extract_db_engine_attributes(
            "postgresql",
            make_url("postgresql+asyncpg://user:secret@db.internal:5432/phoenix"),
        ) == (
            {
                "db.system.name": "postgresql",
                "db.namespace": "phoenix",
                "server.address": "db.internal",
            },
            "phoenix",
        )
        assert _extract_db_engine_attributes(
            "postgresql",
            make_url("postgresql+asyncpg://user:secret@db.internal:5433/phoenix"),
        ) == (
            {
                "db.system.name": "postgresql",
                "db.namespace": "phoenix",
                "server.address": "db.internal",
                "server.port": 5433,
            },
            "phoenix",
        )

    async def test_skips_parentless_and_suppressed_queries(self, tmp_path: Path) -> None:
        engine = aio_sqlite_engine(
            url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
        )
        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)
        try:
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 999"))
            assert exporter.get_finished_spans() == ()

            with (
                tracer.start_as_current_span("suppressed", kind=SpanKind.SERVER) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                token = otel_context.attach(
                    otel_context.set_value(_SUPPRESS_INSTRUMENTATION_KEY, True)
                )
                try:
                    async with engine.connect() as connection:
                        await connection.execute(text("SELECT 888"))
                finally:
                    otel_context.detach(token)
            assert [s for s in exporter.get_finished_spans() if s.kind is SpanKind.CLIENT] == []
        finally:
            uninstrument()
            provider.shutdown()
            await engine.dispose()

    async def test_listener_failures_never_affect_queries(self, tmp_path: Path) -> None:
        engine = aio_sqlite_engine(
            url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
        )
        provider, _ = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)
        try:
            with (
                patch.object(
                    telemetry_module, "_extract_sql_operation", side_effect=RuntimeError("bug")
                ),
                tracer.start_as_current_span("request", kind=SpanKind.SERVER) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                async with engine.connect() as connection:
                    assert (await connection.execute(text("SELECT 7"))).scalar() == 7
                    with pytest.raises(Exception, match="no such table"):
                        await connection.execute(text("SELECT * FROM missing_table"))
        finally:
            uninstrument()
            provider.shutdown()
            await engine.dispose()

    async def test_traces_each_engine_and_uninstruments_independently(self, tmp_path: Path) -> None:
        url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
        primary_engine = aio_sqlite_engine(url=url, migrate=False)
        async with primary_engine.connect() as connection:
            await connection.execute(text("SELECT 0"))
        read_engine = aio_sqlite_read_engine(url)
        assert read_engine is not None

        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument_primary = instrument_sqlalchemy_engine(
            primary_engine, tracer_provider=provider
        )
        uninstrument_read = instrument_sqlalchemy_engine(read_engine, tracer_provider=provider)
        try:
            with (
                tracer.start_as_current_span("request", kind=SpanKind.SERVER) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                async with primary_engine.connect() as connection:
                    await connection.execute(text("SELECT 41"))
                async with read_engine.connect() as connection:
                    await connection.execute(text("/* comment */\nSELECT\n  42"))

            statements = {
                str(span.attributes["db.query.text"]): span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "db.query.text" in span.attributes
            }
            for statement_text in ("SELECT 41", "/* comment */\nSELECT\n  42"):
                sql_span = statements[statement_text]
                assert sql_span.parent is not None
                assert sql_span.parent.span_id == parent_span.get_span_context().span_id
                assert sql_span.context.trace_id == parent_span.get_span_context().trace_id
                assert sql_span.instrumentation_scope is not None
                assert sql_span.instrumentation_scope.schema_url == SCHEMA_URL
                assert sql_span.attributes is not None
                assert sql_span.attributes["db.system.name"] == "sqlite"
                assert sql_span.attributes["db.operation.name"] == "SELECT"
                assert sql_span.attributes["db.namespace"] == "phoenix.db"
                assert str(tmp_path) not in str(sql_span.attributes["db.namespace"])

            uninstrument_primary()
            uninstrument_primary()
            exporter.clear()

            with (
                tracer.start_as_current_span("after-uninstrument", kind=SpanKind.SERVER) as parent,
                bind_server_span(parent, provider),
            ):
                async with primary_engine.connect() as connection:
                    await connection.execute(text("SELECT 101"))
                async with read_engine.connect() as connection:
                    await connection.execute(text("SELECT 102"))

            remaining = {
                str(span.attributes["db.query.text"])
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "db.query.text" in span.attributes
            }
            assert "SELECT 101" not in remaining
            assert "SELECT 102" in remaining
        finally:
            uninstrument_primary()
            uninstrument_read()
            provider.shutdown()
            await primary_engine.dispose()
            await read_engine.dispose()

    @pytest.mark.parametrize("invalidate_connection", [False, True])
    async def test_records_error_status_and_exception_event_on_failed_query(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, invalidate_connection: bool
    ) -> None:
        url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
        engine = aio_sqlite_engine(url=url, migrate=False)
        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)
        try:
            with (
                tracer.start_as_current_span(
                    "failing-request", kind=SpanKind.SERVER
                ) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                async with engine.connect() as connection:
                    await connection.begin()
                    if invalidate_connection:

                        def fail_execute(*args: Any, **kwargs: Any) -> None:
                            assert connection.sync_connection is not None
                            connection.sync_connection.invalidate()
                            raise sqlean.OperationalError("connection invalidated")

                        monkeypatch.setattr(engine.sync_engine.dialect, "do_execute", fail_execute)
                    with pytest.raises(sqlean.OperationalError):
                        await connection.execute(text("SELECT * FROM missing_table"))

            failed_spans = [
                span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and span.attributes.get("db.query.text") == "SELECT * FROM missing_table"
            ]
            assert len(failed_spans) == 1
            failed_span = failed_spans[0]
            assert failed_span.status.status_code is StatusCode.ERROR
            assert failed_span.attributes is not None
            assert str(failed_span.attributes["error.type"]).endswith("OperationalError")
            if not invalidate_connection:
                assert failed_span.attributes["db.response.status_code"] == "1"
            assert any(ev.name == "exception" for ev in failed_span.events)
        finally:
            uninstrument()
            provider.shutdown()
            await engine.dispose()

    async def test_cancelled_query_leaves_span_status_unset(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
        engine = aio_sqlite_engine(url=url, migrate=False)
        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)
        try:
            with (
                tracer.start_as_current_span(
                    "cancelled-request", kind=SpanKind.SERVER
                ) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                async with engine.connect() as connection:
                    await connection.execute(text("SELECT 1"))
                    monkeypatch.setattr(
                        engine.sync_engine.dialect,
                        "do_execute",
                        Mock(side_effect=asyncio.CancelledError()),
                    )
                    with pytest.raises(asyncio.CancelledError):
                        await connection.execute(text("SELECT 777"))

            cancelled_spans = [
                span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and span.attributes.get("db.query.text") == "SELECT 777"
            ]
            assert len(cancelled_spans) == 1
            assert cancelled_spans[0].status.status_code is StatusCode.UNSET
            assert "error.type" not in (cancelled_spans[0].attributes or {})
            assert not cancelled_spans[0].events
        finally:
            uninstrument()
            provider.shutdown()
            await engine.dispose()

    async def test_records_batch_size_and_batch_operation_name_for_executemany(
        self, tmp_path: Path
    ) -> None:
        engine = aio_sqlite_engine(
            url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
        )
        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)
        try:
            async with engine.begin() as connection:
                await connection.execute(text("CREATE TABLE items (val INTEGER)"))
            with (
                tracer.start_as_current_span("batch-request", kind=SpanKind.SERVER) as parent_span,
                bind_server_span(parent_span, provider),
            ):
                async with engine.begin() as connection:
                    await connection.execute(
                        text("INSERT INTO items (val) VALUES (:val)"),
                        [{"val": 1}, {"val": 2}, {"val": 3}],
                    )

            insert_spans = [
                span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "INSERT INTO items" in str(span.attributes.get("db.query.text", ""))
            ]
            assert len(insert_spans) == 1
            attrs = dict(insert_spans[0].attributes or {})
            assert attrs["db.operation.name"] == "BATCH INSERT"
            assert attrs["db.operation.batch.size"] == 3
            assert insert_spans[0].name == "BATCH INSERT phoenix.db"
        finally:
            uninstrument()
            provider.shutdown()
            await engine.dispose()


class _FullIndicator:
    is_full = True


def _trace_service_stub(channel: grpc.aio.Channel) -> Any:
    return TraceServiceStub(channel)  # type: ignore[no-untyped-call,unused-ignore]


class TestGrpcServerTracing:
    @pytest.mark.parametrize(
        "peer, expected",
        [
            (
                "ipv4:127.0.0.1:54321",
                {"network.peer.address": "127.0.0.1", "network.peer.port": 54321},
            ),
            ("ipv6:[::1]:54321", {"network.peer.address": "::1", "network.peer.port": 54321}),
            (
                "ipv6:[fe80::1%25eth0]:54321",
                {"network.peer.address": "fe80::1%eth0", "network.peer.port": 54321},
            ),
            ("ipv6:[::1]", {"network.peer.address": "::1"}),
            (
                "ipv6:%5B::1%5D:49994",
                {"network.peer.address": "::1", "network.peer.port": 49994},
            ),
            ("ipv6:[::1]x", {}),
            ("ipv4:127.0.0.1:not-a-port", {}),
            ("ipv4:1.2.3.4:\u00b2", {}),
            ("ipv4:1.2.3.4:99999", {}),
            (
                "ipv4:10.0.0.1:4000,10.0.0.2:5000",
                {"network.peer.address": "10.0.0.1", "network.peer.port": 4000},
            ),
            ("unix:/tmp/phoenix.sock", {"network.peer.address": "/tmp/phoenix.sock"}),
            ("unix:", {}),
            (None, {}),
        ],
    )
    def test_peer_attributes_parses_ipv4_ipv6_and_ignores_unix_sockets(
        self, peer: Optional[str], expected: dict[str, Any]
    ) -> None:
        assert _peer_attributes(peer) == expected

    @pytest.mark.parametrize(
        "method_name, outcome, expected_span_name, expected_rpc_method, expected_status, expected_span_status, expected_error_type, expect_exception_event",
        [
            (
                "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "ok",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "OK",
                StatusCode.UNSET,
                None,
                False,
            ),
            (
                "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "unavailable",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "UNAVAILABLE",
                StatusCode.ERROR,
                "UNAVAILABLE",
                False,
            ),
            (
                "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "abort_unauthenticated",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "UNAUTHENTICATED",
                StatusCode.UNSET,
                None,
                False,
            ),
            (
                "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "cancelled",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "CANCELLED",
                StatusCode.UNSET,
                None,
                False,
            ),
            (
                "/opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "deadline_exceeded",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "opentelemetry.proto.collector.trace.v1.TraceService/Export",
                "DEADLINE_EXCEEDED",
                StatusCode.ERROR,
                "DEADLINE_EXCEEDED",
                False,
            ),
            (
                "/pkg.UnknownSvc/UnknownMethod",
                "exception",
                "grpc",
                "_OTHER",
                "UNKNOWN",
                StatusCode.ERROR,
                "RuntimeError",
                True,
            ),
        ],
    )
    async def test_interceptor_records_rpc_outcomes_and_restores_context(
        self,
        method_name: str,
        outcome: str,
        expected_span_name: str,
        expected_rpc_method: str,
        expected_status: str,
        expected_span_status: StatusCode,
        expected_error_type: str | None,
        expect_exception_event: bool,
    ) -> None:
        provider, exporter = _new_tracer_provider()
        interceptor = TracingServerInterceptor(provider)
        context = MagicMock(spec=grpc.aio.ServicerContext)
        context.invocation_metadata.return_value = (
            ("baggage", "tenant=acme"),
            ("baggage", "region=us-west"),
        )
        context.peer.return_value = "ipv4:127.0.0.1:54321"
        context.code.return_value = None
        context.details.return_value = ""
        context.time_remaining.return_value = 0.0 if outcome == "deadline_exceeded" else 5.0
        observed_baggage: dict[str, object] = {}

        async def handler(request: Any, ctx: grpc.aio.ServicerContext) -> str:
            observed_baggage.update(baggage.get_all())
            if outcome == "unavailable":
                context.code.return_value = grpc.StatusCode.UNAVAILABLE
                context.details.return_value = "busy"
            elif outcome == "abort_unauthenticated":
                context.code.return_value = grpc.StatusCode.UNAUTHENTICATED
                context.details.return_value = "missing bearer token"
                raise grpc.aio.AbortError()
            elif outcome in ("cancelled", "deadline_exceeded"):
                raise asyncio.CancelledError
            elif outcome == "exception":
                raise RuntimeError("servicer exploded")
            return "ok"

        try:
            with provider.get_tracer("test").start_as_current_span("caller") as caller_span:
                if outcome in (
                    "abort_unauthenticated",
                    "cancelled",
                    "deadline_exceeded",
                    "exception",
                ):
                    with pytest.raises(BaseException):
                        await interceptor.intercept(handler, None, context, method_name)
                else:
                    assert await interceptor.intercept(handler, None, context, method_name) == "ok"
                assert trace.get_current_span() is caller_span
                spans = [s for s in exporter.get_finished_spans() if s.name == expected_span_name]
                assert len(spans) == 1
                span = spans[0]

            assert observed_baggage == {}
            assert span.kind is SpanKind.SERVER
            assert span.instrumentation_scope is not None
            assert span.instrumentation_scope.schema_url == SCHEMA_URL
            expected_attrs: dict[str, Any] = {
                "rpc.system.name": "grpc",
                "rpc.method": expected_rpc_method,
                "rpc.response.status_code": expected_status,
                "network.peer.address": "127.0.0.1",
                "network.peer.port": 54321,
            }
            if expected_rpc_method == "_OTHER":
                expected_attrs["rpc.method_original"] = method_name.lstrip("/")
            if expected_error_type is not None:
                expected_attrs["error.type"] = expected_error_type
            assert dict(span.attributes or {}) == expected_attrs
            assert span.status.status_code is expected_span_status
            assert any(ev.name == "exception" for ev in span.events) is expect_exception_event
        finally:
            provider.shutdown()

    async def test_grpc_server_propagates_traceparent_traces_unimplemented_and_isolates_instances(
        self,
    ) -> None:
        original_grpc_aio_server = grpc.aio.server
        provider_a, exporter_a = _new_tracer_provider()
        provider_b, exporter_b = _new_tracer_provider()

        async def _noop_enqueue(span: Any, project_name: str) -> None:
            return None

        server_a = GrpcServer(_noop_enqueue, port=0, host="127.0.0.1", tracer_provider=provider_a)
        server_b = GrpcServer(
            _noop_enqueue,
            port=0,
            host="127.0.0.1",
            tracer_provider=provider_b,
            interceptors=[CapacityInterceptor(_FullIndicator())],
        )
        try:
            async with server_a, server_b:
                assert grpc.aio.server is original_grpc_aio_server
                assert server_a.bound_port is not None and server_a.bound_port > 0
                assert server_b.bound_port is not None and server_b.bound_port > 0
                remote_trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
                remote_span_id = "00f067aa0ba902b7"
                traceparent = f"00-{remote_trace_id}-{remote_span_id}-01"

                async with grpc.aio.insecure_channel(
                    f"127.0.0.1:{server_a.bound_port}"
                ) as channel_a:
                    await _trace_service_stub(channel_a).Export(
                        ExportTraceServiceRequest(),
                        metadata=(("traceparent", traceparent),),
                    )
                    unimplemented_call: Any = channel_a.unary_unary("/foo.Unregistered/Call")
                    with pytest.raises(grpc.aio.AioRpcError) as unimplemented_exc:
                        await unimplemented_call(b"")
                    assert unimplemented_exc.value.code() is grpc.StatusCode.UNIMPLEMENTED

                async with grpc.aio.insecure_channel(
                    f"127.0.0.1:{server_b.bound_port}"
                ) as channel_b:
                    with pytest.raises(grpc.aio.AioRpcError) as rpc_exc:
                        await _trace_service_stub(channel_b).Export(ExportTraceServiceRequest())
                    assert rpc_exc.value.code() is grpc.StatusCode.UNAVAILABLE

            assert grpc.aio.server is original_grpc_aio_server
            spans_a = exporter_a.get_finished_spans()
            assert len(spans_a) == 2
            span_export = next(
                s
                for s in spans_a
                if s.name == "opentelemetry.proto.collector.trace.v1.TraceService/Export"
            )
            span_unimpl = next(s for s in spans_a if s.name == "grpc")
            (span_b,) = exporter_b.get_finished_spans()

            assert f"{span_export.context.trace_id:032x}" == remote_trace_id
            assert span_export.parent is not None
            assert f"{span_export.parent.span_id:016x}" == remote_span_id
            assert span_export.status.status_code is StatusCode.UNSET

            assert span_unimpl.attributes is not None
            assert span_unimpl.attributes["rpc.method"] == "_OTHER"
            assert span_unimpl.attributes["rpc.method_original"] == "foo.Unregistered/Call"
            assert span_unimpl.attributes["rpc.response.status_code"] == "UNIMPLEMENTED"
            assert span_unimpl.attributes["error.type"] == "UNIMPLEMENTED"
            assert span_unimpl.status.status_code is StatusCode.ERROR

            assert span_b.attributes is not None
            assert span_b.attributes["rpc.response.status_code"] == "UNAVAILABLE"
            assert span_b.attributes["error.type"] == "UNAVAILABLE"
            assert span_b.status.status_code is StatusCode.ERROR
        finally:
            provider_a.shutdown()
            provider_b.shutdown()


@pytest.mark.real_graphql_schema_build
async def test_create_app_shares_single_tracer_provider_across_http_graphql_and_db_engines(
    tmp_path: Path,
) -> None:
    provider, exporter = _new_tracer_provider()
    shutdown_spy = MagicMock(wraps=provider.shutdown)
    telemetry = ServerTelemetry(tracer_provider=provider)

    factory, shutdown_callbacks = _create_db_session_factory(
        db_connection_str=f"sqlite:///{tmp_path / 'phoenix.db'}",
        read_replica_connection_str=None,
        server_telemetry=telemetry,
        migrate=True,
        log_to_stdout=False,
        log_migrations=False,
    )
    shutdown_callbacks.append(Cleanup(partial(asyncio.to_thread, shutdown_spy)))

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            server_telemetry=telemetry,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            shutdown_callbacks=shutdown_callbacks,
        )

        async with LifespanManager(app) as manager:
            assert [
                span for span in exporter.get_finished_spans() if span.kind is SpanKind.CLIENT
            ] == []
            exporter.clear()

            async with httpx2.AsyncClient(
                transport=httpx2.ASGITransport(app=manager.app),
                base_url="http://test",
            ) as client:
                response = await client.post(
                    "/graphql",
                    json={"query": "{ projects { edges { node { id name traceCount } } } }"},
                )
                assert response.status_code == 200
                assert "errors" not in response.json()

            spans = exporter.get_finished_spans()
            server_spans = [
                span
                for span in spans
                if span.kind is SpanKind.SERVER and "graphql" in span.name.lower()
            ]
            gql_resolving_spans = [
                span for span in spans if span.name == "GraphQL Resolving: projects"
            ]
            sql_spans = [
                span
                for span in spans
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "SELECT" in str(span.attributes.get("db.query.text", ""))
            ]
            assert server_spans
            assert gql_resolving_spans
            assert sql_spans

            trace_id = gql_resolving_spans[0].context.trace_id
            assert all(span.context.trace_id == trace_id for span in sql_spans)
            assert any(span.context.trace_id == trace_id for span in server_spans)

    assert shutdown_spy.call_count == 1


@pytest.mark.parametrize(
    "statement, expected",
    [
        ("SELECT 42", "SELECT"),
        ("select(1)", "select"),
        ("VALUES('secret', 2)", "VALUES"),
        ("/* leading comment */\n-- line comment\n  insert INTO items VALUES ('x')", "insert"),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", None),
        ("with recursive t as (select 1) select * from t", None),
        ("BEGIN IMMEDIATE;", "BEGIN"),
        ("   ;  ", None),
        ("/* only comment */", None),
        ("123", None),
    ],
)
def test_extract_sql_operation_preserves_case_and_skips_cte_prefix(
    statement: str, expected: Optional[str]
) -> None:
    assert _extract_sql_operation(statement) == expected


@pytest.mark.parametrize("nested_fails", [False, True])
async def test_nested_suppressed_query_does_not_corrupt_enclosing_sql_span(
    tmp_path: Path,
    nested_fails: bool,
) -> None:
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    engine = aio_sqlite_engine(url=url, migrate=False)
    provider, exporter = _new_tracer_provider()
    tracer = provider.get_tracer("test")
    uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)

    def _run_suppressed_nested_query(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        if statement != "SELECT 42":
            return
        token = otel_context.attach(otel_context.set_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
        try:
            if nested_fails:
                with pytest.raises(Exception):
                    connection.exec_driver_sql("SELECT * FROM nonexistent_nested_table")
            else:
                connection.exec_driver_sql("SELECT 1")
        finally:
            otel_context.detach(token)

    event.listen(
        engine.sync_engine,
        "before_cursor_execute",
        _run_suppressed_nested_query,
    )
    try:
        with (
            tracer.start_as_current_span("outer-request", kind=SpanKind.SERVER) as parent_span,
            bind_server_span(parent_span, provider),
        ):
            async with engine.connect() as connection:
                result = await connection.scalar(text("SELECT 42"))
                assert result == 42

        sql_spans = [
            span
            for span in exporter.get_finished_spans()
            if span.kind is SpanKind.CLIENT
            and span.attributes
            and span.attributes.get("db.query.text") != "BEGIN"
        ]
        assert len(sql_spans) == 1
        assert sql_spans[0].attributes is not None
        assert sql_spans[0].attributes["db.query.text"] == "SELECT 42"
        assert sql_spans[0].status.status_code is StatusCode.UNSET
        assert not sql_spans[0].events
    finally:
        event.remove(
            engine.sync_engine,
            "before_cursor_execute",
            _run_suppressed_nested_query,
        )
        uninstrument()
        provider.shutdown()
        await engine.dispose()


@pytest.mark.parametrize("detached", [False, True])
async def test_graphql_and_sql_preserve_server_parentage(
    tmp_path: Path,
    detached: bool,
) -> None:
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    engine = aio_sqlite_engine(url=url, migrate=False)
    server_provider, server_exporter = _new_tracer_provider()
    foreign_provider, foreign_exporter = _new_tracer_provider(server_provider.resource)
    uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=server_provider)

    observed_ambient_span_inside_resolver: list[Any] = []

    @strawberry.type
    class Query:
        @strawberry.field
        async def probe(self) -> int:
            observed_ambient_span_inside_resolver.append(trace.get_current_span())
            async with engine.connect() as connection:
                value = await connection.scalar(text("SELECT 77"))
                return int(value or 0)

    schema = strawberry.Schema(
        query=Query,
        extensions=[partial(RedactingOpenTelemetryExtension, tracer_provider=server_provider)],
    )
    try:
        with (
            foreign_provider.get_tracer("openinference").start_as_current_span(
                "agent-bg"
            ) as foreign_span,
            bind_server_span(foreign_span, foreign_provider),
        ):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 11"))
        assert [s for s in server_exporter.get_finished_spans() if s.kind is SpanKind.CLIENT] == []
        server_exporter.clear()
        foreign_exporter.clear()

        server_tracer = server_provider.get_tracer("fastapi")
        foreign_tracer = foreign_provider.get_tracer("openinference")
        with server_tracer.start_as_current_span("POST /agents/chat", kind=SpanKind.SERVER) as http:
            with bind_server_span(http, server_provider):
                with detached_otel_context() if detached else contextlib.nullcontext():
                    with (
                        foreign_tracer.start_as_current_span("agent.turn")
                        if detached
                        else contextlib.nullcontext(http)
                    ) as ambient_span:
                        gql_result = await schema.execute("{ probe }")
                        assert gql_result.errors is None
                        assert gql_result.data == {"probe": 77}
                        assert trace.get_current_span() is ambient_span

        assert observed_ambient_span_inside_resolver == [ambient_span]

        server_spans = server_exporter.get_finished_spans()
        http_trace_id = http.get_span_context().trace_id
        op_span = next(s for s in server_spans if s.name == "GraphQL Query")
        res_span = next(s for s in server_spans if s.name == "GraphQL Resolving: probe")
        sql_span = next(
            s
            for s in server_spans
            if s.kind is SpanKind.CLIENT
            and s.attributes
            and s.attributes.get("db.query.text") == "SELECT 77"
        )
        assert op_span.context.trace_id == http_trace_id
        assert op_span.parent is not None
        assert op_span.parent.span_id == http.get_span_context().span_id

        assert res_span.context.trace_id == http_trace_id
        assert res_span.parent is not None
        assert res_span.parent.span_id == op_span.context.span_id

        assert sql_span.context.trace_id == http_trace_id
        assert sql_span.parent is not None
        assert sql_span.parent.span_id == res_span.context.span_id

        if detached:
            (exported_oi_span,) = foreign_exporter.get_finished_spans()
            assert exported_oi_span.context.trace_id != http_trace_id
    finally:
        uninstrument()
        server_provider.shutdown()
        foreign_provider.shutdown()
        await engine.dispose()


async def test_fastapi_route_sql_query_preserves_http_parent_across_detached_context(
    tmp_path: Path,
) -> None:
    engine = aio_sqlite_engine(
        url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
    )
    server_provider, server_exporter = _new_tracer_provider()
    foreign_provider, foreign_exporter = _new_tracer_provider()
    uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=server_provider)

    from starlette.middleware import Middleware

    app = FastAPI(
        middleware=[Middleware(ServerSpanContextMiddleware, tracer_provider=server_provider)],
        telemetry=_native_telemetry_config(tracer_provider=server_provider, logger_provider=None),
    )

    @app.get("/items")
    async def get_items() -> dict[str, int]:
        with (
            detached_otel_context(),
            foreign_provider.get_tracer("openinference").start_as_current_span("agent.step"),
        ):
            async with engine.connect() as connection:
                val = await connection.scalar(text("SELECT 123"))
                return {"val": int(val or 0)}

    try:
        async with httpx2.AsyncClient(
            transport=httpx2.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            response = await client.get("/items")
            assert response.status_code == 200
            assert response.json() == {"val": 123}

        spans = server_exporter.get_finished_spans()
        http_span = next(s for s in spans if s.kind is SpanKind.SERVER)
        sql_span = next(
            s
            for s in spans
            if s.kind is SpanKind.CLIENT
            and s.attributes
            and s.attributes.get("db.query.text") == "SELECT 123"
        )
        assert sql_span.context.trace_id == http_span.context.trace_id
        assert sql_span.parent is not None
        assert sql_span.parent.span_id == http_span.context.span_id

        (foreign_span,) = foreign_exporter.get_finished_spans()
        assert foreign_span.context.trace_id != http_span.context.trace_id
    finally:
        uninstrument()
        server_provider.shutdown()
        foreign_provider.shutdown()
        await engine.dispose()


def test_resolve_server_parent_context_handles_reattached_ancestor_and_custom_provider() -> None:
    provider, _ = _new_tracer_provider()
    tracer = provider.get_tracer("test")
    try:
        with (
            tracer.start_as_current_span("http", kind=SpanKind.SERVER) as http_span,
            bind_server_span(http_span, provider),
        ):
            with (
                tracer.start_as_current_span("graphql.resolve") as gql_span,
                bind_server_span(gql_span, provider),
            ):
                # Re-attaching an outer ancestor in ambient context must not override
                # the deeper bound span.
                reattached = otel_context.attach(trace.set_span_in_context(http_span))
                try:
                    resolved = resolve_server_parent_context(provider)
                    assert resolved is not None
                    assert trace.get_current_span(resolved) is gql_span
                finally:
                    otel_context.detach(reattached)

                # A descendant started inside the bound span IS preferred.
                with tracer.start_as_current_span("helper") as child_span:
                    resolved = resolve_server_parent_context(provider)
                    assert resolved is not None
                    assert trace.get_current_span(resolved) is child_span
    finally:
        provider.shutdown()

    class _CustomTracerProvider(trace.TracerProvider):
        def get_tracer(
            self,
            instrumenting_module_name: str,
            instrumenting_library_version: Optional[str] = None,
            schema_url: Optional[str] = None,
            attributes: Optional[Any] = None,
        ) -> trace.Tracer:
            return trace.NoOpTracer()

    custom_provider = _CustomTracerProvider()
    custom_span = NonRecordingSpan(SpanContext(trace_id=11, span_id=22, is_remote=False))
    with bind_server_span(custom_span, custom_provider):
        resolved = resolve_server_parent_context(custom_provider)
        assert resolved is not None
        assert trace.get_current_span(resolved) is custom_span


def test_otel_logging_handler_correlates_spans_respects_suppression_and_isolates_errors() -> None:
    provider, _ = _new_tracer_provider()
    log_exporter = InMemoryLogRecordExporter()  # type: ignore[no-untyped-call]
    logger_provider = LoggerProvider()
    logger_provider.add_log_record_processor(SimpleLogRecordProcessor(log_exporter))
    handler = _OtelLoggingHandler(logger_provider=logger_provider, tracer_provider=provider)
    test_logger = logging.getLogger("phoenix.test.otel_handler")
    test_logger.addHandler(handler)
    test_logger.setLevel(logging.INFO)
    test_logger.propagate = False
    try:
        # 1. Bound server span correlation across detached OpenInference context + custom extra.
        with provider.get_tracer("fastapi").start_as_current_span("GET /test") as http_span:
            with bind_server_span(http_span, provider):
                with detached_otel_context():
                    try:
                        raise ValueError("bad input")
                    except ValueError:
                        test_logger.warning(
                            "handled warning",
                            exc_info=True,
                            extra={"exception.type": "CustomDomainError"},
                        )

        (bound_log,) = log_exporter.get_finished_logs()
        rec = bound_log.log_record
        assert rec.trace_id == http_span.get_span_context().trace_id
        assert rec.span_id == http_span.get_span_context().span_id
        assert rec.severity_number is SeverityNumber.WARN
        assert rec.severity_text == "WARN"
        assert rec.attributes is not None
        assert rec.attributes["exception.type"] == "CustomDomainError"
        assert rec.attributes["exception.message"] == "bad input"
        assert "code.file.path" in rec.attributes
        log_exporter.clear()

        # 2. Ambient span fallback when no server span is bound.
        with provider.get_tracer("worker").start_as_current_span("bg-job") as bg_span:
            test_logger.info("background progress")
        (ambient_log,) = log_exporter.get_finished_logs()
        assert ambient_log.log_record.trace_id == bg_span.get_span_context().trace_id
        log_exporter.clear()

        # 3. _SUPPRESS_INSTRUMENTATION_KEY suppresses emission.
        token = otel_context.attach(otel_context.set_value(_SUPPRESS_INSTRUMENTATION_KEY, True))
        try:
            test_logger.error("suppressedexporter failure")
        finally:
            otel_context.detach(token)
        assert log_exporter.get_finished_logs() == ()

        # 4. Bad format args and cyclic extra do not raise out of emit().
        cyclic: dict[str, Any] = {}
        cyclic["self"] = cyclic
        test_logger.info("cyclic payload", extra={"cyclic": cyclic})
        assert len(log_exporter.get_finished_logs()) == 1
        log_exporter.clear()

        handle_error_spy = MagicMock()
        handler.handleError = handle_error_spy  # type: ignore[method-assign]
        bad_record = logging.LogRecord(
            name=test_logger.name,
            level=logging.WARNING,
            pathname=__file__,
            lineno=1,
            msg="expected int %d",
            args=("not-an-int",),
            exc_info=None,
        )
        handler.emit(bad_record)
        assert handle_error_spy.call_count == 1
    finally:
        test_logger.removeHandler(handler)
        logger_provider.shutdown()
        provider.shutdown()


def test_server_telemetry_from_env_partial_failure_and_use_after_close(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    provider, _ = _new_tracer_provider()
    monkeypatch.setattr(
        provider, "shutdown", MagicMock(side_effect=RuntimeError("tracer cleanup boom"))
    )
    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_tracer_provider", lambda: provider
    )
    monkeypatch.setattr(
        telemetry_module,
        "initialize_opentelemetry_logger_provider",
        Mock(side_effect=RuntimeError("logger init boom")),
    )

    with pytest.raises(RuntimeError, match="logger init boom") as exc_info:
        ServerTelemetry.from_env()
    assert any("tracer cleanup boom" in note for note in getattr(exc_info.value, "__notes__", []))

    engine = aio_sqlite_engine(
        url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
    )
    telemetry = ServerTelemetry()
    telemetry.close()
    try:
        with pytest.raises(RuntimeError, match="closed ServerTelemetry"):
            telemetry.instrument_engine(engine)
    finally:
        asyncio.run(engine.dispose())


def test_server_telemetry_close_removes_root_handler_and_groups_shutdown_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_LOG_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    provider, _ = _new_tracer_provider()
    logger_provider = LoggerProvider()
    tracer_shutdown = MagicMock(side_effect=RuntimeError("tracer shutdown boom"))
    logger_shutdown = MagicMock(side_effect=RuntimeError("logger shutdown boom"))
    monkeypatch.setattr(provider, "shutdown", tracer_shutdown)
    monkeypatch.setattr(logger_provider, "shutdown", logger_shutdown)
    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_tracer_provider", lambda: provider
    )
    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_logger_provider", lambda: logger_provider
    )

    root_logger = logging.getLogger()
    initial_handlers = list(root_logger.handlers)
    telemetry = ServerTelemetry.from_env()
    assert len(root_logger.handlers) == len(initial_handlers) + 1

    with pytest.raises(ExceptionGroup) as exc_group:
        telemetry.close()
    assert {str(e) for e in exc_group.value.exceptions} == {
        "tracer shutdown boom",
        "logger shutdown boom",
    }
    assert list(root_logger.handlers) == initial_handlers
    assert tracer_shutdown.call_count == 1
    assert logger_shutdown.call_count == 1

    telemetry.close()
    assert tracer_shutdown.call_count == 1


async def test_direct_create_app_reinitializes_env_tracing_across_repeated_lifespans(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    created: list[tuple[TracerProvider, InMemorySpanExporter, MagicMock]] = []

    def _make_provider() -> TracerProvider:
        provider, exporter = _new_tracer_provider()
        shutdown_spy = MagicMock(wraps=provider.shutdown)
        monkeypatch.setattr(provider, "shutdown", shutdown_spy)
        created.append((provider, exporter, shutdown_spy))
        return provider

    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_tracer_provider", _make_provider
    )
    engine = aio_sqlite_engine(
        url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=True
    )
    factory = DbSessionFactory(db=app_module._db(engine), dialect="sqlite")

    try:
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_dml_event_handler())
            await stack.enter_async_context(patch_grpc_server())
            app = create_app(
                db=factory,
                authentication_enabled=False,
                serve_ui=False,
                bulk_inserter_factory=TestBulkInserter,
            )
            assert created == []

            for run_idx in range(2):
                async with LifespanManager(app) as manager:
                    assert len(created) == run_idx + 1
                    _, exporter, shutdown_spy = created[run_idx]
                    exporter.clear()
                    async with httpx2.AsyncClient(
                        transport=httpx2.ASGITransport(app=manager.app),
                        base_url="http://test",
                    ) as client:
                        response = await client.get("/readyz")
                        assert response.status_code == 200

                    spans = exporter.get_finished_spans()
                    endpoint_span = next(s for s in spans if s.name == "fastapi.endpoint")
                    sql_spans = [s for s in spans if s.kind is SpanKind.CLIENT]
                    assert sql_spans
                    assert all(
                        s.parent is not None and s.parent.span_id == endpoint_span.context.span_id
                        for s in sql_spans
                    )
                assert shutdown_spy.call_count == 1
    finally:
        await engine.dispose()


async def test_lifespan_runs_remaining_shutdown_callbacks_after_failure(
    _sqlite_test_conn: Any,
) -> None:
    factory = DbSessionFactory(db=_serialized(app_module._db(_sqlite_test_conn)), dialect="sqlite")
    second_callback = MagicMock()

    def _boom_callback() -> None:
        raise RuntimeError("shutdown callback boom")

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            shutdown_callbacks=[_boom_callback, second_callback],
        )
        with pytest.raises(RuntimeError, match="shutdown callback boom"):
            async with LifespanManager(app):
                pass

    assert second_callback.call_count == 1


async def test_lifespan_cancellation_skips_blocking_flush_and_propagates_cancelled_error(
    monkeypatch: pytest.MonkeyPatch,
    _sqlite_test_conn: Any,
) -> None:
    provider, _ = _new_tracer_provider()
    shutdown_spy = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown_spy)
    telemetry = ServerTelemetry(tracer_provider=provider)
    factory = DbSessionFactory(db=_serialized(app_module._db(_sqlite_test_conn)), dialect="sqlite")

    try:
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_dml_event_handler())
            await stack.enter_async_context(patch_grpc_server())
            app = create_app(
                db=factory,
                server_telemetry=telemetry,
                authentication_enabled=False,
                serve_ui=False,
                bulk_inserter_factory=TestBulkInserter,
                startup_callbacks=[Mock(side_effect=asyncio.CancelledError())],
            )
            with pytest.raises(asyncio.CancelledError):
                async with app.router.lifespan_context(app):
                    pass
        assert shutdown_spy.call_count == 0
    finally:
        provider.shutdown()


async def test_lifespan_startup_error_is_preserved_when_shutdown_callback_also_fails(
    _sqlite_test_conn: Any,
) -> None:
    factory = DbSessionFactory(db=_serialized(app_module._db(_sqlite_test_conn)), dialect="sqlite")

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            startup_callbacks=[Mock(side_effect=RuntimeError("startup boom"))],
            shutdown_callbacks=[Mock(side_effect=RuntimeError("shutdown boom"))],
        )
        with pytest.raises(RuntimeError, match="startup boom") as exc_info:
            async with app.router.lifespan_context(app):
                pass
        assert any("shutdown boom" in note for note in getattr(exc_info.value, "__notes__", []))


async def test_thread_session_instruments_sql_engine_and_cleans_up_temp_dir_and_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    created: list[tuple[TracerProvider, InMemorySpanExporter, MagicMock]] = []

    def _make_provider() -> TracerProvider:
        provider, exporter = _new_tracer_provider()
        shutdown_spy = MagicMock(wraps=provider.shutdown)
        monkeypatch.setattr(provider, "shutdown", shutdown_spy)
        created.append((provider, exporter, shutdown_spy))
        return provider

    monkeypatch.setattr(
        telemetry_module,
        "initialize_opentelemetry_tracer_provider",
        _make_provider,
    )

    disposed_engines: list[object] = []
    monkeypatch.setattr(
        "phoenix.session.session.create_engine",
        telemetry_test_wrap_engine(disposed_engines),
    )

    created_temp_dirs: list[Path] = []
    real_temp_dir = __import__("tempfile").TemporaryDirectory

    def _tracking_temp_dir(*args: Any, **kwargs: Any) -> Any:
        td = real_temp_dir(*args, **kwargs)
        created_temp_dirs.append(Path(td.name))
        return td

    monkeypatch.setattr("phoenix.session.session.TemporaryDirectory", _tracking_temp_dir)

    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.side_effect = _fake_server_generator
        with pytest.raises(RuntimeError, match="server start boom"):
            with patch(
                "phoenix.session.session.create_app",
                side_effect=RuntimeError("server start boom"),
            ):
                ThreadSession(database_url="sqlite:///:memory:", host="127.0.0.1")

    assert len(created) == 1
    assert created[0][2].call_count == 1
    assert len(disposed_engines) == 1
    assert len(created_temp_dirs) == 1
    assert not created_temp_dirs[0].exists()

    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.side_effect = _fake_server_generator
        session = ThreadSession(database_url="sqlite:///:memory:", host="127.0.0.1")

    assert len(created_temp_dirs) == 2
    assert created_temp_dirs[1].exists()
    _, exporter, shutdown_spy = created[1]
    try:
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_dml_event_handler())
            await stack.enter_async_context(patch_grpc_server())
            async with LifespanManager(session.app) as manager:
                exporter.clear()
                async with httpx2.AsyncClient(
                    transport=httpx2.ASGITransport(app=manager.app),
                    base_url="http://test",
                ) as client:
                    response = await client.get("/readyz")
                    assert response.status_code == 200

                spans = exporter.get_finished_spans()
                endpoint_span = next(s for s in spans if s.name == "fastapi.endpoint")
                sql_spans = [s for s in spans if s.kind is SpanKind.CLIENT]
                assert sql_spans
                assert all(
                    s.parent is not None and s.parent.span_id == endpoint_span.context.span_id
                    for s in sql_spans
                )
    finally:
        session.end()

    assert shutdown_spy.call_count == 1
    assert not created_temp_dirs[1].exists()
    assert len(disposed_engines) >= 2


def telemetry_test_wrap_engine(disposed_engines: list[object]) -> Any:
    from phoenix.db.engines import create_engine as _real_create_engine

    def _wrapped(*args: Any, **kwargs: Any) -> Any:
        engine = _real_create_engine(*args, **kwargs)
        event.listen(engine.sync_engine, "engine_disposed", disposed_engines.append)
        return engine

    return _wrapped


async def test_cleanup_is_at_most_once_even_after_failure() -> None:
    callback = AsyncMock(side_effect=RuntimeError("dispose failed"))
    cleanup = Cleanup(callback)
    with pytest.raises(RuntimeError, match="dispose failed"):
        cleanup.close()
    await cleanup()
    cleanup.close()
    assert callback.await_count == 1


def test_nonrecording_server_parent_is_bound_explicitly() -> None:
    provider, _ = _new_tracer_provider()
    span = NonRecordingSpan(SpanContext(trace_id=1, span_id=2, is_remote=False))
    try:
        with bind_server_span(span, provider):
            context = resolve_server_parent_context(provider)
            assert context is not None
            assert trace.get_current_span(context) is span
        assert resolve_server_parent_context(provider) is None
    finally:
        provider.shutdown()


def test_app_construction_failure_does_not_close_caller_owned_telemetry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider, _ = _new_tracer_provider()
    telemetry = ServerTelemetry(tracer_provider=provider)
    shutdown = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown)
    monkeypatch.setattr(
        app_module,
        "verify_server_environment_variables",
        Mock(side_effect=RuntimeError("build failed")),
    )
    try:
        with pytest.raises(RuntimeError, match="build failed"):
            create_app(
                db=Mock(spec=DbSessionFactory),
                authentication_enabled=False,
                server_telemetry=telemetry,
            )
        assert shutdown.call_count == 0
    finally:
        telemetry.close()


@pytest.mark.parametrize("failure_site", ["aio_sqlite_read_engine", "get_env_allowed_origins"])
async def test_cli_setup_failure_cleans_engines_and_telemetry(
    monkeypatch: pytest.MonkeyPatch,
    failure_site: str,
) -> None:
    engine = aio_sqlite_engine(url=make_url("sqlite+aiosqlite:///:memory:"), migrate=False)
    provider, exporter = _new_tracer_provider()
    shutdown = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown)
    telemetry = ServerTelemetry(tracer_provider=provider)
    monkeypatch.setattr(ServerTelemetry, "from_env", lambda: telemetry)
    monkeypatch.setattr(serve, "create_engine", lambda **kwargs: engine)
    monkeypatch.setattr(serve, "get_env_enable_prometheus", lambda: False)
    monkeypatch.setattr(serve, failure_site, Mock(side_effect=RuntimeError("setup failed")))
    parser = ArgumentParser()
    serve.register(parser.add_subparsers(dest="command"))
    args = parser.parse_args(["serve", "--database-url", "sqlite:///:memory:"])
    disposed: list[object] = []
    event.listen(engine.sync_engine, "engine_disposed", disposed.append)
    try:
        with pytest.raises(RuntimeError, match="setup failed"):
            await asyncio.to_thread(serve.run, args)
        assert disposed == [engine.sync_engine]
        assert shutdown.call_count == 1

        # Verify SQLAlchemy listeners were removed from the engine on cleanup.
        with (
            provider.get_tracer("test").start_as_current_span(
                "post-cleanup", kind=SpanKind.SERVER
            ) as span,
            bind_server_span(span, provider),
        ):
            async with engine.connect() as connection:
                await connection.execute(text("SELECT 1"))
        assert [s for s in exporter.get_finished_spans() if s.kind is SpanKind.CLIENT] == []
    finally:
        await engine.dispose()


def test_record_span_exception_never_raises() -> None:
    class Unprintable(Exception):
        def __str__(self) -> str:
            raise RuntimeError("broken __str__")

    provider, exporter = _new_tracer_provider()
    span = provider.get_tracer("test").start_span("s")
    telemetry_module.record_span_exception(span, Unprintable())
    span.end()
    provider.shutdown()
    assert len(exporter.get_finished_spans()) == 1


@pytest.mark.parametrize("tracing_enabled", [False, True])
async def test_server_span_middleware_is_installed_only_when_tracing_is_enabled(
    tmp_path: Path, tracing_enabled: bool
) -> None:
    provider, _ = _new_tracer_provider()
    telemetry = ServerTelemetry(tracer_provider=provider if tracing_enabled else None)
    engine = aio_sqlite_engine(
        url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
    )
    try:
        async with contextlib.AsyncExitStack() as stack:
            await stack.enter_async_context(patch_dml_event_handler())
            await stack.enter_async_context(patch_grpc_server())
            app = create_app(
                db=DbSessionFactory(db=app_module._db(engine), dialect="sqlite"),
                authentication_enabled=False,
                serve_ui=False,
                bulk_inserter_factory=TestBulkInserter,
                server_telemetry=telemetry,
            )
            installed = any(
                getattr(m, "cls", None) is ServerSpanContextMiddleware for m in app.user_middleware
            )
            assert installed is tracing_enabled
    finally:
        telemetry.close()
        provider.shutdown()
        await engine.dispose()
