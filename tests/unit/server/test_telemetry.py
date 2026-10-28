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
        def user(self, email: str) -> str:
            return email

    @strawberry.type
    class Mutation:
        @strawberry.mutation
        def create_user(self, input: "TestGraphQLTracingExtension.CreateUserInput") -> str:
            return input.email

    async def test_spans_carry_no_document_or_arguments(self) -> None:
        exporter = InMemorySpanExporter()
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        schema = strawberry.Schema(
            query=self.Query,
            mutation=self.Mutation,
            extensions=[graphql_tracing_extension(tracer_provider)],
        )
        document = """
            mutation CreateUser($input: CreateUserInput!) { createUser(input: $input) }
        """
        variables = {"input": {"email": "alice@example.com", "password": "hunter2"}}

        result = await schema.execute(document, variable_values=variables)

        assert result.errors is None
        spans = exporter.get_finished_spans()
        assert {span.name for span in spans} >= {
            "GraphQL Query: CreateUser",
            "GraphQL Resolving: createUser",
        }
        for span in spans:
            attributes = dict(span.attributes or {})
            assert "query" not in attributes
            assert not any(key.startswith("graphql.param.") for key in attributes)
            assert "alice@example.com" not in str(attributes)
            assert "hunter2" not in str(attributes)
        (resolver_span,) = [span for span in spans if span.name == "GraphQL Resolving: createUser"]
        assert dict(resolver_span.attributes or {}) == {
            "component": "graphql",
            "graphql.parentType": "Mutation",
            "graphql.path": "createUser",
        }

    async def test_anonymous_operation_is_named_after_parsing(self) -> None:
        exporter = InMemorySpanExporter()
        tracer_provider = TracerProvider()
        tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
        schema = strawberry.Schema(
            query=self.Query, extensions=[graphql_tracing_extension(tracer_provider)]
        )

        result = await schema.execute('query LookUp { user(email: "a@b.c") }')

        assert result.errors is None
        names = {span.name for span in exporter.get_finished_spans()}
        assert "GraphQL Query: LookUp" in names
