import pytest
import strawberry
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.resource import ResourceAttributes

from phoenix.server.telemetry import (
    _server_resource,
    graphql_tracing_extension,
    normalize_http_log_collector_endpoint,
    normalize_http_trace_collector_endpoint,
)
from phoenix.version import __version__


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
    assert attributes[ResourceAttributes.SERVICE_NAME] == "arize-phoenix-server"
    assert attributes[ResourceAttributes.SERVICE_VERSION] == __version__


class TestGraphQLTracingExtension:
    @strawberry.input
    class CreateUserInput:
        email: str
        password: str

    @strawberry.type
    class Query:
        @strawberry.field
        def spans(self, filter_condition: str) -> str:
            return filter_condition

    @strawberry.type
    class Mutation:
        @strawberry.mutation
        def create_user(self, input: "TestGraphQLTracingExtension.CreateUserInput") -> str:
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
            extensions=[graphql_tracing_extension(tracer_provider)],
        )

    async def test_sensitive_resolver_arguments_are_redacted(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        document = "mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) }"
        variables = {"input": {"email": "alice@example.com", "password": "hunter2"}}

        result = await schema.execute(document, variable_values=variables)

        assert result.errors is None
        spans = {span.name: dict(span.attributes or {}) for span in exporter.get_finished_spans()}
        assert spans["GraphQL Resolving: createUser"] == {
            "component": "graphql",
            "graphql.parentType": "Mutation",
            "graphql.path": "createUser",
            "graphql.param.input": "[redacted]",
        }
        assert spans["GraphQL Query: CreateUser"]["query"] == document
        for attributes in spans.values():
            assert "alice@example.com" not in str(attributes)
            assert "hunter2" not in str(attributes)

    async def test_other_resolver_arguments_are_recorded(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute(
            'mutation CreateProject { createProject(name: "demo") }',
        )
        assert result.errors is None
        result = await schema.execute(
            "query Spans { spans(filterCondition: \"span_kind == 'LLM'\") }",
        )
        assert result.errors is None

        spans = {span.name: dict(span.attributes or {}) for span in exporter.get_finished_spans()}
        assert spans["GraphQL Resolving: createProject"]["graphql.param.name"] == "demo"
        assert spans["GraphQL Resolving: spans"]["graphql.param.filterCondition"] == (
            "span_kind == 'LLM'"
        )
