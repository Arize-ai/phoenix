#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "langchain-core==1.5.6",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-langchain==0.1.70",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record a bounded multi-agent handoff graph through LangChain callbacks."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any

from google.protobuf.json_format import MessageToJson
from langchain_core.runnables import RunnableLambda
from openinference.instrumentation import get_attributes_from_context, using_session
from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
from opentelemetry.sdk.trace import ReadableSpan, Span, SpanProcessor
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

MAX_HANDOFFS = 2


@dataclass(frozen=True)
class GraphResult:
    answer: str
    handoffs: tuple[str, ...]
    trace_ids: tuple[str, ...]


class SpanCaptureExporter(SpanExporter):
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
    def on_start(self, span: Span, parent_context: Any = None) -> None:
        span.set_attributes(dict(get_attributes_from_context()))

    def on_end(self, span: ReadableSpan) -> None:
        pass

    def shutdown(self) -> None:
        pass


class GraphMultiAgentRecorder:
    def __init__(self, exporter: SpanCaptureExporter) -> None:
        self._exporter = exporter

    def record(self, session_id: str, prompt: str, traces_path: Path) -> GraphResult:
        checkpoint = self._exporter.checkpoint()

        def research(state: Mapping[str, Any]) -> dict[str, Any]:
            return {
                **state,
                "evidence": "Standard delivery is four to six business days.",
                "handoffs": [*state["handoffs"], "research_agent->writer_agent"],
            }

        def write(state: Mapping[str, Any]) -> dict[str, Any]:
            return {
                **state,
                "answer": f"For {state['prompt']}: {state['evidence']}",
            }

        research_agent = RunnableLambda(research).with_config({"run_name": "research_agent"})
        writer_agent = RunnableLambda(write).with_config({"run_name": "writer_agent"})
        research_node = RunnableLambda(research_agent.invoke).with_config(
            {"run_name": "research_policy_node"}
        )
        writer_node = RunnableLambda(writer_agent.invoke).with_config(
            {"run_name": "writer_response_node"}
        )

        def supervise(state: Mapping[str, Any]) -> dict[str, Any]:
            researched = research_node.invoke(state)
            if len(researched["handoffs"]) >= MAX_HANDOFFS:
                raise RuntimeError("multi-agent handoff limit reached before writer")
            researched = {
                **researched,
                "handoffs": [*researched["handoffs"], "supervisor_agent->writer_agent"],
            }
            return writer_node.invoke(researched)

        graph = RunnableLambda(supervise).with_config({"run_name": "supervisor_agent"})
        try:
            with using_session(session_id):
                result = graph.invoke({"prompt": prompt, "handoffs": []})
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                _append_spans(traces_path, spans)
        handoffs = tuple(result["handoffs"])
        if len(handoffs) > MAX_HANDOFFS:
            raise RuntimeError(f"multi-agent graph exceeded {MAX_HANDOFFS} handoffs")
        return GraphResult(
            answer=result["answer"],
            handoffs=handoffs,
            trace_ids=tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans)),
        )


def _append_spans(path: Path, spans: Sequence[ReadableSpan]) -> None:
    payload = json.loads(MessageToJson(encode_spans(spans), indent=None))
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(payload, separators=(",", ":")) + "\n")
