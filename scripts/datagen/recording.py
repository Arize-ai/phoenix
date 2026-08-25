"""Shared inspection for recorder-produced OTLP protobuf JSON lines."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any


def validate_recording(
    path: Path,
    *,
    required_span_kinds: Iterable[str],
    recorder_name: str,
) -> tuple[list[dict[str, Any]], set[str]]:
    spans = [
        span
        for line in path.read_text(encoding="utf-8").splitlines()
        for span in _iter_spans(json.loads(line))
    ]
    kinds = {kind for span in spans if (kind := span_attribute(span, "openinference.span.kind"))}
    missing_kinds = set(required_span_kinds) - kinds
    if missing_kinds:
        missing = ", ".join(sorted(missing_kinds))
        raise RuntimeError(f"{recorder_name} did not emit required span kinds: {missing}")
    missing_sessions = [
        str(span.get("spanId", "unknown"))
        for span in spans
        if not span_attribute(span, "session.id")
    ]
    if missing_sessions:
        raise RuntimeError(
            f"{recorder_name} emitted spans without session.id: " + ", ".join(missing_sessions)
        )
    return spans, kinds


def span_attribute(span: Mapping[str, Any], key: str) -> Any:
    for attribute in span.get("attributes", []):
        if attribute.get("key") == key:
            return next(iter(attribute.get("value", {}).values()), None)
    return None


def _iter_spans(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        span
        for resource_spans in payload.get("resourceSpans", [])
        for scope_spans in resource_spans.get("scopeSpans", [])
        for span in scope_spans.get("spans", [])
    ]
