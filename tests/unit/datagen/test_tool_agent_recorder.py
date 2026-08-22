import json
from collections.abc import Mapping
from hashlib import sha256
from pathlib import Path
from typing import Any

import httpx
import pytest

pytest.importorskip("langchain_core")
pytest.importorskip("openinference.instrumentation.langchain")

from langchain_openai import ChatOpenAI
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from scripts.datagen.fake_tools import (
    DEFAULT_REGISTRY,
    FAILURE_DELAY,
    FAILURE_EXCEPTION,
    FAILURE_NONE,
    InvocationLedger,
    ToolContext,
    load_default_fixture_sets,
)
from scripts.datagen.self_play import AssistantRequest
from scripts.datagen.tool_agent import (
    OpenInferenceContextSpanProcessor,
    SpanCaptureExporter,
    ToolAgentRecorder,
)


def test_tool_agent_records_an_organic_tool_path_with_authentic_topology(
    tmp_path: Path,
) -> None:
    cell_id = sha256(b"tool-agent-cell").hexdigest()
    provider = _OrganicToolProvider()
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(OpenInferenceContextSpanProcessor())
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    recorder = ToolAgentRecorder(
        ChatOpenAI(
            model="model-exact",
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
            temperature=0,
        ),
        exporter,
    )
    ledger = InvocationLedger(tmp_path / "tool-invocations.jsonl")
    fixtures = load_default_fixture_sets()["retail"]
    call_count = 0

    def invoke_tool(name: str, arguments: Mapping[str, Any]) -> Mapping[str, Any]:
        nonlocal call_count
        call_count += 1
        return DEFAULT_REGISTRY.invoke(
            name,
            arguments,
            ToolContext(
                pass_seed=23,
                cell_id=cell_id,
                fixture_set=fixtures,
                failure_mode=FAILURE_DELAY,
                call_ordinal=call_count,
            ),
            ledger,
        )

    try:
        recorded = recorder.record(
            AssistantRequest(
                cell_id=cell_id,
                attempt_id=f"{cell_id}:generation:1",
                turn_index=0,
                model="model-exact",
                messages=(
                    {
                        "role": "user",
                        "content": "Find the standard-delivery policy, then calculate 6 * 7.",
                    },
                ),
                tools=tuple(DEFAULT_REGISTRY.model_schemas()),
                traces_path=tmp_path / "traces.jsonl",
            ),
            invoke_tool,
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert [record.tool_name for record in ledger.records] == [
        "document_search",
        "safe_arithmetic",
    ]
    assert all(record.declared_delay_ms > 0 for record in ledger.records)
    assert recorded.messages[-1] == {
        "role": "assistant",
        "content": "The policy says 4–6 business days, and 6 × 7 is 42.",
    }
    assert recorded.usage.input_tokens == 66
    assert recorded.usage.output_tokens == 18
    assert len(recorded.trace_ids) == 1
    assert len((tmp_path / "traces.jsonl").read_text().splitlines()) == 1
    assert all("tool_choice" not in request for request in provider.requests)

    spans = exporter.spans_since(0)
    assert all(span.attributes is not None for span in spans)
    kinds = {
        span.attributes.get("openinference.span.kind")
        for span in spans
        if span.attributes is not None
    }
    assert {"AGENT", "TOOL", "LLM"}.issubset(kinds)
    assert all(
        span.attributes is not None and span.attributes["session.id"] == cell_id for span in spans
    )
    agent = next(
        span
        for span in spans
        if span.attributes is not None and span.attributes.get("openinference.span.kind") == "AGENT"
    )
    tool_spans = [
        span
        for span in spans
        if span.attributes is not None and span.attributes.get("openinference.span.kind") == "TOOL"
    ]
    assert len(tool_spans) == 2
    assert all(
        span.parent is not None and span.parent.span_id == agent.context.span_id
        for span in tool_spans
    )


def test_tool_agent_recovers_after_an_injected_tool_exception(tmp_path: Path) -> None:
    cell_id = sha256(b"tool-agent-fault-cell").hexdigest()
    provider = _OrganicToolProvider()
    exporter = SpanCaptureExporter()
    tracer_provider = TracerProvider()
    tracer_provider.add_span_processor(OpenInferenceContextSpanProcessor())
    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = LangChainInstrumentor()
    instrumentor.instrument(tracer_provider=tracer_provider)
    recorder = ToolAgentRecorder(
        ChatOpenAI(
            model="model-exact",
            api_key="test",
            base_url="http://datagen.test/v1",
            http_client=provider.http_client(),
            max_retries=0,
            temperature=0,
        ),
        exporter,
    )
    ledger = InvocationLedger(tmp_path / "tool-invocations.jsonl")
    fixtures = load_default_fixture_sets()["retail"]
    call_count = 0

    def invoke_tool(name: str, arguments: Mapping[str, Any]) -> Mapping[str, Any]:
        nonlocal call_count
        call_count += 1
        return DEFAULT_REGISTRY.invoke(
            name,
            arguments,
            ToolContext(
                pass_seed=23,
                cell_id=cell_id,
                fixture_set=fixtures,
                failure_mode=FAILURE_EXCEPTION if call_count == 1 else FAILURE_NONE,
                call_ordinal=call_count,
            ),
            ledger,
        )

    try:
        recorded = recorder.record(
            AssistantRequest(
                cell_id=cell_id,
                attempt_id=f"{cell_id}:generation:1",
                turn_index=0,
                model="model-exact",
                messages=(
                    {
                        "role": "user",
                        "content": "Find the standard-delivery policy, then calculate 6 * 7.",
                    },
                ),
                tools=tuple(DEFAULT_REGISTRY.model_schemas()),
                traces_path=tmp_path / "traces.jsonl",
            ),
            invoke_tool,
        )
    finally:
        instrumentor.uninstrument()
        tracer_provider.shutdown()

    assert [record.outcome for record in ledger.records] == ["error", "success"]
    assert json.loads(recorded.messages[1]["content"])["error"] == "InjectedToolFailure"
    assert recorded.messages[1]["status"] == "error"
    assert recorded.messages[-1]["role"] == "assistant"
    tool_spans = [
        span
        for span in exporter.spans_since(0)
        if span.attributes is not None and span.attributes.get("openinference.span.kind") == "TOOL"
    ]
    assert len(tool_spans) == 2
    assert any(event.name == "exception" for event in tool_spans[0].events)


class _OrganicToolProvider:
    def __init__(self) -> None:
        self.requests: list[dict[str, Any]] = []

    def http_client(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._handle))

    def _handle(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append(body)
        tool_messages = [message for message in body["messages"] if message["role"] == "tool"]
        if not tool_messages:
            message = _tool_call(
                "call_search",
                "document_search",
                {"query": "standard delivery", "limit": 1},
            )
        elif len(tool_messages) == 1:
            message = _tool_call("call_math", "safe_arithmetic", {"expression": "6 * 7"})
        else:
            message = {
                "role": "assistant",
                "content": "The policy says 4–6 business days, and 6 × 7 is 42.",
            }
        return httpx.Response(200, json=_completion(body, message), request=request)


def _tool_call(identifier: str, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": identifier,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": json.dumps(arguments, separators=(",", ":")),
                },
            }
        ],
    }


def _completion(body: dict[str, Any], message: dict[str, Any]) -> dict[str, Any]:
    tool_call = bool(message.get("tool_calls"))
    return {
        "id": f"chatcmpl-{len(body['messages'])}",
        "object": "chat.completion",
        "created": 0,
        "model": body["model"],
        "choices": [
            {
                "index": 0,
                "message": message,
                "finish_reason": "tool_calls" if tool_call else "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 22,
            "completion_tokens": 6,
            "total_tokens": 28,
            "prompt_tokens_details": {"cached_tokens": 2},
            "completion_tokens_details": {"reasoning_tokens": 0},
        },
    }
