from __future__ import annotations

import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from openinference.instrumentation import OITracer, TraceConfig
from openinference.semconv.trace import (
    OpenInferenceMimeTypeValues,
    OpenInferenceSpanKindValues,
    SpanAttributes,
    ToolCallAttributes,
)
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.trace import StatusCode, Tracer
from pydantic_ai import Agent
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import ModelRequestParameters, StreamedResponse
from pydantic_ai.models.test import TestModel
from pydantic_ai.models.wrapper import WrapperModel
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import ToolDefinition

from phoenix.server.agents.capabilities import get_external_tool_definition
from phoenix.server.agents.pydantic_ai import (
    OpenInferenceAgentWrapper,
    OpenInferenceModelWrapper,
)


def _require_tool_definition(name: str) -> ToolDefinition:
    tool_def = get_external_tool_definition(name)
    assert tool_def is not None, f"missing external tool definition: {name!r}"
    return tool_def


ASK_USER_TOOL_DEFINITION = _require_tool_definition("ask_user")
BASH_TOOL_DEFINITION = _require_tool_definition("bash")
SET_TIME_RANGE_TOOL_DEFINITION = _require_tool_definition("set_time_range")


@pytest.fixture
def in_memory_span_exporter() -> InMemorySpanExporter:
    return InMemorySpanExporter()


@pytest.fixture
def tracer_provider(in_memory_span_exporter: InMemorySpanExporter) -> TracerProvider:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(in_memory_span_exporter))
    return provider


@pytest.fixture
def tracer(tracer_provider: TracerProvider) -> OITracer:
    return OITracer(tracer_provider.get_tracer("test"), config=TraceConfig())


@pytest.fixture
def wrapped_model(tracer: Tracer) -> OpenInferenceModelWrapper:
    inner = TestModel(custom_output_text=MODEL_OUTPUT_TEXT)
    return OpenInferenceModelWrapper(inner, tracer=tracer)


@pytest.fixture
def wrapped_agent(
    wrapped_model: OpenInferenceModelWrapper,
    tracer: Tracer,
) -> OpenInferenceAgentWrapper:
    inner: Agent[None, str] = Agent(
        wrapped_model,
        name="TestAgent",
        deps_type=type(None),
    )
    return OpenInferenceAgentWrapper(inner, tracer=tracer)


@pytest.fixture
def raising_model() -> WrapperModel:
    """A model that always raises on request, used to exercise the wrapper's
    exception-handling path without hitting the network."""

    class _RaisingWrapperModel(WrapperModel):
        async def request(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
        ) -> ModelResponse:
            raise RuntimeError("boom from raising model")

        @asynccontextmanager
        async def request_stream(
            self,
            messages: list[ModelMessage],
            model_settings: ModelSettings | None,
            model_request_parameters: ModelRequestParameters,
            run_context: Any = None,
        ) -> AsyncIterator[StreamedResponse]:
            raise RuntimeError("boom from raising model")
            yield  # pragma: no cover

    return _RaisingWrapperModel(TestModel())


@pytest.fixture
def raising_agent(
    raising_model: WrapperModel,
    tracer: Tracer,
) -> OpenInferenceAgentWrapper:
    """An OpenInferenceAgentWrapper whose underlying model always raises."""
    inner: Agent[None, str] = Agent(raising_model, deps_type=type(None))
    return OpenInferenceAgentWrapper(inner, tracer=tracer)


@pytest.fixture
def test_model_agent(
    tracer: Tracer,
) -> OpenInferenceAgentWrapper:
    """An OpenInferenceAgentWrapper backed by TestModel — no network, no VCR.

    Used by tests that exercise behavior triggered by the inbound history
    (e.g. external tool span backfill) and don't care about model output.
    """
    inner: Agent[None, str] = Agent(TestModel(), deps_type=type(None))
    return OpenInferenceAgentWrapper(inner, tracer=tracer)


def _get_agent_span(spans: tuple[ReadableSpan, ...]) -> ReadableSpan:
    matches = [
        span for span in spans if (span.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == AGENT
    ]
    assert len(matches) == 1, f"expected 1 AGENT span, got {len(matches)}"
    return matches[0]


def _get_llm_spans(spans: tuple[ReadableSpan, ...]) -> list[ReadableSpan]:
    return [s for s in spans if (s.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == LLM]


def _get_tool_spans(spans: tuple[ReadableSpan, ...]) -> list[ReadableSpan]:
    return [s for s in spans if (s.attributes or {}).get(OPENINFERENCE_SPAN_KIND) == TOOL]


async def test_iter_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "The capital of France is Paris."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    async with wrapped_agent.iter(
        user_prompt,
        model_settings=model_settings,
    ) as agent_run:
        async for _ in agent_run:
            pass
    assert agent_run.result is not None
    assert agent_run.result.output == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_run_emits_agent_span_for_text_response(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "The quick brown fox jumps over the lazy dog."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    result = await wrapped_agent.run(
        user_prompt,
        model_settings=model_settings,
    )

    assert result.output == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_run_stream_emits_agent_span(
    wrapped_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    user_prompt = "Streaming spans across multiple deltas."
    model_settings = ModelSettings(temperature=0.0, max_tokens=32)

    async with wrapped_agent.run_stream(
        user_prompt,
        model_settings=model_settings,
    ) as stream:
        chunks: list[str] = []
        async for chunk in stream.stream_text(delta=True):
            chunks.append(chunk)
        final_output = await stream.get_output()

    assert final_output == MODEL_OUTPUT_TEXT
    assert "".join(chunks) == MODEL_OUTPUT_TEXT

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.name == "TestAgent.iter"
    assert agent_span.status.status_code == StatusCode.OK

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == user_prompt
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    assert attributes.pop(OUTPUT_VALUE) == MODEL_OUTPUT_TEXT
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata["input"]["user_prompt"] == user_prompt
    assert metadata["input"]["model_settings"] == dict(model_settings)
    assert metadata["output"] == MODEL_OUTPUT_TEXT

    assert not attributes

    llm_spans = _get_llm_spans(spans)
    assert len(llm_spans) == 1
    llm_span = llm_spans[0]
    assert llm_span.parent is not None
    assert llm_span.parent.span_id == agent_span.context.span_id


async def test_iter_records_exception_when_run_fails(
    raising_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    with pytest.raises(RuntimeError, match="boom from raising model"):
        async with raising_agent.iter("anything") as agent_run:
            async for _ in agent_run:
                pass

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    assert agent_span.status.status_code == StatusCode.ERROR
    assert agent_span.status.description == "RuntimeError: boom from raising model"

    assert len(agent_span.events) == 1
    (exception_event,) = agent_span.events
    assert exception_event.name == "exception"
    exception_attributes = dict(exception_event.attributes or {})
    assert exception_attributes.pop("exception.type") == "RuntimeError"
    assert exception_attributes.pop("exception.message") == "boom from raising model"
    assert isinstance(exception_attributes.pop("exception.stacktrace"), str)
    assert exception_attributes.pop("exception.escaped") == "False"
    assert not exception_attributes

    attributes = dict(agent_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == AGENT

    assert attributes.pop(INPUT_VALUE) == "anything"
    assert attributes.pop(INPUT_MIME_TYPE) == TEXT

    metadata_value = attributes.pop(METADATA)
    assert isinstance(metadata_value, str)
    metadata = json.loads(metadata_value)
    assert metadata == {"input": {"user_prompt": "anything", "message_history": None}}

    assert not attributes


async def test_backfills_tool_span_for_trailing_external_tool_return(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    tool_name = BASH_TOOL_DEFINITION.name
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="run tool")]),
        ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name=tool_name,
                    args={"command": "ls"},
                    tool_call_id="call-1",
                )
            ]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(
                    tool_name=tool_name,
                    content="file1\nfile2",
                    tool_call_id="call-1",
                )
            ]
        ),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.name == tool_name
    assert tool_span.parent is not None
    assert tool_span.parent.span_id == agent_span.context.span_id
    assert tool_span.context.trace_id == agent_span.context.trace_id
    assert tool_span.status.status_code == StatusCode.OK

    attributes = dict(tool_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == tool_name
    assert attributes.pop(TOOL_CALL_ID) == "call-1"
    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"command": "ls"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON
    assert attributes.pop(OUTPUT_VALUE) == "file1\nfile2"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
    assert attributes.pop(TOOL_DESCRIPTION) == BASH_TOOL_DEFINITION.description
    tool_parameters = attributes.pop(TOOL_PARAMETERS)
    assert isinstance(tool_parameters, str)
    assert json.loads(tool_parameters) == dict(BASH_TOOL_DEFINITION.parameters_json_schema)
    assert not attributes


async def test_backfills_multiple_tool_spans_joined_by_tool_call_id(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    bash_tool = BASH_TOOL_DEFINITION.name
    ask_user_tool = ASK_USER_TOOL_DEFINITION.name
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="parallel tools")]),
        ModelResponse(
            parts=[
                ToolCallPart(tool_name=bash_tool, args={"command": "ls"}, tool_call_id="a"),
                ToolCallPart(tool_name=ask_user_tool, args={"prompt": "ok?"}, tool_call_id="b"),
            ]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(tool_name=ask_user_tool, content="yes", tool_call_id="b"),
                ToolReturnPart(tool_name=bash_tool, content="ok", tool_call_id="a"),
            ]
        ),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 2
    by_call_id = {(s.attributes or {})[TOOL_CALL_ID]: s for s in tool_spans}
    assert set(by_call_id) == {"a", "b"}

    bash_span = by_call_id["a"]
    assert bash_span.name == bash_tool
    assert bash_span.parent is not None
    assert bash_span.parent.span_id == agent_span.context.span_id
    assert bash_span.context.trace_id == agent_span.context.trace_id
    assert bash_span.status.status_code == StatusCode.OK
    bash_attrs = dict(bash_span.attributes or {})
    assert bash_attrs.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert bash_attrs.pop(TOOL_NAME) == bash_tool
    assert bash_attrs.pop(TOOL_CALL_ID) == "a"
    bash_input = bash_attrs.pop(INPUT_VALUE)
    assert isinstance(bash_input, str)
    assert json.loads(bash_input) == {"command": "ls"}
    assert bash_attrs.pop(INPUT_MIME_TYPE) == JSON
    assert bash_attrs.pop(OUTPUT_VALUE) == "ok"
    assert bash_attrs.pop(OUTPUT_MIME_TYPE) == TEXT
    assert bash_attrs.pop(TOOL_DESCRIPTION) == BASH_TOOL_DEFINITION.description
    bash_params = bash_attrs.pop(TOOL_PARAMETERS)
    assert isinstance(bash_params, str)
    assert json.loads(bash_params) == dict(BASH_TOOL_DEFINITION.parameters_json_schema)
    assert not bash_attrs

    ask_user_span = by_call_id["b"]
    assert ask_user_span.name == ask_user_tool
    assert ask_user_span.parent is not None
    assert ask_user_span.parent.span_id == agent_span.context.span_id
    assert ask_user_span.context.trace_id == agent_span.context.trace_id
    assert ask_user_span.status.status_code == StatusCode.OK
    ask_user_attrs = dict(ask_user_span.attributes or {})
    assert ask_user_attrs.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert ask_user_attrs.pop(TOOL_NAME) == ask_user_tool
    assert ask_user_attrs.pop(TOOL_CALL_ID) == "b"
    ask_user_input = ask_user_attrs.pop(INPUT_VALUE)
    assert isinstance(ask_user_input, str)
    assert json.loads(ask_user_input) == {"prompt": "ok?"}
    assert ask_user_attrs.pop(INPUT_MIME_TYPE) == JSON
    assert ask_user_attrs.pop(OUTPUT_VALUE) == "yes"
    assert ask_user_attrs.pop(OUTPUT_MIME_TYPE) == TEXT
    assert ask_user_attrs.pop(TOOL_DESCRIPTION) == ASK_USER_TOOL_DEFINITION.description
    ask_user_params = ask_user_attrs.pop(TOOL_PARAMETERS)
    assert isinstance(ask_user_params, str)
    assert json.loads(ask_user_params) == dict(ASK_USER_TOOL_DEFINITION.parameters_json_schema)
    assert not ask_user_attrs


async def test_does_not_emit_tool_spans_for_history_ending_in_user_prompt(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="hi")]),
        ModelResponse(parts=[TextPart(content="hello")]),
        ModelRequest(parts=[UserPromptPart(content="another question")]),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    assert _get_tool_spans(spans) == []


async def test_emits_tool_span_for_tool_return_in_mixed_trailing_request(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    """A trailing ``ModelRequest`` may carry a ``ToolReturnPart`` alongside a
    ``UserPromptPart`` when the user submits a new turn in the same request
    that delivers the external tool's result. The tool return still gets a
    backfilled TOOL span."""
    tool_name = BASH_TOOL_DEFINITION.name
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="run tool")]),
        ModelResponse(
            parts=[ToolCallPart(tool_name=tool_name, args={"command": "ls"}, tool_call_id="call-1")]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(tool_name=tool_name, content="ok", tool_call_id="call-1"),
                UserPromptPart(content="also tell me about it"),
            ]
        ),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.name == tool_name
    assert tool_span.parent is not None
    assert tool_span.parent.span_id == agent_span.context.span_id
    assert tool_span.context.trace_id == agent_span.context.trace_id
    assert tool_span.status.status_code == StatusCode.OK

    attributes = dict(tool_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == tool_name
    assert attributes.pop(TOOL_CALL_ID) == "call-1"
    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"command": "ls"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON
    assert attributes.pop(OUTPUT_VALUE) == "ok"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
    assert attributes.pop(TOOL_DESCRIPTION) == BASH_TOOL_DEFINITION.description
    tool_parameters = attributes.pop(TOOL_PARAMETERS)
    assert isinstance(tool_parameters, str)
    assert json.loads(tool_parameters) == dict(BASH_TOOL_DEFINITION.parameters_json_schema)
    assert not attributes


async def test_tool_span_args_come_from_prior_tool_call_part(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    """``ToolReturnPart`` has no ``args`` field; the span's ``input.value``
    must be recovered by joining on ``tool_call_id`` with the preceding
    ``ModelResponse``'s ``ToolCallPart``."""
    tool_name = SET_TIME_RANGE_TOOL_DEFINITION.name
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="search")]),
        ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name=tool_name,
                    args={"start": "2026-01-01", "end": "2026-02-01"},
                    tool_call_id="t1",
                )
            ]
        ),
        ModelRequest(parts=[ToolReturnPart(tool_name=tool_name, content="set", tool_call_id="t1")]),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    agent_span = _get_agent_span(spans)
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.name == tool_name
    assert tool_span.parent is not None
    assert tool_span.parent.span_id == agent_span.context.span_id
    assert tool_span.context.trace_id == agent_span.context.trace_id
    assert tool_span.status.status_code == StatusCode.OK

    attributes = dict(tool_span.attributes or {})
    assert attributes.pop(OPENINFERENCE_SPAN_KIND) == TOOL
    assert attributes.pop(TOOL_NAME) == tool_name
    assert attributes.pop(TOOL_CALL_ID) == "t1"
    input_value = attributes.pop(INPUT_VALUE)
    assert isinstance(input_value, str)
    assert json.loads(input_value) == {"start": "2026-01-01", "end": "2026-02-01"}
    assert attributes.pop(INPUT_MIME_TYPE) == JSON
    assert attributes.pop(OUTPUT_VALUE) == "set"
    assert attributes.pop(OUTPUT_MIME_TYPE) == TEXT
    assert attributes.pop(TOOL_DESCRIPTION) == SET_TIME_RANGE_TOOL_DEFINITION.description
    tool_parameters = attributes.pop(TOOL_PARAMETERS)
    assert isinstance(tool_parameters, str)
    assert json.loads(tool_parameters) == dict(
        SET_TIME_RANGE_TOOL_DEFINITION.parameters_json_schema
    )
    assert not attributes


async def test_backfilled_tool_span_omits_schema_and_description_for_unregistered_tool(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    """When the trailing tool return's name is not registered in the
    external-tool registry, ``tool.parameters`` and ``tool.description``
    are omitted rather than set to stale or empty values."""
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="run a thing")]),
        ModelResponse(
            parts=[
                ToolCallPart(
                    tool_name="some_unregistered_tool",
                    args={"x": 1},
                    tool_call_id="call-1",
                )
            ]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(
                    tool_name="some_unregistered_tool",
                    content="ok",
                    tool_call_id="call-1",
                )
            ]
        ),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_attrs = tool_spans[0].attributes or {}
    assert TOOL_PARAMETERS not in tool_attrs
    assert TOOL_DESCRIPTION not in tool_attrs


async def test_failed_tool_return_records_exception_event(
    test_model_agent: OpenInferenceAgentWrapper,
    in_memory_span_exporter: InMemorySpanExporter,
) -> None:
    """A non-success outcome on a trailing ``ToolReturnPart`` sets ERROR
    status on the synthetic TOOL span and records an ``exception`` event
    whose message comes from the part's ``content``."""
    error_content = "command not found: bsh"
    history: list[ModelMessage] = [
        ModelRequest(parts=[UserPromptPart(content="run bsh")]),
        ModelResponse(
            parts=[ToolCallPart(tool_name="bash", args={"command": "bsh"}, tool_call_id="call-1")]
        ),
        ModelRequest(
            parts=[
                ToolReturnPart(
                    tool_name="bash",
                    content=error_content,
                    tool_call_id="call-1",
                    outcome="failed",
                )
            ]
        ),
    ]
    await test_model_agent.run("continue", message_history=history)

    spans = in_memory_span_exporter.get_finished_spans()
    tool_spans = _get_tool_spans(spans)
    assert len(tool_spans) == 1
    tool_span = tool_spans[0]
    assert tool_span.status.status_code == StatusCode.ERROR
    assert tool_span.status.description == f"tool failed: {error_content}"

    assert len(tool_span.events) == 1
    (exception_event,) = tool_span.events
    assert exception_event.name == "exception"
    event_attributes = dict(exception_event.attributes or {})
    assert event_attributes.pop("exception.type") == "Exception"
    assert event_attributes.pop("exception.message") == error_content
    assert isinstance(event_attributes.pop("exception.stacktrace"), str)
    assert event_attributes.pop("exception.escaped") == "False"
    assert not event_attributes


# OpenInference attribute keys
OPENINFERENCE_SPAN_KIND = SpanAttributes.OPENINFERENCE_SPAN_KIND
INPUT_VALUE = SpanAttributes.INPUT_VALUE
INPUT_MIME_TYPE = SpanAttributes.INPUT_MIME_TYPE
OUTPUT_VALUE = SpanAttributes.OUTPUT_VALUE
OUTPUT_MIME_TYPE = SpanAttributes.OUTPUT_MIME_TYPE
METADATA = SpanAttributes.METADATA

AGENT = OpenInferenceSpanKindValues.AGENT.value
LLM = OpenInferenceSpanKindValues.LLM.value
TOOL = OpenInferenceSpanKindValues.TOOL.value
JSON = OpenInferenceMimeTypeValues.JSON.value
TEXT = OpenInferenceMimeTypeValues.TEXT.value

TOOL_DESCRIPTION = SpanAttributes.TOOL_DESCRIPTION
TOOL_NAME = SpanAttributes.TOOL_NAME
TOOL_PARAMETERS = SpanAttributes.TOOL_PARAMETERS
TOOL_CALL_ID = ToolCallAttributes.TOOL_CALL_ID

MODEL_OUTPUT_TEXT = "Bonjour, le monde."
