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
"""Record fixed policy outcomes through the Guardrails instrumentor."""

from __future__ import annotations

import argparse
from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING or __package__:
    from scripts.datagen.recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
        validate_recording,
    )
else:
    from recording import (
        RecorderFixture,
        SpanCaptureExporter,
        append_spans,
        fixtures_for,
        record_fixture,
        reset_recording,
        trace_ids,
        validate_recording,
    )


def record(
    output_dir: Path,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[dict[str, Any], ...]:
    """Record every selected guardrail fixture into a corpus directory."""
    from guardrails import Guard  # type: ignore[import-not-found]
    from guardrails.validators import (  # type: ignore[import-not-found]
        FailResult,
        PassResult,
        Validator,
        register_validator,
    )
    from openinference.instrumentation import using_session
    from openinference.instrumentation.guardrails import (  # type: ignore[import-not-found]
        GuardrailsInstrumentor,
    )
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor

    @register_validator(name="datagen/fixed-policy", data_type="string")
    class FixturePolicy(Validator):  # type: ignore[misc]
        def validate(self, value: Any, metadata: dict[str, Any]) -> Any:
            del value
            outcome = metadata.get("outcome")
            if outcome == "allowed":
                return PassResult()
            if outcome == "redacted":
                return FailResult(
                    error_message="sensitive detail removed",
                    fix_value="[redacted by policy]",
                )
            return FailResult(error_message="request blocked by policy")

    reset_recording(output_dir)
    exporter = SpanCaptureExporter()
    provider = TracerProvider(resource=Resource.create({"service.name": "datagen.guardrailed"}))
    provider.add_span_processor(SimpleSpanProcessor(cast(Any, exporter)))
    instrumentor = GuardrailsInstrumentor()
    instrumentor.instrument(tracer_provider=provider)

    def adapter(fixture: RecorderFixture, traces_path: Path) -> tuple[str, ...]:
        text = fixture.inputs.get("text")
        outcome = fixture.inputs.get("outcome")
        if not isinstance(text, str) or outcome not in {"allowed", "blocked", "redacted"}:
            raise ValueError(f"fixture {fixture.fragment_id!r} has invalid policy inputs")
        on_fail = {"allowed": "noop", "blocked": "exception", "redacted": "fix"}[outcome]
        checkpoint = exporter.checkpoint()
        try:
            with using_session(fixture.fragment_id):
                try:
                    Guard().use(FixturePolicy(on_fail=on_fail)).validate(
                        text,
                        metadata={"outcome": outcome},
                    )
                except Exception:
                    if outcome != "blocked":
                        raise
        finally:
            spans = exporter.spans_since(checkpoint)
            if spans:
                append_spans(traces_path, spans)
        return trace_ids(spans)

    fragments = []
    try:
        for fixture in fixtures_for("guardrailed", fixtures=fixtures):
            fragments.append(record_fixture(fixture, output_dir, adapter))
    finally:
        instrumentor.uninstrument()
        provider.shutdown()
    validate_recording(
        output_dir / "traces.jsonl",
        required_span_kinds=("GUARDRAIL",),
        recorder_name="Guardrails instrumenter",
    )
    return tuple(fragments)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    fragments = record(args.output_dir)
    print(f"Recorded {len(fragments)} guardrail fragments in {args.output_dir}")


if __name__ == "__main__":
    main()
