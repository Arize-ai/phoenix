from __future__ import annotations

import json
from typing import cast

import pytest
import strawberry
from openinference.semconv.trace import (
    OpenInferenceSpanKindValues,
    SpanAttributes,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.function import AgentInfo, FunctionModel

from phoenix.server.agents.graphql import build_server_agent
from phoenix.server.agents.graphql.types import ServerAgentDependencies
from phoenix.server.api.context import Context


@strawberry.type
class _Query:
    @strawberry.field
    def hello(self) -> str:
        return "world"

    @strawberry.field
    def boom(self) -> str:
        raise RuntimeError("kaboom")


@pytest.fixture
def in_memory_span_exporter() -> InMemorySpanExporter:
    return InMemorySpanExporter()


@pytest.fixture
def tracer_provider(in_memory_span_exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))
    return provider


def _call_graphql_then_finish(
    messages: list[ModelMessage], info: AgentInfo
) -> ModelResponse:
    """Drive one ``run_graphql_query`` tool call, then return a final answer."""
    already_queried = any(
        isinstance(part, ToolReturnPart)
        for message in messages
        if isinstance(message, ModelRequest)
        for part in message.parts
    )
    if already_queried:
        return ModelResponse(parts=[TextPart(content="hello is world")])
    return ModelResponse(
        parts=[
            ToolCallPart(
                tool_name="run_graphql_query",
                args={"query": "{ hello }"},
                tool_call_id="call_1",
            )
        ]
    )


async def test_build_server_agent_emits_tool_span_for_graphql_query(
    in_memory_span_exporter: InMemorySpanExporter,
    tracer_provider: TracerProvider,
) -> None:
    """The server agent's ``run_graphql_query`` tool must surface as a TOOL span.

    Regression guard for instrumentation: previously the agent's GraphQL calls
    were invisible (only its LLM spans surfaced), so a delegated server-agent
    answer showed no record of the queries that produced it.
    """
    schema = strawberry.Schema(query=_Query)

    def build_context(**_: object) -> Context:
        # ``{ hello }`` resolves without touching the context, so a sentinel is fine.
        return cast(Context, None)

    agent = build_server_agent(
        model=FunctionModel(_call_graphql_then_finish),
        schema=schema,
        build_context=build_context,
        request=None,
        tracer_provider=tracer_provider,
    )

    result = await agent.run("What is hello?", deps=ServerAgentDependencies())
    assert result.output == "hello is world"

    spans = in_memory_span_exporter.get_finished_spans()
    tool_spans = [
        span
        for span in spans
        if (span.attributes or {}).get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
        == OpenInferenceSpanKindValues.TOOL.value
    ]
    assert len(tool_spans) == 1
    (tool_span,) = tool_spans
    assert tool_span.name == "run_graphql_query"

    attributes = dict(tool_span.attributes or {})
    assert attributes[SpanAttributes.TOOL_NAME] == "run_graphql_query"

    input_value = attributes[SpanAttributes.INPUT_VALUE]
    assert isinstance(input_value, str)
    assert json.loads(input_value)["query"] == "{ hello }"

    output_value = attributes[SpanAttributes.OUTPUT_VALUE]
    assert isinstance(output_value, str)
    assert json.loads(output_value) == {"data": {"hello": "world"}}
    assert tool_span.status.status_code == StatusCode.OK


def _call_failing_query_then_finish(
    messages: list[ModelMessage], info: AgentInfo
) -> ModelResponse:
    """Drive one failing ``run_graphql_query`` call, then give up after the retry."""
    retried = any(
        isinstance(part, RetryPromptPart)
        for message in messages
        if isinstance(message, ModelRequest)
        for part in message.parts
    )
    if retried:
        return ModelResponse(parts=[TextPart(content="could not fetch")])
    return ModelResponse(
        parts=[
            ToolCallPart(
                tool_name="run_graphql_query",
                args={"query": "{ boom }"},
                tool_call_id="call_err",
            )
        ]
    )


async def test_build_server_agent_records_error_on_tool_span_when_query_fails(
    in_memory_span_exporter: InMemorySpanExporter,
    tracer_provider: TracerProvider,
) -> None:
    """A GraphQL query that errors must surface as an ERROR TOOL span.

    The tool raises ``ModelRetry`` on GraphQL errors rather than returning them,
    so the failure is recorded on the span (ERROR status + exception event) and
    is still handed back to the model as a retry prompt.
    """
    schema = strawberry.Schema(query=_Query)

    def build_context(**_: object) -> Context:
        return cast(Context, None)

    agent = build_server_agent(
        model=FunctionModel(_call_failing_query_then_finish),
        schema=schema,
        build_context=build_context,
        request=None,
        tracer_provider=tracer_provider,
    )

    # The model retries once, then returns text — the run completes normally.
    result = await agent.run("What is boom?", deps=ServerAgentDependencies())
    assert result.output == "could not fetch"

    spans = in_memory_span_exporter.get_finished_spans()
    tool_spans = [
        span
        for span in spans
        if (span.attributes or {}).get(SpanAttributes.OPENINFERENCE_SPAN_KIND)
        == OpenInferenceSpanKindValues.TOOL.value
    ]
    assert len(tool_spans) == 1
    (tool_span,) = tool_spans
    assert tool_span.name == "run_graphql_query"
    assert tool_span.status.status_code == StatusCode.ERROR

    (exception_event,) = tool_span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes["exception.type"] == "pydantic_ai.exceptions.ModelRetry"
    # The raised message carries the formatted GraphQL errors back to the model.
    assert "errors" in str(exception_attributes["exception.message"])

    # No success output was recorded on the errored span.
    assert SpanAttributes.OUTPUT_VALUE not in (tool_span.attributes or {})
