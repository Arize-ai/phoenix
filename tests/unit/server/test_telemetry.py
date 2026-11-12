import asyncio
import contextlib
import logging
import socket
from argparse import ArgumentParser
from functools import partial
from pathlib import Path
from typing import Any, Optional
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import grpc
import grpc.aio
import httpx2
import pytest
import sqlean
import strawberry
from asgi_lifespan import LifespanManager
from graphql import parse, print_ast
from opentelemetry import baggage, trace
from opentelemetry import context as otel_context
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import TraceServiceStub
from opentelemetry.sdk._logs import LoggerProvider
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
from phoenix.server.app import CapacityInterceptor, create_app
from phoenix.server.cli.commands import serve
from phoenix.server.cli.commands.serve import _create_db_session_factory
from phoenix.server.grpc_server import GrpcServer, TracingServerInterceptor
from phoenix.server.lifecycle import Cleanup
from phoenix.server.telemetry import (
    ServerTelemetry,
    _extract_sql_operation,
    _server_resource,
    bind_server_span,
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
    class Query:
        @strawberry.field
        def spans(self, filter_condition: str) -> str:
            return filter_condition

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

    @pytest.fixture
    def exporter(self) -> InMemorySpanExporter:
        return InMemorySpanExporter()

    @pytest.fixture
    def schema(self, exporter: InMemorySpanExporter) -> strawberry.Schema:
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        return strawberry.Schema(
            query=self.Query,
            mutation=self.Mutation,
            extensions=[partial(RedactingOpenTelemetryExtension, tracer_provider=tracer_provider)],
        )

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

    async def test_unparseable_request_records_no_document(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute('mutation { createUser(input: {email: "alice@example.com" ')

        assert result.errors
        spans = self._spans(exporter)
        assert "query" not in spans["GraphQL Query"]
        assert all("alice@example.com" not in str(attributes) for attributes in spans.values())

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


def _free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class TestSqlAlchemyEngineTracing:
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
                str(span.attributes["db.statement"]): span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "db.statement" in span.attributes
            }
            for statement_text in ("SELECT 41", "/* comment */\nSELECT\n  42"):
                sql_span = statements[statement_text]
                assert sql_span.parent is not None
                assert sql_span.parent.span_id == parent_span.get_span_context().span_id
                assert sql_span.context.trace_id == parent_span.get_span_context().trace_id
                assert sql_span.attributes is not None
                assert sql_span.attributes["db.system"] == "sqlite"
                assert sql_span.attributes["db.operation"] == "SELECT"
                assert str(tmp_path / "phoenix.db") in str(sql_span.attributes["db.name"])

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
                str(span.attributes["db.statement"])
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "db.statement" in span.attributes
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
                and span.attributes.get("db.statement") == "SELECT * FROM missing_table"
            ]
            assert len(failed_spans) == 1
            failed_span = failed_spans[0]
            assert failed_span.status.status_code is StatusCode.ERROR
            assert any(ev.name == "exception" for ev in failed_span.events)
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
        "outcome, expected_grpc_code, expected_span_status, expect_exception_event",
        [
            ("ok", grpc.StatusCode.OK, StatusCode.UNSET, False),
            ("unavailable", grpc.StatusCode.UNAVAILABLE, StatusCode.ERROR, False),
            ("abort_unauthenticated", grpc.StatusCode.UNAUTHENTICATED, StatusCode.UNSET, False),
            ("cancelled", grpc.StatusCode.CANCELLED, StatusCode.UNSET, False),
            ("exception", grpc.StatusCode.UNKNOWN, StatusCode.ERROR, True),
        ],
    )
    async def test_interceptor_records_rpc_outcomes_baggage_and_restores_context(
        self,
        outcome: str,
        expected_grpc_code: grpc.StatusCode,
        expected_span_status: StatusCode,
        expect_exception_event: bool,
    ) -> None:
        provider, exporter = _new_tracer_provider()
        interceptor = TracingServerInterceptor(provider)
        context = MagicMock(spec=grpc.aio.ServicerContext)
        context.invocation_metadata.return_value = (
            ("baggage", "tenant=acme"),
            ("baggage", "region=us-west"),
        )
        context.code.return_value = None
        context.details.return_value = ""
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
            elif outcome == "cancelled":
                raise asyncio.CancelledError
            elif outcome == "exception":
                raise RuntimeError("servicer exploded")
            return "ok"

        try:
            with provider.get_tracer("test").start_as_current_span("caller") as caller_span:
                if outcome in ("abort_unauthenticated", "cancelled", "exception"):
                    with pytest.raises(BaseException):
                        await interceptor.intercept(handler, None, context, "/pkg.Svc/Method")
                else:
                    assert (
                        await interceptor.intercept(handler, None, context, "/pkg.Svc/Method")
                        == "ok"
                    )
                assert trace.get_current_span() is caller_span
                spans = [s for s in exporter.get_finished_spans() if s.name == "/pkg.Svc/Method"]
                assert len(spans) == 1
                span = spans[0]

            assert observed_baggage == {"tenant": "acme", "region": "us-west"}
            assert span.kind is SpanKind.SERVER
            assert dict(span.attributes or {}) == {
                "rpc.system": "grpc",
                "rpc.service": "pkg.Svc",
                "rpc.method": "Method",
                "rpc.grpc.status_code": expected_grpc_code.value[0],
            }
            assert span.status.status_code is expected_span_status
            assert any(ev.name == "exception" for ev in span.events) is expect_exception_event
        finally:
            provider.shutdown()

    async def test_grpc_server_propagates_traceparent_orders_interceptors_and_isolates_instances(
        self,
    ) -> None:
        original_grpc_aio_server = grpc.aio.server
        provider_a, exporter_a = _new_tracer_provider()
        provider_b, exporter_b = _new_tracer_provider()
        port_a = _free_tcp_port()
        port_b = _free_tcp_port()

        async def _noop_enqueue(span: Any, project_name: str) -> None:
            return None

        server_a = GrpcServer(
            _noop_enqueue, port=port_a, host="127.0.0.1", tracer_provider=provider_a
        )
        server_b = GrpcServer(
            _noop_enqueue,
            port=port_b,
            host="127.0.0.1",
            tracer_provider=provider_b,
            interceptors=[CapacityInterceptor(_FullIndicator())],
        )
        try:
            async with server_a, server_b:
                assert grpc.aio.server is original_grpc_aio_server
                remote_trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
                remote_span_id = "00f067aa0ba902b7"
                traceparent = f"00-{remote_trace_id}-{remote_span_id}-01"

                async with grpc.aio.insecure_channel(f"127.0.0.1:{port_a}") as channel_a:
                    await _trace_service_stub(channel_a).Export(
                        ExportTraceServiceRequest(),
                        metadata=(("traceparent", traceparent),),
                    )
                async with grpc.aio.insecure_channel(f"127.0.0.1:{port_b}") as channel_b:
                    with pytest.raises(grpc.aio.AioRpcError) as rpc_exc:
                        await _trace_service_stub(channel_b).Export(ExportTraceServiceRequest())
                    assert rpc_exc.value.code() is grpc.StatusCode.UNAVAILABLE

            assert grpc.aio.server is original_grpc_aio_server
            (span_a,) = exporter_a.get_finished_spans()
            (span_b,) = exporter_b.get_finished_spans()

            assert span_a.name == "/opentelemetry.proto.collector.trace.v1.TraceService/Export"
            assert f"{span_a.context.trace_id:032x}" == remote_trace_id
            assert span_a.parent is not None
            assert f"{span_a.parent.span_id:016x}" == remote_span_id
            assert span_a.status.status_code is StatusCode.UNSET

            assert span_b.attributes is not None
            assert span_b.attributes["rpc.grpc.status_code"] == grpc.StatusCode.UNAVAILABLE.value[0]
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

    factory, shutdown_callbacks = _create_db_session_factory(
        db_connection_str=f"sqlite:///{tmp_path / 'phoenix.db'}",
        read_replica_connection_str=None,
        tracer_provider=provider,
        migrate=True,
        log_to_stdout=False,
        log_migrations=False,
    )
    shutdown_callbacks.append(partial(asyncio.to_thread, shutdown_spy))

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            server_telemetry=ServerTelemetry(tracer_provider=provider),
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
                and "SELECT" in str(span.attributes.get("db.statement", ""))
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
        ("select(1)", "SELECT"),
        ("VALUES('secret', 2)", "VALUES"),
        ("/* leading comment */\n-- line comment\n  insert INTO items VALUES ('x')", "INSERT"),
        ("WITH cte AS (SELECT 1) SELECT * FROM cte", "WITH"),
        ("BEGIN IMMEDIATE;", "BEGIN"),
        ("   ;  ", None),
        ("/* only comment */", None),
        ("123", None),
    ],
)
def test_extract_sql_operation_returns_only_uppercased_leading_keyword(
    statement: str, expected: Optional[str]
) -> None:
    assert _extract_sql_operation(statement) == expected


async def test_nested_suppressed_query_failure_does_not_corrupt_enclosing_sql_span(
    tmp_path: Path,
) -> None:
    url = make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}")
    engine = aio_sqlite_engine(url=url, migrate=False)
    provider, exporter = _new_tracer_provider()
    tracer = provider.get_tracer("test")
    uninstrument = instrument_sqlalchemy_engine(engine, tracer_provider=provider)

    def _run_suppressed_failing_nested_query(
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
            with pytest.raises(Exception):
                connection.exec_driver_sql("SELECT * FROM nonexistent_nested_table")
        finally:
            otel_context.detach(token)

    event.listen(
        engine.sync_engine,
        "before_cursor_execute",
        _run_suppressed_failing_nested_query,
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
            and span.attributes.get("db.statement") == "SELECT 42"
        ]
        assert len(sql_spans) == 1
        assert sql_spans[0].status.status_code is StatusCode.UNSET
        assert not sql_spans[0].events
    finally:
        event.remove(
            engine.sync_engine,
            "before_cursor_execute",
            _run_suppressed_failing_nested_query,
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
            and s.attributes.get("db.statement") == "SELECT 77"
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


def test_server_telemetry_removes_root_log_handler_and_continues_cleanup_after_failure(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
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
    tracer_shutdown = MagicMock(wraps=provider.shutdown)
    logger_shutdown = MagicMock(wraps=logger_provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", tracer_shutdown)
    monkeypatch.setattr(logger_provider, "shutdown", logger_shutdown)
    monkeypatch.setattr(telemetry_module, "LoggerProvider", lambda **_: logger_provider)
    monkeypatch.setattr(telemetry_module, "BatchLogRecordProcessor", lambda *_: MagicMock())
    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_tracer_provider", lambda: provider
    )

    engine = aio_sqlite_engine(
        url=make_url(f"sqlite+aiosqlite:///{tmp_path / 'phoenix.db'}"), migrate=False
    )
    root_logger = logging.getLogger()
    initial_handlers = list(root_logger.handlers)
    telemetry = ServerTelemetry.from_env()
    telemetry.instrument_engine(engine)
    assert len(root_logger.handlers) == len(initial_handlers) + 1

    monkeypatch.setattr(event, "remove", Mock(side_effect=RuntimeError("listener removal boom")))
    with pytest.raises(RuntimeError, match="listener removal boom"):
        telemetry.close()

    assert list(root_logger.handlers) == initial_handlers
    assert tracer_shutdown.call_count == 1
    assert logger_shutdown.call_count == 1
    telemetry.close()
    assert tracer_shutdown.call_count == 1


async def test_direct_create_app_honors_env_tracing_and_shuts_down_provider(
    monkeypatch: pytest.MonkeyPatch,
    _sqlite_test_conn: Any,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    provider, exporter = _new_tracer_provider()
    shutdown_spy = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown_spy)
    monkeypatch.setattr(
        telemetry_module, "initialize_opentelemetry_tracer_provider", lambda: provider
    )
    factory = DbSessionFactory(db=_serialized(app_module._db(_sqlite_test_conn)), dialect="sqlite")

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
        )
        async with LifespanManager(app) as manager:
            async with httpx2.AsyncClient(
                transport=httpx2.ASGITransport(app=manager.app),
                base_url="http://test",
            ) as client:
                response = await client.get("/healthz")
                assert response.status_code == 200

    assert any(span.kind is SpanKind.SERVER for span in exporter.get_finished_spans())
    assert shutdown_spy.call_count == 1


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


async def test_thread_session_instruments_sql_engine_and_cleans_up_on_end(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    provider_failed, _ = _new_tracer_provider()
    failed_shutdown_spy = MagicMock(wraps=provider_failed.shutdown)
    monkeypatch.setattr(provider_failed, "shutdown", failed_shutdown_spy)

    provider, exporter = _new_tracer_provider()
    shutdown_spy = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown_spy)
    providers = iter([provider_failed, provider])
    monkeypatch.setattr(
        telemetry_module,
        "initialize_opentelemetry_tracer_provider",
        lambda: next(providers),
    )

    thread = Mock()
    thread.is_alive.return_value = True

    def _fake_server_gen() -> Any:
        yield thread

    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.return_value = _fake_server_gen()
        with pytest.raises(RuntimeError, match="server start boom"):
            with patch(
                "phoenix.session.session.create_app",
                side_effect=RuntimeError("server start boom"),
            ):
                ThreadSession(database_url="sqlite:///:memory:", host="127.0.0.1")
    assert failed_shutdown_spy.call_count == 1

    with patch("phoenix.session.session.ThreadServer") as mock_server:
        mock_server.return_value.run_in_thread.return_value = _fake_server_gen()
        session = ThreadSession(database_url="sqlite:///:memory:", host="127.0.0.1")
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

                assert [s for s in exporter.get_finished_spans() if s.kind is SpanKind.CLIENT]
    finally:
        session.end()

    assert shutdown_spy.call_count == 1


async def test_failed_cleanup_propagates_and_can_be_retried() -> None:
    callback = AsyncMock(side_effect=[RuntimeError("dispose failed"), None])
    cleanup = Cleanup(callback)
    with pytest.raises(RuntimeError, match="dispose failed"):
        cleanup.close()
    await cleanup()
    cleanup.close()
    assert callback.await_count == 2


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


@pytest.mark.parametrize("owned", [False, True])
def test_app_construction_failure_closes_only_owned_telemetry(
    monkeypatch: pytest.MonkeyPatch,
    owned: bool,
) -> None:
    provider, _ = _new_tracer_provider()
    telemetry = ServerTelemetry(tracer_provider=provider)
    shutdown = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown)
    monkeypatch.setattr(ServerTelemetry, "from_env", lambda: telemetry)
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
                server_telemetry=None if owned else telemetry,
            )
        assert shutdown.call_count == int(owned)
    finally:
        telemetry.close()


@pytest.mark.parametrize("failure_site", ["aio_sqlite_read_engine", "get_env_allowed_origins"])
def test_cli_setup_failure_cleans_engines_and_telemetry(
    monkeypatch: pytest.MonkeyPatch,
    failure_site: str,
) -> None:
    engine = aio_sqlite_engine(url=make_url("sqlite+aiosqlite:///:memory:"), migrate=False)
    provider, _ = _new_tracer_provider()
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
    with pytest.raises(RuntimeError, match="setup failed"):
        serve.run(args)
    assert disposed == [engine.sync_engine]
    assert not engine.sync_engine.dispatch.before_cursor_execute
    assert shutdown.call_count == 1
