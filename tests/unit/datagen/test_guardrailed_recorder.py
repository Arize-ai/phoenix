import json
from pathlib import Path

import pytest

from scripts.datagen.guardrailed_app import REQUIRED_SPAN_KIND, validate_recording


def test_guardrailed_recording_requires_authentic_kind_and_session(tmp_path: Path) -> None:
    traces = tmp_path / "traces.jsonl"
    traces.write_text(json.dumps(_request(REQUIRED_SPAN_KIND, "guardrail-allowed")) + "\n")

    spans, kinds = validate_recording(traces)

    assert kinds == {"GUARDRAIL"}
    assert len(spans) == 1

    traces.write_text(json.dumps(_request("CHAIN", "guardrail-allowed")) + "\n")
    with pytest.raises(RuntimeError, match="did not emit a GUARDRAIL"):
        validate_recording(traces)

    traces.write_text(json.dumps(_request(REQUIRED_SPAN_KIND, None)) + "\n")
    with pytest.raises(RuntimeError, match="without session.id"):
        validate_recording(traces)


def _request(kind: str, session_id: str | None) -> dict:
    attributes = [
        {"key": "openinference.span.kind", "value": {"stringValue": kind}},
    ]
    if session_id is not None:
        attributes.append({"key": "session.id", "value": {"stringValue": session_id}})
    return {
        "resourceSpans": [
            {
                "scopeSpans": [
                    {
                        "spans": [
                            {
                                "traceId": "01" * 16,
                                "spanId": "01" * 8,
                                "name": "guard.validate",
                                "attributes": attributes,
                            }
                        ]
                    }
                ]
            }
        ]
    }
