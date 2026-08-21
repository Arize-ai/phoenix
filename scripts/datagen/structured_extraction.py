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
"""Record structured extraction through instrumented OpenAI function calls."""

from __future__ import annotations

import json
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, cast

from openai import OpenAI
from openinference.instrumentation import using_session

if __package__:
    from scripts.datagen.generation import GenerationError
    from scripts.datagen.openai_chat_sessions import SpanCaptureExporter, _append_spans
else:
    from generation import GenerationError
    from openai_chat_sessions import SpanCaptureExporter, _append_spans

EXTRACTION_TOOL = {
    "type": "function",
    "function": {
        "name": "extract_support_case",
        "description": "Extract the support case fields from the user message.",
        "strict": True,
        "parameters": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "order_id": {"type": "string"},
                "intent": {"type": "string", "enum": ["return", "delivery", "account"]},
                "urgent": {"type": "boolean"},
            },
            "required": ["order_id", "intent", "urgent"],
        },
    },
}


@dataclass(frozen=True)
class ExtractionRequest:
    cell_id: str
    model: str
    text: str
    traces_path: Path


@dataclass(frozen=True)
class SupportCase:
    order_id: str
    intent: Literal["return", "delivery", "account"]
    urgent: bool
    trace_ids: tuple[str, ...]


class StructuredExtractionRecorder:
    def __init__(self, client: OpenAI, exporter: SpanCaptureExporter) -> None:
        self._client = client
        self._exporter = exporter

    def record(self, request: ExtractionRequest) -> SupportCase:
        checkpoint = self._exporter.checkpoint()
        try:
            with using_session(request.cell_id):
                response = self._client.chat.completions.create(
                    model=request.model,
                    messages=[{"role": "user", "content": request.text}],
                    tools=cast(Any, [EXTRACTION_TOOL]),
                    tool_choice={
                        "type": "function",
                        "function": {"name": "extract_support_case"},
                    },
                )
        finally:
            spans = self._exporter.spans_since(checkpoint)
            if spans:
                _append_spans(request.traces_path, spans)

        calls = response.choices[0].message.tool_calls
        if calls is None or len(calls) != 1 or calls[0].function.name != "extract_support_case":
            raise GenerationError(
                "structured extraction response omitted the required function call"
            )
        try:
            value = json.loads(calls[0].function.arguments)
        except json.JSONDecodeError as error:
            raise GenerationError(
                "structured extraction returned invalid JSON arguments"
            ) from error
        order_id, intent, urgent = _validate_case(value)
        return SupportCase(
            order_id=order_id,
            intent=intent,
            urgent=urgent,
            trace_ids=tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans)),
        )


def _validate_case(value: Any) -> tuple[str, Literal["return", "delivery", "account"], bool]:
    if not isinstance(value, Mapping) or set(value) != {"order_id", "intent", "urgent"}:
        raise GenerationError("structured extraction fields do not match the declared schema")
    order_id = value["order_id"]
    intent = value["intent"]
    urgent = value["urgent"]
    if not isinstance(order_id, str) or not order_id:
        raise GenerationError("structured extraction order_id must be a non-empty string")
    if intent not in ("return", "delivery", "account"):
        raise GenerationError("structured extraction intent is outside the declared enum")
    if not isinstance(urgent, bool):
        raise GenerationError("structured extraction urgent must be a boolean")
    return order_id, cast(Literal["return", "delivery", "account"], intent), urgent
