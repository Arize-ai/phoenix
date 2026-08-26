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
"""Record fixed tool-agent fixtures through LangChain callbacks."""

from __future__ import annotations

import argparse
import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import BaseTool, StructuredTool
from langchain_openai import ChatOpenAI
from openinference.instrumentation import get_attributes_from_context, using_session
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.fake_tools import LocalTools, ToolError, local_tools
    from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
    )
else:
    from fake_tools import LocalTools, ToolError, local_tools
    from mock_openai_provider import ScriptedOpenAIProvider
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
    )

MAX_TOOL_CALLS = 3


class OpenInferenceContextSpanProcessor(SpanProcessor):
    """Apply the active session to spans started by LangChain callbacks."""

    def on_start(self, span: Span, parent_context: Any = None) -> None:
        span.set_attributes(dict(get_attributes_from_context()))

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass


class ToolAgentRecorder:
    def __init__(
        self,
        model: ChatOpenAI,
        tools: LocalTools,
        exporter: SpanCaptureExporter,
    ) -> None:
        self._model = model
        self._tools = tools
        self._exporter = exporter

    def record(self, fixture: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        prompt = fixture.inputs.get("prompt")
        if not isinstance(prompt, str):
            raise ValueError(f"fixture {fixture.fragment_id!r} has no tool-agent prompt")
        tools = _bound_tools(self._tools)
        model = self._model.bind_tools(tools)
        checkpoint = self._exporter.checkpoint()

        def run_agent(inputs: Mapping[str, Any]) -> list[BaseMessage]:
            messages: list[BaseMessage] = list(cast(Sequence[BaseMessage], inputs["messages"]))
            for _ in range(MAX_TOOL_CALLS + 1):
                reply = model.invoke(messages)
                messages.append(reply)
                if not reply.tool_calls:
                    return messages
                for call in reply.tool_calls:
                    tool = _tool_by_name(tools, call["name"])
                    try:
                        result = tool.invoke(call["args"])
                    except ToolError as error:
                        messages.append(
                            ToolMessage(
                                content=json.dumps({"error": str(error)}),
                                tool_call_id=call["id"],
                                name=call["name"],
                                status="error",
                            )
                        )
                    else:
                        messages.append(
                            ToolMessage(
                                content=json.dumps(result, sort_keys=True, separators=(",", ":")),
                                tool_call_id=call["id"],
                                name=call["name"],
                            )
                        )
            raise RuntimeError(f"fixture {fixture.fragment_id!r} exceeded its tool-call limit")

        agent = RunnableLambda(run_agent).with_config({"run_name": "datagen_tool_agent"})
        try:
            with using_session(fixture.fragment_id):
                result = agent.invoke({"messages": [{"role": "user", "content": prompt}]})
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        if not result or not isinstance(result[-1], AIMessage) or not result[-1].content:
            raise RuntimeError(f"fixture {fixture.fragment_id!r} did not finish with an answer")
        return trace_ids(spans)


def _bound_tools(tools: LocalTools) -> tuple[StructuredTool, ...]:
    result = []
    for schema in tools.schemas:
        function = cast(Mapping[str, Any], schema["function"])
        name = cast(str, function["name"])

        def invoke(_name: str = name, **arguments: Any) -> Mapping[str, Any]:
            return tools.invoke(_name, arguments)

        result.append(
            StructuredTool.from_function(
                func=invoke,
                name=name,
                description=cast(str, function["description"]),
                args_schema=dict(cast(Mapping[str, Any], function["parameters"])),
                infer_schema=False,
            )
        )
    return tuple(result)


def _tool_by_name(tools: Sequence[BaseTool], name: str) -> BaseTool:
    try:
        return next(tool for tool in tools if tool.name == name)
    except StopIteration as error:
        raise RuntimeError(f"scripted model requested unknown tool {name!r}") from error


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected tool-agent fixture into a corpus directory."""
    reset_recording(output_dir)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "datagen.tool_agent"}))
    provider.add_span_processor(OpenInferenceContextSpanProcessor())
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    fragments = []
    try:
        for fixture in fixtures_for("tool_agent", fixtures=fixtures):
            scripted = ScriptedOpenAIProvider(_responses_for(fixture))
            model = ChatOpenAI(
                model="datagen-scripted",
                api_key="datagen-dummy-key",
                base_url="https://datagen.test/v1",
                http_client=scripted.http_client(),
                max_retries=0,
                temperature=0,
            )
            recorder = ToolAgentRecorder(model, local_tools(fixture.domain), exporter)
            fragments.append(record_fixture(fixture, output_dir, recorder.record))
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    return tuple(fragments)


def _responses_for(fixture: RecorderFixture) -> tuple[dict[str, Any], ...]:
    prompt = str(fixture.inputs.get("prompt", ""))
    if "calculate" in prompt:
        expression = "42.25 * 2" if "42.25" in prompt else "125000 - 8500"
        calls = (
            {"name": "document_search", "arguments": {"query": prompt, "limit": 1}},
            {"name": "safe_arithmetic", "arguments": {"expression": expression}},
        )
    elif fixture.domain == "coding_agent":
        identifier = "issue-204" if "issue-204" in prompt else "issue-219"
        calls = (
            {"name": "document_search", "arguments": {"query": prompt, "limit": 1}},
            {"name": "record_lookup", "arguments": {"record_id": identifier}},
        )
    else:
        identifier = next(
            value for value in ("order-1001", "warehouse-east") if value in prompt
        )
        calls = (
            {"name": "record_lookup", "arguments": {"record_id": identifier}},
            {"name": "status_lookup", "arguments": {"status_id": identifier}},
        )
    return tuple({"tool_call": call} for call in calls) + (
        {"content": "The local records and policy data support the requested next step."},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    fragments = record(args.output_dir)
    print(f"Recorded {len(fragments)} tool-agent fragments in {args.output_dir}")


if __name__ == "__main__":
    main()
