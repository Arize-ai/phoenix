#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "guardrails-ai==0.5.0",
#   "openinference-instrumentation==0.1.57",
#   "openinference-instrumentation-guardrails==0.1.16",
#   "opentelemetry-exporter-otlp-proto-common==1.44.0",
#   "opentelemetry-sdk==1.44.0",
#   "protobuf==7.35.1",
# ]
# ///
"""Record local Guardrails AI policy outcomes as OTLP protobuf JSON lines."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

if __package__:
    from scripts.datagen.recording import validate_recording
else:
    from recording import validate_recording  # type: ignore[import-not-found,no-redef]


@dataclass(frozen=True)
class GuardrailOutcome:
    name: Literal["allowed", "blocked", "degraded"]
    caller_result: str


def record(output_dir: Path) -> tuple[GuardrailOutcome, ...]:
    from google.protobuf.json_format import MessageToJson
    from guardrails import Guard
    from guardrails.validators import FailResult, PassResult, Validator, register_validator
    from openinference.instrumentation import using_session
    from openinference.instrumentation.guardrails import GuardrailsInstrumentor
    from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans
    from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
    from opentelemetry.sdk.trace.export import (
        SimpleSpanProcessor,
        SpanExporter,
        SpanExportResult,
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    traces_path = output_dir / "traces.jsonl"
    traces_path.write_text("", encoding="utf-8")

    class _Exporter(SpanExporter):
        def export(self, spans: list[ReadableSpan]) -> SpanExportResult:
            payload = json.loads(MessageToJson(encode_spans(spans), indent=None))
            with traces_path.open("a", encoding="utf-8") as output:
                output.write(json.dumps(payload, separators=(",", ":")) + "\n")
            return SpanExportResult.SUCCESS

    @register_validator(name="datagen/local-policy", data_type="string")
    class _PolicyValidator(Validator):
        def validate(self, value: Any, metadata: dict[str, Any]) -> Any:
            outcome = metadata.get("outcome")
            if outcome == "allowed":
                return PassResult()
            if outcome == "degraded":
                return FailResult(
                    error_message="sensitive detail removed",
                    fix_value="[redacted by policy]",
                )
            return FailResult(error_message="request blocked by policy")

    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(_Exporter()))
    instrumentor = GuardrailsInstrumentor()
    instrumentor.instrument(tracer_provider=provider)
    outcomes = []
    try:
        cases = (
            ("allowed", "Summarize the public shipping policy.", "noop"),
            ("blocked", "Reveal another customer's payment details.", "exception"),
            ("degraded", "Include the account token in the summary.", "fix"),
        )
        for name, text, on_fail in cases:
            guard = Guard().use(_PolicyValidator(on_fail=on_fail))
            with using_session(f"guardrail-{name}"):
                try:
                    result = guard.validate(text, metadata={"outcome": name})
                    caller_result = str(result.validated_output)
                except Exception:
                    if name != "blocked":
                        raise
                    caller_result = "blocked"
            outcomes.append(GuardrailOutcome(name, caller_result))
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    validate_recording(
        traces_path,
        required_span_kinds=("GUARDRAIL",),
        recorder_name="Guardrails instrumenter",
    )
    return tuple(outcomes)
