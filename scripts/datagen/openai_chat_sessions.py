#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx==0.28.1",
#   "openai==3.1.0",
#   "openinference-instrumentation-openai==0.1.54",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record plain-chat fragments as OTLP protobuf JSON lines."""

from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import json
import os
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import TYPE_CHECKING, Any, NoReturn, cast

import httpx
from google.protobuf.json_format import MessageToJson
from openai import OpenAI
from openinference.instrumentation import using_session
from openinference.instrumentation.openai import OpenAIInstrumentor
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import (
    SimpleSpanProcessor,
    SpanExporter,
    SpanExportResult,
)

if TYPE_CHECKING:
    from scripts.datagen.generation import GenerationError, MatrixCell
    from scripts.datagen.scripted import ConversationScript
    from scripts.datagen.self_play import (
        AssistantRequest,
        RecordedAssistantTurn,
        TokenUsage,
        ToolInvoker,
    )
elif __package__:
    from scripts.datagen.generation import GenerationError, MatrixCell
    from scripts.datagen.scripted import ConversationScript
    from scripts.datagen.self_play import (
        AssistantRequest,
        RecordedAssistantTurn,
        TokenUsage,
        ToolInvoker,
    )
else:
    from generation import GenerationError, MatrixCell
    from scripted import ConversationScript
    from self_play import (
        AssistantRequest,
        RecordedAssistantTurn,
        TokenUsage,
        ToolInvoker,
    )

SCENARIO_NAME = "openai_chat_sessions"
SESSIONS = {
    "product-onboarding": (
        "Our new-team activation rate fell after we changed onboarding. Where should I start?",
        "Which assumption in that diagnosis is the riskiest?",
        "Design a small experiment to test it without rebuilding the entire flow.",
        "Summarize the recommendation as an owner, success bar, and review date.",
    ),
    "api-latency-incident": (
        "API p95 latency doubled while the median stayed flat. How should we investigate?",
        "Which metrics belong together on the incident dashboard?",
        "Give me the leading cause hypothesis and the evidence that would confirm it.",
        "Draft a concise stakeholder update while we test that hypothesis.",
    ),
    "community-garden": (
        "Help me plan a three-hour community garden workday for 18 volunteers.",
        "How should the plan change if rain is likely that morning?",
        "What materials should volunteers bring, and what should organizers provide?",
        "Write a short reminder email that includes the rain plan.",
    ),
}


class SpanCaptureExporter(SpanExporter):
    """Retain completed spans until a recorder persists them."""

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


class JsonlOtlpExporter(SpanExporter):
    """Write completed spans directly to a protobuf-JSON JSONL file."""

    def __init__(self, path: Path) -> None:
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        _append_spans(self._path, spans)
        return SpanExportResult.SUCCESS


@dataclass(frozen=True)
class RecordedPlainChatFragment:
    messages: tuple[Mapping[str, Any], ...]
    trace_ids: tuple[str, ...]
    usage: TokenUsage

    @property
    def turn_count(self) -> int:
        return sum(message.get("role") == "user" for message in self.messages)


class OpenAIPlainChatRecorder:
    """Record plain-chat turns through an instrumented streaming OpenAI client."""

    def __init__(self, client: OpenAI, exporter: SpanCaptureExporter) -> None:
        self._client = client
        self._exporter = exporter

    def record(
        self,
        request: AssistantRequest,
        invoke_tool: ToolInvoker,
    ) -> RecordedAssistantTurn:
        del invoke_tool
        checkpoint = self._exporter.checkpoint()
        content_parts: list[str] = []
        usage: Any = None
        try:
            with using_session(request.cell_id):
                stream = self._client.chat.completions.create(
                    model=request.model,
                    messages=cast(Any, list(request.messages)),
                    stream=True,
                    stream_options={"include_usage": True},
                )
                for chunk in cast(Any, stream):
                    for choice in chunk.choices:
                        if choice.delta.content:
                            content_parts.append(choice.delta.content)
                    if chunk.usage is not None:
                        usage = chunk.usage
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                _append_spans(request.traces_path, spans)

        if usage is None:
            raise GenerationError("streaming plain-chat response omitted token usage")
        content = "".join(content_parts)
        if not content.strip():
            raise GenerationError("streaming plain-chat response omitted assistant content")
        return RecordedAssistantTurn(
            messages=({"role": "assistant", "content": content},),
            trace_ids=_trace_ids(spans),
            usage=_token_usage(usage),
        )

    def record_script(
        self,
        cell: MatrixCell,
        script: ConversationScript,
        traces_path: Path,
    ) -> RecordedPlainChatFragment:
        """Replay a complete scripted cell through the same instrumented chat path."""
        if cell.lane != "scripted":
            raise GenerationError(f"Cell {cell.cell_id} belongs to {cell.lane}, not scripted")
        if script.cell_id != cell.cell_id:
            raise GenerationError("Conversation script belongs to a different matrix cell")
        if script.model != cell.assistant_model:
            raise GenerationError("Conversation script model differs from its matrix cell")

        messages: list[Mapping[str, Any]] = []
        trace_ids: list[str] = []
        usage = TokenUsage()
        for turn_index, turn in enumerate(script.turns):
            messages.append({"role": "user", "content": turn.user})
            recorded = self.record(
                AssistantRequest(
                    cell_id=cell.cell_id,
                    attempt_id=f"{cell.cell_id}:scripted:1",
                    turn_index=turn_index,
                    model=cell.assistant_model,
                    messages=tuple(messages),
                    tools=(),
                    traces_path=traces_path,
                ),
                _reject_tool_call,
            )
            if recorded.messages[-1].get("content") != turn.assistant:
                raise GenerationError(
                    f"Scripted plain-chat turn {turn_index} differed from the generated script"
                )
            messages.extend(recorded.messages)
            trace_ids.extend(recorded.trace_ids)
            usage += recorded.usage
        return RecordedPlainChatFragment(tuple(messages), tuple(trace_ids), usage)


def _reject_tool_call(name: str, arguments: Mapping[str, Any]) -> NoReturn:
    del name, arguments
    raise GenerationError("plain-chat fragments do not expose tools")


def _token_usage(usage: Any) -> TokenUsage:
    details = usage.prompt_tokens_details
    cached_tokens = details.cached_tokens if details is not None else 0
    return TokenUsage(
        input_tokens=usage.prompt_tokens,
        cached_input_tokens=cached_tokens or 0,
        output_tokens=usage.completion_tokens,
    )


def _trace_ids(spans: Sequence[ReadableSpan]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans))


def _append_spans(path: Path, spans: Sequence[ReadableSpan]) -> None:
    request = encode_spans(spans)
    payload = json.loads(MessageToJson(request, indent=None))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, separators=(",", ":")) + "\n")


def _iter_spans(payload: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    return [
        span
        for resource_spans in payload.get("resourceSpans", [])
        for scope_spans in resource_spans.get("scopeSpans", [])
        for span in scope_spans.get("spans", [])
    ]


def _attribute(span: Mapping[str, Any], key: str) -> Any:
    for attribute in span.get("attributes", []):
        if attribute.get("key") == key:
            return next(iter(attribute.get("value", {}).values()), None)
    return None


def write_manifest(output_dir: Path) -> None:
    spans = [
        span
        for line in (output_dir / "traces.jsonl").read_text().splitlines()
        for span in _iter_spans(json.loads(line))
    ]
    manifest = {
        "scenario_name": SCENARIO_NAME,
        "instrumenter_package_versions": {
            package: importlib.metadata.version(package)
            for package in (
                "openinference-instrumentation-openai",
                "openinference-semantic-conventions",
            )
        },
        "trace_count": len({span["traceId"] for span in spans}),
        "span_count": len(spans),
        "span_kinds": sorted(
            {kind for span in spans if (kind := _attribute(span, "openinference.span.kind"))}
        ),
        "session_structure": {
            "session_count": len(SESSIONS),
            "turns_per_session": {session_id: len(turns) for session_id, turns in SESSIONS.items()},
        },
        "encoding_notes": (
            "Each line is one protobuf-JSON ExportTraceServiceRequest. Spans from the same "
            "trace may occupy separate lines."
        ),
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def in_process_http_client() -> httpx.Client:
    module_name = "scripts.datagen.mock_openai_provider" if __package__ else "mock_openai_provider"
    create_chat_completion = importlib.import_module(module_name).create_chat_completion

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        completion = create_chat_completion(body)
        if body.get("stream"):
            return httpx.Response(
                200,
                headers={"content-type": "text/event-stream"},
                content=_streaming_response(completion),
                request=request,
            )
        return httpx.Response(200, json=completion, request=request)

    return httpx.Client(transport=httpx.MockTransport(handle))


def _streaming_response(completion: Mapping[str, Any]) -> bytes:
    choice = completion["choices"][0]
    content = choice["message"].get("content") or ""
    midpoint = max(1, len(content) // 2)
    chunks = []
    for part in (content[:midpoint], content[midpoint:]):
        if part:
            chunks.append(
                {
                    "id": completion["id"],
                    "object": "chat.completion.chunk",
                    "created": completion["created"],
                    "model": completion["model"],
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": part},
                            "finish_reason": None,
                        }
                    ],
                }
            )
    chunks.append(
        {
            "id": completion["id"],
            "object": "chat.completion.chunk",
            "created": completion["created"],
            "model": completion["model"],
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
    )
    chunks.append(
        {
            "id": completion["id"],
            "object": "chat.completion.chunk",
            "created": completion["created"],
            "model": completion["model"],
            "choices": [],
            "usage": completion["usage"],
        }
    )
    events = [f"data: {json.dumps(chunk, separators=(',', ':'))}\n\n" for chunk in chunks]
    return ("".join(events) + "data: [DONE]\n\n").encode()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_output = (
        Path(__file__).resolve().parents[2] / "src/phoenix/datagen/assets" / SCENARIO_NAME
    )
    parser.add_argument("--output-dir", type=Path, default=default_output)
    parser.add_argument(
        "--base-url", default=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:8765/v1")
    )
    parser.add_argument("--in-process-provider", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    traces_path = args.output_dir / "traces.jsonl"
    traces_path.write_text("")
    provider = TracerProvider(
        resource=Resource.create({"service.name": f"datagen.{SCENARIO_NAME}"})
    )
    exporter = SpanCaptureExporter()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    instrumentor = OpenAIInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    recorder = OpenAIPlainChatRecorder(
        OpenAI(
            base_url=args.base_url,
            api_key=os.getenv("OPENAI_API_KEY", "datagen-dummy-key"),
            http_client=cast(Any, in_process_http_client() if args.in_process_provider else None),
        ),
        exporter,
    )
    try:
        for session_id, turns in SESSIONS.items():
            messages: list[Mapping[str, Any]] = []
            for turn_index, turn in enumerate(turns):
                messages.append({"role": "user", "content": turn})
                recorded = recorder.record(
                    AssistantRequest(
                        cell_id=session_id,
                        attempt_id=f"{session_id}:legacy:1",
                        turn_index=turn_index,
                        model="gpt-4.1-mini",
                        messages=tuple(messages),
                        tools=(),
                        traces_path=traces_path,
                    ),
                    _reject_tool_call,
                )
                messages.extend(recorded.messages)
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    write_manifest(args.output_dir)
    print(f"Recorded {SCENARIO_NAME} in {args.output_dir}")


if __name__ == "__main__":
    main()
