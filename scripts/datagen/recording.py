"""Shared fixture and output helpers for trace corpus recorders."""

from __future__ import annotations

import json
import re
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Literal, TypeAlias, cast

Archetype = Literal[
    "plain_chat",
    "rag",
    "tool_agent",
    "graph_multi_agent",
    "guardrailed",
    "structured_extraction",
]
JSON: TypeAlias = None | bool | int | float | str | list["JSON"] | dict[str, "JSON"]
RecorderAdapter: TypeAlias = Callable[["RecorderFixture", Path], Iterable[str]]

_ARCHETYPES = frozenset(
    {
        "plain_chat",
        "rag",
        "tool_agent",
        "graph_multi_agent",
        "guardrailed",
        "structured_extraction",
    }
)
_TRACE_ID_PATTERN = re.compile(r"[0-9a-fA-F]{32}")
_LIVE_MODEL_ALIASES = {"luna": "gpt-5.6-luna"}


class RecordingError(ValueError):
    """Raised when a recorder fixture or its output is malformed."""


def resolve_live_model(model: str | None) -> str | None:
    """Resolve recorder-friendly live model aliases to provider model IDs."""
    return _LIVE_MODEL_ALIASES.get(model, model)


class SpanCaptureExporter:
    """Retain completed spans until a fixture appends them to its corpus row."""

    def __init__(self) -> None:
        self._spans: list[Any] = []
        self._lock = Lock()

    def export(self, spans: Sequence[Any]) -> Any:
        from opentelemetry.sdk.trace.export import SpanExportResult

        with self._lock:
            self._spans.extend(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass

    def force_flush(self, timeout_millis: int = 30_000) -> bool:
        del timeout_millis
        return True

    def checkpoint(self) -> int:
        with self._lock:
            return len(self._spans)

    def spans_since(self, checkpoint: int) -> tuple[Any, ...]:
        with self._lock:
            return tuple(self._spans[checkpoint:])


@dataclass(frozen=True)
class RecorderFixture:
    """Deterministic inputs for recording one corpus fragment."""

    fragment_id: str
    archetype: Archetype
    domain: str
    inputs: Mapping[str, JSON]

    def fragment_record(self, trace_ids: Iterable[str]) -> dict[str, JSON]:
        normalized = tuple(dict.fromkeys(_trace_id(value) for value in trace_ids))
        if not normalized:
            raise RecordingError(f"fixture {self.fragment_id!r} produced no trace IDs")
        return {
            "fragment_id": self.fragment_id,
            "archetype": self.archetype,
            "domain": self.domain,
            "trace_ids": list(normalized),
        }


def load_fixtures(path: Path | None = None) -> tuple[RecorderFixture, ...]:
    """Load the fixed recorder inputs."""
    source = path or Path(__file__).with_name("recorder_fixtures.json")
    try:
        value = json.loads(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RecordingError(f"unable to load recorder fixtures from {source}: {error}") from error
    if not isinstance(value, list) or not value:
        raise RecordingError(f"recorder fixtures in {source} must be a non-empty array")

    fixtures = tuple(_fixture(item, source) for item in value)
    fragment_ids = [fixture.fragment_id for fixture in fixtures]
    if len(set(fragment_ids)) != len(fragment_ids):
        raise RecordingError(f"recorder fixture IDs in {source} must be unique")
    return fixtures


def fixtures_for(
    archetype: Archetype,
    *,
    fixtures: Sequence[RecorderFixture] | None = None,
) -> tuple[RecorderFixture, ...]:
    """Return the fixed inputs for one recorder archetype."""
    available = fixtures if fixtures is not None else load_fixtures()
    return tuple(fixture for fixture in available if fixture.archetype == archetype)


def record_fixture(
    fixture: RecorderFixture,
    output_dir: Path,
    adapter: RecorderAdapter,
) -> dict[str, JSON]:
    """Run a recorder adapter and append its fragment row."""
    output_dir.mkdir(parents=True, exist_ok=True)
    trace_ids = tuple(adapter(fixture, output_dir / "traces.jsonl"))
    fragment = fixture.fragment_record(trace_ids)
    _append_json(output_dir / "fragments.jsonl", fragment)
    return fragment


def reset_recording(output_dir: Path) -> None:
    """Prepare an empty two-file recorder output directory."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in ("fragments.jsonl", "traces.jsonl"):
        (output_dir / name).write_text("", encoding="utf-8")


def prepare_recording(output_dir: Path, *, append: bool) -> None:
    """Prepare recorder output, preserving existing rows when requested."""
    if not append:
        reset_recording(output_dir)
        return
    output_dir.mkdir(parents=True, exist_ok=True)
    for name in ("fragments.jsonl", "traces.jsonl"):
        (output_dir / name).touch()


def append_spans(path: Path, spans: Sequence[Any]) -> None:
    """Append completed SDK spans as one protobuf-JSON OTLP request."""
    from google.protobuf.json_format import MessageToJson
    from opentelemetry.exporter.otlp.proto.common.trace_encoder import encode_spans

    payload = json.loads(MessageToJson(encode_spans(spans), indent=None))
    _append_json(path, payload)


def trace_ids(spans: Sequence[Any]) -> tuple[str, ...]:
    """Return trace identifiers in first-seen order."""
    return tuple(dict.fromkeys(f"{span.context.trace_id:032x}" for span in spans))


def validate_recording(
    path: Path,
    *,
    required_span_kinds: Iterable[str],
    recorder_name: str,
) -> tuple[list[dict[str, Any]], set[str]]:
    """Inspect recorder output for expected span kinds and session attributes."""
    spans = [
        span
        for line in path.read_text(encoding="utf-8").splitlines()
        for span in _iter_spans(json.loads(line))
    ]
    kinds = {kind for span in spans if (kind := span_attribute(span, "openinference.span.kind"))}
    missing_kinds = set(required_span_kinds) - kinds
    if missing_kinds:
        missing = ", ".join(sorted(missing_kinds))
        raise RecordingError(f"{recorder_name} did not emit required span kinds: {missing}")
    missing_sessions = [
        str(span.get("spanId", "unknown"))
        for span in spans
        if not span_attribute(span, "session.id")
    ]
    if missing_sessions:
        raise RecordingError(
            f"{recorder_name} emitted spans without session.id: " + ", ".join(missing_sessions)
        )
    return spans, kinds


def span_attribute(span: Mapping[str, Any], key: str) -> Any:
    for attribute in span.get("attributes", []):
        if attribute.get("key") == key:
            return next(iter(attribute.get("value", {}).values()), None)
    return None


def _fixture(value: Any, source: Path) -> RecorderFixture:
    if not isinstance(value, dict) or set(value) != {
        "fragment_id",
        "archetype",
        "domain",
        "inputs",
    }:
        raise RecordingError(f"each recorder fixture in {source} must have four named fields")
    fragment_id = value["fragment_id"]
    archetype = value["archetype"]
    domain = value["domain"]
    inputs = value["inputs"]
    if not isinstance(fragment_id, str) or not fragment_id:
        raise RecordingError(f"recorder fixture IDs in {source} must be non-empty strings")
    if archetype not in _ARCHETYPES:
        raise RecordingError(f"fixture {fragment_id!r} has unknown archetype {archetype!r}")
    if not isinstance(domain, str) or not domain:
        raise RecordingError(f"fixture {fragment_id!r} must have a non-empty domain")
    if not isinstance(inputs, dict) or not inputs:
        raise RecordingError(f"fixture {fragment_id!r} must have deterministic app inputs")
    return RecorderFixture(fragment_id, cast(Archetype, archetype), domain, inputs)


def _trace_id(value: str) -> str:
    if not isinstance(value, str) or _TRACE_ID_PATTERN.fullmatch(value) is None:
        raise RecordingError("recorder adapters must return 32-character hexadecimal trace IDs")
    return value.lower()


def _append_json(path: Path, value: Mapping[str, JSON]) -> None:
    with path.open("a", encoding="utf-8") as output:
        output.write(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")


def _iter_spans(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        span
        for resource_spans in payload.get("resourceSpans", [])
        for scope_spans in resource_spans.get("scopeSpans", [])
        for span in scope_spans.get("spans", [])
    ]
