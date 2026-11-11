import asyncio
import contextlib
import socket
from functools import partial
from pathlib import Path
from typing import Any, Optional
from unittest.mock import MagicMock

import grpc
import grpc.aio
import httpx2
import pytest
import sqlean
import strawberry
from asgi_lifespan import LifespanManager
from graphql import parse, print_ast
from grpc_interceptor import AsyncServerInterceptor
from opentelemetry import context as otel_context
from opentelemetry import trace
from opentelemetry.context import _SUPPRESS_INSTRUMENTATION_KEY
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2_grpc import TraceServiceStub
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.attributes.service_attributes import SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import SpanKind, StatusCode
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import AsyncEngine
from typing_extensions import override

from phoenix.config import ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT
from phoenix.db.engines import aio_sqlite_engine, aio_sqlite_read_engine
from phoenix.server import app as app_module
from phoenix.server.api.redaction import Redacted, RedactingOpenTelemetryExtension
from phoenix.server.app import CapacityInterceptor, create_app
from phoenix.server.cli.commands.serve import _create_db_session_factory
from phoenix.server.grpc_server import GrpcServer, TracingServerInterceptor
from phoenix.server.telemetry import (
    _server_resource,
    instrument_sqlalchemy_engine,
    normalize_http_log_collector_endpoint,
    normalize_http_trace_collector_endpoint,
)
from phoenix.version import __version__
from tests.unit.conftest import TestBulkInserter, patch_dml_event_handler, patch_grpc_server


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


def _new_tracer_provider() -> tuple[TracerProvider, InMemorySpanExporter]:
    exporter = InMemorySpanExporter()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    return provider, exporter


def _free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


class TestSqlAlchemyEngineTracing:
    async def test_traces_parented_queries_across_engines_and_uninstruments_per_engine(
        self, tmp_path: Path
    ) -> None:
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
            async with primary_engine.connect() as connection:
                await connection.execute(text("SELECT 999"))
            assert exporter.get_finished_spans() == ()

            with tracer.start_as_current_span("suppressed-request", kind=SpanKind.SERVER):
                token = otel_context.attach(
                    otel_context.set_value(_SUPPRESS_INSTRUMENTATION_KEY, True)
                )
                try:
                    async with primary_engine.connect() as connection:
                        await connection.execute(text("SELECT 888"))
                finally:
                    otel_context.detach(token)
            assert all(span.kind is not SpanKind.CLIENT for span in exporter.get_finished_spans())
            exporter.clear()

            with tracer.start_as_current_span("request", kind=SpanKind.SERVER) as parent_span:
                async with primary_engine.connect() as connection:
                    await connection.execute(text("SELECT 41"))
                async with read_engine.connect() as connection:
                    await connection.execute(text("/* comment */\nSELECT\n  42"))

            spans = exporter.get_finished_spans()
            client_spans = [span for span in spans if span.kind is SpanKind.CLIENT]
            statements = {
                str(span.attributes["db.statement"]): span
                for span in client_spans
                if span.attributes and "db.statement" in span.attributes
            }
            assert "SELECT 41" in statements
            assert "/* comment */\nSELECT\n  42" in statements
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

            with tracer.start_as_current_span("after-primary-uninstrument", kind=SpanKind.SERVER):
                async with primary_engine.connect() as connection:
                    await connection.execute(text("SELECT 101"))
                async with read_engine.connect() as connection:
                    await connection.execute(text("SELECT 102"))

            remaining_statements = [
                str(span.attributes["db.statement"])
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and "db.statement" in span.attributes
            ]
            assert "SELECT 101" not in remaining_statements
            assert "SELECT 102" in remaining_statements
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
            with tracer.start_as_current_span("failing-request", kind=SpanKind.SERVER):
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

    @pytest.mark.postgres_only
    async def test_postgresql_engine_records_peer_and_database_attributes(
        self, postgresql_engine: AsyncEngine
    ) -> None:
        provider, exporter = _new_tracer_provider()
        tracer = provider.get_tracer("test")
        uninstrument = instrument_sqlalchemy_engine(postgresql_engine, tracer_provider=provider)
        try:
            with tracer.start_as_current_span("pg-request", kind=SpanKind.SERVER):
                async with postgresql_engine.connect() as connection:
                    await connection.execute(text("SELECT 42"))

            pg_spans = [
                span
                for span in exporter.get_finished_spans()
                if span.kind is SpanKind.CLIENT
                and span.attributes
                and span.attributes.get("db.statement") == "SELECT 42"
            ]
            assert len(pg_spans) == 1
            attributes = dict(pg_spans[0].attributes or {})
            assert attributes["db.system"] == "postgresql"
            assert attributes["db.operation"] == "SELECT"
            assert attributes["db.name"] == postgresql_engine.sync_engine.url.database
            if postgresql_engine.sync_engine.url.host:
                assert attributes["net.peer.name"] == postgresql_engine.sync_engine.url.host
            if postgresql_engine.sync_engine.url.port is not None:
                assert attributes["net.peer.port"] == postgresql_engine.sync_engine.url.port
        finally:
            uninstrument()
            provider.shutdown()


class _FullIndicator:
    is_full = True


class _AbortUnauthenticatedInterceptor(AsyncServerInterceptor):
    @override
    async def intercept(
        self,
        method: Any,
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "missing bearer token")


class _BoomInterceptor(AsyncServerInterceptor):
    @override
    async def intercept(
        self,
        method: Any,
        request_or_iterator: Any,
        context: grpc.aio.ServicerContext,
        method_name: str,
    ) -> Any:
        raise RuntimeError("servicer exploded")


def _trace_service_stub(channel: grpc.aio.Channel) -> Any:
    return TraceServiceStub(channel)  # type: ignore[no-untyped-call,unused-ignore]


class TestGrpcServerTracing:
    async def test_cancellation_ends_span_and_restores_parent_context(self) -> None:
        provider, exporter = _new_tracer_provider()
        interceptor = TracingServerInterceptor(provider)
        context = MagicMock(spec=grpc.aio.ServicerContext)
        context.invocation_metadata.return_value = ()

        async def cancelled_method(request: Any, context: grpc.aio.ServicerContext) -> None:
            raise asyncio.CancelledError

        try:
            with provider.get_tracer("test").start_as_current_span("caller") as parent:
                with pytest.raises(asyncio.CancelledError):
                    await interceptor.intercept(cancelled_method, None, context, "/test/Cancel")
                assert trace.get_current_span() is parent
                (span,) = exporter.get_finished_spans()
                assert span.kind is SpanKind.SERVER
                assert span.attributes is not None
                assert span.attributes["rpc.grpc.status_code"] == grpc.StatusCode.CANCELLED.value[0]
                assert span.status.status_code is StatusCode.UNSET
                assert not span.events
        finally:
            provider.shutdown()

    async def test_propagates_parent_context_and_isolates_instances_without_global_patch(
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
            _noop_enqueue, port=port_b, host="127.0.0.1", tracer_provider=provider_b
        )
        try:
            async with server_a, server_b:
                assert grpc.aio.server is original_grpc_aio_server
                remote_trace_id = "4bf92f3577b34da6a3ce929d0e0e4736"
                remote_span_id = "00f067aa0ba902b7"
                traceparent = f"00-{remote_trace_id}-{remote_span_id}-01"

                async with grpc.aio.insecure_channel(f"127.0.0.1:{port_a}") as channel_a:
                    stub_a = _trace_service_stub(channel_a)
                    await stub_a.Export(
                        ExportTraceServiceRequest(),
                        metadata=(("traceparent", traceparent),),
                    )
                async with grpc.aio.insecure_channel(f"127.0.0.1:{port_b}") as channel_b:
                    stub_b = _trace_service_stub(channel_b)
                    await stub_b.Export(ExportTraceServiceRequest())

            assert grpc.aio.server is original_grpc_aio_server
            spans_a = exporter_a.get_finished_spans()
            spans_b = exporter_b.get_finished_spans()
            assert len(spans_a) == 1
            assert len(spans_b) == 1

            span_a = spans_a[0]
            assert span_a.kind is SpanKind.SERVER
            assert span_a.name == "/opentelemetry.proto.collector.trace.v1.TraceService/Export"
            assert f"{span_a.context.trace_id:032x}" == remote_trace_id
            assert span_a.parent is not None
            assert f"{span_a.parent.span_id:016x}" == remote_span_id
            assert span_a.status.status_code is StatusCode.UNSET
            assert dict(span_a.attributes or {}) == {
                "rpc.system": "grpc",
                "rpc.service": "opentelemetry.proto.collector.trace.v1.TraceService",
                "rpc.method": "Export",
                "rpc.grpc.status_code": grpc.StatusCode.OK.value[0],
            }
        finally:
            provider_a.shutdown()
            provider_b.shutdown()

    async def test_records_capacity_rejection_and_auth_abort_and_uncaught_exception(self) -> None:
        provider, exporter = _new_tracer_provider()
        try:
            port = _free_tcp_port()

            async def _noop_enqueue(span: Any, project_name: str) -> None:
                return None

            capacity_server = GrpcServer(
                _noop_enqueue,
                port=port,
                host="127.0.0.1",
                tracer_provider=provider,
                interceptors=[CapacityInterceptor(_FullIndicator())],
            )
            async with capacity_server:
                async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                    with pytest.raises(grpc.aio.AioRpcError) as rpc_exc:
                        await _trace_service_stub(channel).Export(ExportTraceServiceRequest())
                    assert rpc_exc.value.code() is grpc.StatusCode.UNAVAILABLE

            port = _free_tcp_port()
            auth_server = GrpcServer(
                _noop_enqueue,
                port=port,
                host="127.0.0.1",
                tracer_provider=provider,
                interceptors=[_AbortUnauthenticatedInterceptor()],
            )
            async with auth_server:
                async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                    with pytest.raises(grpc.aio.AioRpcError) as rpc_exc:
                        await _trace_service_stub(channel).Export(ExportTraceServiceRequest())
                    assert rpc_exc.value.code() is grpc.StatusCode.UNAUTHENTICATED

            port = _free_tcp_port()
            boom_server = GrpcServer(
                _noop_enqueue,
                port=port,
                host="127.0.0.1",
                tracer_provider=provider,
                interceptors=[_BoomInterceptor()],
            )
            async with boom_server:
                async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
                    with pytest.raises(grpc.aio.AioRpcError):
                        await _trace_service_stub(channel).Export(ExportTraceServiceRequest())

            spans: tuple[ReadableSpan, ...] = exporter.get_finished_spans()
            assert len(spans) == 3

            unavailable_span, unauth_span, boom_span = spans
            assert unavailable_span.attributes is not None
            assert (
                unavailable_span.attributes["rpc.grpc.status_code"]
                == grpc.StatusCode.UNAVAILABLE.value[0]
            )
            assert unavailable_span.status.status_code is StatusCode.ERROR

            assert unauth_span.attributes is not None
            assert (
                unauth_span.attributes["rpc.grpc.status_code"]
                == grpc.StatusCode.UNAUTHENTICATED.value[0]
            )
            assert unauth_span.status.status_code is StatusCode.UNSET

            assert boom_span.attributes is not None
            assert boom_span.attributes["rpc.grpc.status_code"] == grpc.StatusCode.UNKNOWN.value[0]
            assert boom_span.status.status_code is StatusCode.ERROR
            assert boom_span.status.description == "servicer exploded"
            assert any(ev.name == "exception" for ev in boom_span.events)
        finally:
            provider.shutdown()


@pytest.mark.real_graphql_schema_build
async def test_create_app_shares_single_tracer_provider_across_http_graphql_and_db_engines(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    monkeypatch.setenv(
        ENV_PHOENIX_SERVER_INSTRUMENTATION_OTLP_TRACE_COLLECTOR_HTTP_ENDPOINT,
        "http://127.0.0.1:4318",
    )
    provider, exporter = _new_tracer_provider()
    shutdown_spy = MagicMock(wraps=provider.shutdown)
    monkeypatch.setattr(provider, "shutdown", shutdown_spy)
    provider_creations = 0

    def _build_provider() -> TracerProvider:
        nonlocal provider_creations
        provider_creations += 1
        return provider

    monkeypatch.setattr(app_module, "initialize_opentelemetry_tracer_provider", _build_provider)

    factory, shutdown_callbacks = _create_db_session_factory(
        db_connection_str=f"sqlite:///{tmp_path / 'phoenix.db'}",
        read_replica_connection_str=None,
        migrate=True,
        log_to_stdout=False,
        log_migrations=False,
    )
    assert len(factory.engines) == 2

    async with contextlib.AsyncExitStack() as stack:
        await stack.enter_async_context(patch_dml_event_handler())
        await stack.enter_async_context(patch_grpc_server())
        app = create_app(
            db=factory,
            authentication_enabled=False,
            serve_ui=False,
            bulk_inserter_factory=TestBulkInserter,
            shutdown_callbacks=shutdown_callbacks,
        )
        assert provider_creations == 1
        for engine in factory.engines:
            assert len(engine.sync_engine.dispatch.before_cursor_execute) == 1

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
    for engine in factory.engines:
        assert len(engine.sync_engine.dispatch.before_cursor_execute) == 0
