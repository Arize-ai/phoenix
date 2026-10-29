from typing import Any, Optional

import pytest
import strawberry
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.semconv.resource import ResourceAttributes

from phoenix.server.api.redaction import Redacted
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

        @strawberry.mutation
        def create_span_annotations(self, input: list[str]) -> str:
            return ",".join(input)

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
        assert spans["GraphQL Query: CreateUser"]["query"] == document
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

    async def test_content_resolver_arguments_are_blanked_whole(
        self, schema: strawberry.Schema, exporter: InMemorySpanExporter
    ) -> None:
        result = await schema.execute(
            'mutation Annotate { createSpanAnnotations(input: ["looks wrong to me"]) }'
        )
        assert result.errors is None
        spans = self._spans(exporter)
        assert spans["GraphQL Resolving: createSpanAnnotations"]["graphql.param.input"] == (
            "[redacted]"
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
