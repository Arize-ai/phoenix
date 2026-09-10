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
import os
import random
from collections.abc import Mapping, Sequence
from dataclasses import replace
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, cast

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
from langchain_core.tools import BaseTool, StructuredTool
from langchain_openai import ChatOpenAI
from openinference.instrumentation import (
    OITracer,
    TraceConfig,
    get_attributes_from_context,
    using_session,
)
from openinference.instrumentation.langchain import LangChainInstrumentor
from openinference.semconv.trace import OpenInferenceMimeTypeValues, OpenInferenceSpanKindValues
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor, TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

if TYPE_CHECKING or __package__:
    from scripts.datagen.conditions import materialize_condition
    from scripts.datagen.fake_tools import LocalTools, ToolError, local_tools
    from scripts.datagen.mock_openai_provider import ScriptedOpenAIProvider
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        live_model_options,
        prepare_recording,
        record_fixture,
        resolve_live_model,
        trace_ids,
    )
else:
    from conditions import materialize_condition
    from fake_tools import LocalTools, ToolError, local_tools
    from mock_openai_provider import ScriptedOpenAIProvider
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        live_model_options,
        prepare_recording,
        record_fixture,
        resolve_live_model,
        trace_ids,
    )

MAX_TOOL_CALLS = 24
Provider = Literal["scripted", "live"]
_ROOT_SPAN_NAMES = {
    "coding_agent": "resolve_engineering_task",
    "customer_support": "handle_support_request",
    "data_analyst": "answer_analytics_request",
}


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
        tracer: OITracer,
        *,
        require_terminal_answer: bool,
    ) -> None:
        self._model = model
        self._tools = tools
        self._exporter = exporter
        self._tracer = tracer
        self._require_terminal_answer = require_terminal_answer

    def record(self, fixture: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        prompt = fixture.inputs.get("prompt")
        if not isinstance(prompt, str):
            raise ValueError(f"fixture {fixture.fragment_id!r} has no tool-agent prompt")
        tools = _bound_tools(self._tools)
        model = self._model.bind_tools(tools)
        checkpoint = self._exporter.checkpoint()

        def run_agent(inputs: Mapping[str, Any]) -> list[BaseMessage]:
            messages: list[BaseMessage] = list(cast(Sequence[BaseMessage], inputs["messages"]))
            with self._tracer.start_as_current_span(
                _ROOT_SPAN_NAMES[fixture.domain],
                openinference_span_kind=OpenInferenceSpanKindValues.AGENT,
            ) as root_span:
                root_span.set_input(prompt, mime_type=OpenInferenceMimeTypeValues.TEXT.value)
                with self._tracer.start_as_current_span(
                    "triage",
                    openinference_span_kind=OpenInferenceSpanKindValues.CHAIN,
                ):
                    reply = model.invoke(messages)
                messages.append(reply)
                if not reply.tool_calls:
                    root_span.set_output(
                        _message_text(reply),
                        mime_type=OpenInferenceMimeTypeValues.TEXT.value,
                    )
                    return messages
                with self._tracer.start_as_current_span(
                    "investigate",
                    openinference_span_kind=OpenInferenceSpanKindValues.CHAIN,
                ):
                    for _ in range(MAX_TOOL_CALLS + 1):
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
                                        content=json.dumps(
                                            result, sort_keys=True, separators=(",", ":")
                                        ),
                                        tool_call_id=call["id"],
                                        name=call["name"],
                                    )
                                )
                        reply = model.invoke(messages)
                        messages.append(reply)
                        if not reply.tool_calls:
                            root_span.set_output(
                                _message_text(reply),
                                mime_type=OpenInferenceMimeTypeValues.TEXT.value,
                            )
                            return messages
            raise RuntimeError(f"fixture {fixture.fragment_id!r} exceeded its tool-call limit")

        try:
            with using_session(fixture.fragment_id):
                result = run_agent({"messages": [{"role": "user", "content": prompt}]})
        except Exception:
            if self._require_terminal_answer:
                raise
            result = []
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        if self._require_terminal_answer and (
            not result or not isinstance(result[-1], AIMessage) or not result[-1].content
        ):
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


def _message_text(message: AIMessage) -> str:
    if isinstance(message.content, str):
        return message.content
    return "\n".join(
        str(block.get("text", "")) if isinstance(block, Mapping) else str(block)
        for block in message.content
    )


def _with_prompt_variant(fixture: RecorderFixture, rng: random.Random) -> RecorderFixture:
    """Pick one authored phrasing of the fixture's opening prompt for this run."""
    variants = fixture.inputs.get("prompt_variants")
    prompt = fixture.inputs.get("prompt")
    if not isinstance(variants, list) or not isinstance(prompt, str):
        return fixture
    phrasings = [prompt, *(v for v in variants if isinstance(v, str))]
    return replace(fixture, inputs={**fixture.inputs, "prompt": rng.choice(phrasings)})


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
    condition: str | None = None,
    append: bool = False,
    provider: Provider = "scripted",
    model: str | None = None,
    live_model: ChatOpenAI | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected tool-agent fixture into a corpus directory."""
    model = resolve_live_model(model)
    if provider not in ("scripted", "live"):
        raise ValueError(f"unknown tool-agent provider {provider!r}")
    if condition is not None and fixtures is not None:
        raise ValueError("condition and fixtures cannot be selected together")
    if provider == "live" and not model:
        raise ValueError("live tool-agent recording requires an explicit model")
    if provider == "live" and live_model is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("live tool-agent recording requires OPENAI_API_KEY")
        model_args: dict[str, Any] = {
            "model": model,
            "api_key": api_key,
            "max_retries": 0,
        }
        model_args.update(live_model_options(model))
        if base_url := os.environ.get("OPENAI_BASE_URL"):
            model_args["base_url"] = base_url
        live_model = ChatOpenAI(**model_args)
    conditioned_tools: LocalTools | None = None
    if condition is not None:
        conditioned = materialize_condition(condition)
        if conditioned.fixture.archetype != "tool_agent":
            raise ValueError(f"condition {condition!r} does not select a tool-agent fixture")
        selected_fixtures: Sequence[RecorderFixture] = (conditioned.fixture,)
        conditioned_tools = local_tools(
            conditioned.fixture.domain,
            fixture_set=conditioned.tool_fixture_set,
            result_overlays=conditioned.tool_result_overlays,
        )
    else:
        selected_fixtures = fixtures_for("tool_agent", fixtures=fixtures)
        if provider == "scripted" and fixtures is None:
            # Auto-selection in scripted mode keeps only fixtures that have a
            # deterministic episode; the rest record live.
            selected_fixtures = tuple(
                fixture
                for fixture in selected_fixtures
                if fixture.domain != "coding_agent"
                or fixture.fragment_id in _SCRIPTED_CODING_EPISODES
            )
    prepare_recording(output_dir, append=append)
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider(
        resource=Resource.create({"service.name": "datagen.tool_agent"})
    )
    tracer_provider.add_span_processor(OpenInferenceContextSpanProcessor())
    tracer_provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    tracer = OITracer(tracer_provider.get_tracer(__name__), TraceConfig())
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    fragments = []
    variant_rng = random.Random()
    try:
        for fixture in selected_fixtures:
            if provider == "live":
                fixture = _with_prompt_variant(fixture, variant_rng)
            if provider == "scripted":
                scripted = ScriptedOpenAIProvider(_responses_for(fixture))
                selected_model = ChatOpenAI(
                    model="datagen-scripted",
                    api_key="datagen-dummy-key",
                    base_url="https://datagen.test/v1",
                    http_client=scripted.http_client(),
                    max_retries=0,
                    temperature=0,
                )
            else:
                selected_model = cast(ChatOpenAI, live_model)
            recorder = ToolAgentRecorder(
                selected_model,
                conditioned_tools or local_tools(fixture.domain),
                exporter,
                tracer,
                require_terminal_answer=provider == "scripted",
            )
            fragments.append(record_fixture(fixture, output_dir, recorder.record))
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()
    return tuple(fragments)


# Coding fixtures with a deterministic scripted episode; the rest are
# recorded live, where the model chooses its own tool calls.
_SCRIPTED_CODING_EPISODES = frozenset({"coding-router-api-tools", "coding-retry-policy-tools"})


def _responses_for(fixture: RecorderFixture) -> tuple[dict[str, Any], ...]:
    prompt = str(fixture.inputs.get("prompt", ""))
    if "calculate" in prompt:
        expression = "42.25 * 2" if "42.25" in prompt else "125000 - 8500"
        calls = (
            {"name": "document_search", "arguments": {"query": prompt, "limit": 1}},
            {"name": "safe_arithmetic", "arguments": {"expression": expression}},
        )
    elif fixture.fragment_id == "coding-router-api-tools":
        calls = (
            {"name": "repository_search", "arguments": {"query": "Router"}},
            {"name": "repository_search", "arguments": {"query": "Router"}},
            {"name": "record_lookup", "arguments": {"record_id": "issue-204"}},
            {"name": "read_file", "arguments": {"path": "README.md"}},
            {"name": "read_file", "arguments": {"path": "README.md"}},
            {"name": "read_file", "arguments": {"path": "README.md"}},
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/router.py"},
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/router.py"},
            },
            {"name": "run_tests", "arguments": {"test": "tests/test_readme.py"}},
            {
                "name": "edit_file",
                "arguments": {
                    "path": "README.md",
                    "old": "Router.dispatch",
                    "new": "Router.route",
                },
            },
            {"name": "read_file", "arguments": {"path": "README.md"}},
            {"name": "run_tests", "arguments": {"test": "tests/test_readme.py"}},
        )
    elif fixture.fragment_id == "coding-retry-policy-tools":
        calls = (
            {"name": "repository_search", "arguments": {"query": "retry"}},
            {"name": "repository_search", "arguments": {"query": "retry"}},
            {"name": "record_lookup", "arguments": {"record_id": "issue-219"}},
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/scheduler.py"},
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/scheduler.py"},
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/scheduler.py"},
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/retry.py"},
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/retry.py"},
            },
            {"name": "run_tests", "arguments": {"test": "tests/test_retry.py"}},
            {
                "name": "edit_file",
                "arguments": {
                    "path": "src/relaycache/retry.py",
                    "old": "return attempt + 1",
                    "new": "return attempt",
                },
            },
            {
                "name": "read_file",
                "arguments": {"path": "src/relaycache/retry.py"},
            },
            {"name": "run_tests", "arguments": {"test": "tests/test_retry.py"}},
        )
    elif fixture.domain == "coding_agent":
        raise ValueError(f"fixture {fixture.fragment_id!r} has no scripted coding episode")
    else:
        identifier = next(value for value in ("order-1001", "warehouse-east") if value in prompt)
        calls = (
            {"name": "record_lookup", "arguments": {"record_id": identifier}},
            {"name": "status_lookup", "arguments": {"status_id": identifier}},
        )
    if fixture.domain == "coding_agent":
        answer = (
            "I reproduced the failure, updated the affected file, and confirmed the focused test "
            "passes on the rerun."
        )
    else:
        answer = "The local records and policy data support the requested next step."
    return tuple({"tool_call": call} for call in calls) + ({"content": answer},)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--condition")
    parser.add_argument("--append", action="store_true")
    parser.add_argument("--provider", choices=("scripted", "live"), default="scripted")
    parser.add_argument("--model")
    args = parser.parse_args()
    fragments = record(
        args.output_dir,
        condition=args.condition,
        append=args.append,
        provider=args.provider,
        model=args.model,
    )
    print(f"Recorded {len(fragments)} tool-agent fragments in {args.output_dir}")


if __name__ == "__main__":
    main()
