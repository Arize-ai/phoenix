import importlib.util
import json
from pathlib import Path
from types import ModuleType

import pytest


def test_rag_recording_requires_kind_set_and_session_context(tmp_path: Path) -> None:
    recorder = _load_recorder()
    traces = tmp_path / "traces.jsonl"
    traces.write_text(
        "\n".join(
            json.dumps(_request(kind, span_id=index))
            for index, kind in enumerate(sorted(recorder.REQUIRED_SPAN_KINDS), start=1)
        )
        + "\n"
    )

    spans, kinds = recorder.validate_recording(traces)

    assert kinds == recorder.REQUIRED_SPAN_KINDS
    assert len(spans) == len(recorder.REQUIRED_SPAN_KINDS)

    traces.write_text(
        "\n".join(
            json.dumps(
                _request(
                    kind,
                    span_id=index,
                    session_id=None if kind == "RERANKER" else "rag-session",
                )
            )
            for index, kind in enumerate(sorted(recorder.REQUIRED_SPAN_KINDS), start=1)
        )
        + "\n"
    )
    with pytest.raises(RuntimeError, match="without session.id"):
        recorder.validate_recording(traces)


def _load_recorder() -> ModuleType:
    path = Path(__file__).parents[3] / "scripts/datagen/langchain_agent_rag.py"
    spec = importlib.util.spec_from_file_location("datagen_rag_recorder", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _request(
    kind: str, *, span_id: int, session_id: str | None = "rag-session"
) -> dict[str, object]:
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
                                "spanId": f"{span_id:016x}",
                                "name": kind.lower(),
                                "attributes": attributes,
                            }
                        ]
                    }
                ]
            }
        ]
    }
