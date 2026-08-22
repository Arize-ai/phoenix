#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
#   "langchain-core==1.5.6",
#   "langchain-openai==1.5.1",
#   "openai==3.2.0",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-langchain==0.1.70",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record variable-depth tool-agent turns as OTLP protobuf JSON lines."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Mapping, Sequence
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Any, cast

from google.protobuf.json_format import MessageToJson
from langchain_core.messages import AIMessage, BaseMessage, ToolMessage, convert_to_messages
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import BaseTool, StructuredTool
from langchain_openai import ChatOpenAI
from openinference.instrumentation import get_attributes_from_context, using_session
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)

if TYPE_CHECKING or __package__:
    from scripts.datagen.fake_tools import (
        DEFAULT_REGISTRY,
        MAX_TOOL_LOOP_STEPS,
        InjectedToolFailure,
        InvocationLedger,
        ToolContext,
        load_default_fixture_sets,
    )
    from scripts.datagen.generation import GenerationError
    from scripts.datagen.self_play import (
        AssistantRequest,
        RecordedAssistantTurn,
        TokenUsage,
        ToolInvoker,
    )
else:
    from fake_tools import (
        DEFAULT_REGISTRY,
        MAX_TOOL_LOOP_STEPS,
        InjectedToolFailure,
        InvocationLedger,
        ToolContext,
        load_default_fixture_sets,
    )
    from generation import GenerationError
    from self_play import AssistantRequest, RecordedAssistantTurn, TokenUsage, ToolInvoker

SCENARIO_NAME = "tool_agent"


class ToolAgentError(GenerationError):
    """Raised when a tool-agent turn cannot complete within its contract."""


class SpanCaptureExporter(SpanExporter):
    """Retain completed spans until a recorder persists one turn."""

    def __init__(self) -> None:
        self._spans: list[ReadableSpan] = []
        self._lock = Lock()

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        with self._lock:
            self._spans.extend(spans)
        return SpanExportResult.SUCCESS

    def checkpoint(self) -> int:
        with self._lock:
            return len(self._spans)

    def spans_since(self, checkpoint: int) -> tuple[ReadableSpan, ...]:
        with self._lock:
            return tuple(self._spans[checkpoint:])


class OpenInferenceContextSpanProcessor(SpanProcessor):
    """Copy ambient OpenInference attributes onto callback-created spans."""

    def on_start(self, span: Span, parent_context: Any = None) -> None:
        span.set_attributes(dict(get_attributes_from_context()))

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass


class ToolAgentRecorder:
    """Record ReAct-style assistant turns through LangChain callbacks."""

    def __init__(self, model: ChatOpenAI, exporter: SpanCaptureExporter) -> None:
        self._model = model
        self._exporter = exporter

    def record(
        self,
        request: AssistantRequest,
        invoke_tool: ToolInvoker,
    ) -> RecordedAssistantTurn:
        tools = _bound_tools(request.tools, invoke_tool)
        model = self._model.bind_tools(tools)
        checkpoint = self._exporter.checkpoint()
        usage = TokenUsage()

        def run_tool_agent(inputs: Mapping[str, Any]) -> tuple[list[BaseMessage], TokenUsage]:
            messages = list(convert_to_messages(cast(Any, inputs["messages"])))
            turn_messages: list[BaseMessage] = []
            turn_usage = TokenUsage()
            tool_calls = 0
            while True:
                reply = model.invoke(messages)
                turn_usage += _token_usage(reply)
                turn_messages.append(reply)
                if not reply.tool_calls:
                    return turn_messages, turn_usage
                if tool_calls + len(reply.tool_calls) > MAX_TOOL_LOOP_STEPS:
                    raise ToolAgentError(
                        f"assistant requested more than {MAX_TOOL_LOOP_STEPS} tool calls"
                    )
                messages.append(reply)
                for call in reply.tool_calls:
                    tool = _tool_by_name(tools, call["name"])
                    try:
                        result = tool.invoke(call["args"])
                    except InjectedToolFailure as error:
                        message = ToolMessage(
                            content=_canonical_json(
                                {"error": type(error).__name__, "message": str(error)}
                            ),
                            tool_call_id=call["id"],
                            name=call["name"],
                            status="error",
                        )
                    else:
                        message = ToolMessage(
                            content=_canonical_json(result),
                            tool_call_id=call["id"],
                            name=call["name"],
                        )
                    tool_calls += 1
                    messages.append(message)
                    turn_messages.append(message)

        agent = RunnableLambda(run_tool_agent).with_config({"run_name": "datagen_tool_agent"})
        try:
            with using_session(request.cell_id):
                turn_messages, usage = agent.invoke({"messages": list(request.messages)})
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                _append_spans(request.traces_path, spans)

        serialized = tuple(_message_dict(message) for message in turn_messages)
        if not serialized or serialized[-1].get("role") != "assistant":
            raise ToolAgentError("tool-agent turn did not finish with an assistant response")
        content = serialized[-1].get("content")
        if not isinstance(content, str) or not content.strip():
            raise ToolAgentError("tool-agent turn finished without assistant content")
        return RecordedAssistantTurn(
            messages=serialized,
            trace_ids=_trace_ids(spans),
            usage=usage,
        )


def _bound_tools(
    schemas: Sequence[Mapping[str, Any]], invoke_tool: ToolInvoker
) -> tuple[StructuredTool, ...]:
    tools = []
    for schema in schemas:
        function = schema.get("function")
        if not isinstance(function, Mapping):
            raise ToolAgentError("tool schema must contain a function object")
        name = function.get("name")
        description = function.get("description")
        parameters = function.get("parameters")
        if (
            not isinstance(name, str)
            or not name
            or not isinstance(description, str)
            or not isinstance(parameters, Mapping)
        ):
            raise ToolAgentError("tool schema has invalid function metadata")

        def call_tool(_name: str = name, **arguments: Any) -> Mapping[str, Any]:
            return invoke_tool(_name, arguments)

        tools.append(
            StructuredTool.from_function(
                func=call_tool,
                name=name,
                description=description,
                args_schema=dict(parameters),
                infer_schema=False,
            )
        )
    if not tools:
        raise ToolAgentError("tool-agent recorder requires at least one bound tool")
    return tuple(tools)


def _tool_by_name(tools: Sequence[BaseTool], name: str) -> BaseTool:
    try:
        return next(tool for tool in tools if tool.name == name)
    except StopIteration as error:
        raise ToolAgentError(f"assistant requested unknown tool {name!r}") from error


def _token_usage(message: AIMessage) -> TokenUsage:
    metadata: Mapping[str, Any] = message.usage_metadata or {}
    input_details = metadata.get("input_token_details") or {}
    return TokenUsage(
        input_tokens=int(metadata.get("input_tokens", 0)),
        cached_input_tokens=int(input_details.get("cache_read", 0)),
        output_tokens=int(metadata.get("output_tokens", 0)),
    )


def _message_dict(message: BaseMessage) -> Mapping[str, Any]:
    if isinstance(message, AIMessage):
        value: dict[str, Any] = {"role": "assistant", "content": message.content}
        if message.tool_calls:
            value["tool_calls"] = [
                {
                    "id": call["id"],
                    "type": "function",
                    "function": {
                        "name": call["name"],
                        "arguments": _canonical_json(call["args"]),
                    },
                }
                for call in message.tool_calls
            ]
        return value
    if isinstance(message, ToolMessage):
        value = {
            "role": "tool",
            "content": message.content,
            "tool_call_id": message.tool_call_id,
            "name": message.name,
        }
        if message.status == "error":
            value["status"] = "error"
        return value
    raise ToolAgentError(f"unexpected agent message type {type(message).__name__}")


def _trace_ids(spans: Sequence[ReadableSpan]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans))


def _append_spans(path: Path, spans: Sequence[ReadableSpan]) -> None:
    payload = json.loads(MessageToJson(encode_spans(spans), indent=None))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, separators=(",", ":")) + "\n")


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--fixture-set", default="retail")
    parser.add_argument("--pass-seed", type=int, default=0)
    parser.add_argument("--cell-id", required=True)
    parser.add_argument(
        "--base-url", default=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8765/v1")
    )
    args = parser.parse_args()

    fixture_sets = load_default_fixture_sets()
    try:
        fixture_set = fixture_sets[args.fixture_set]
    except KeyError as error:
        raise ToolAgentError(f"unknown fixture set {args.fixture_set!r}") from error
    if len(args.cell_id) != 64 or any(
        character not in "0123456789abcdef" for character in args.cell_id
    ):
        raise ToolAgentError("cell-id must be a 64-character lowercase hexadecimal string")

    provider = TracerProvider(
        resource=Resource.create({"service.name": f"datagen.{SCENARIO_NAME}"})
    )
    exporter = SpanCaptureExporter()
    provider.add_span_processor(OpenInferenceContextSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    try:
        model = ChatOpenAI(
            model="gpt-4.1-mini",
            base_url=args.base_url,
            api_key=os.getenv("OPENAI_API_KEY", "datagen-dummy-key"),
            temperature=0,
        )
        recorder = ToolAgentRecorder(model, exporter)
        ledger = InvocationLedger(args.output_dir / "tool-invocations.jsonl")
        call_count = 0

        def invoke_tool(name: str, arguments: Mapping[str, Any]) -> Mapping[str, Any]:
            nonlocal call_count
            call_count += 1
            return DEFAULT_REGISTRY.invoke(
                name,
                arguments,
                ToolContext(
                    pass_seed=args.pass_seed,
                    cell_id=args.cell_id,
                    fixture_set=fixture_set,
                    call_ordinal=call_count,
                ),
                ledger,
            )

        recorded = recorder.record(
            AssistantRequest(
                cell_id=args.cell_id,
                attempt_id=f"{args.cell_id}:generation:1",
                turn_index=0,
                model="gpt-4.1-mini",
                messages=({"role": "user", "content": args.prompt},),
                tools=tuple(DEFAULT_REGISTRY.model_schemas()),
                traces_path=args.output_dir / "traces.jsonl",
            ),
            invoke_tool,
        )
        (args.output_dir / "messages.json").write_text(
            json.dumps(recorded.messages, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    finally:
        instrumentor.uninstrument()
        provider.shutdown()


if __name__ == "__main__":
    main()
