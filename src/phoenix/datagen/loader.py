"""Load recorded OTLP trace corpora from disk or HTTP."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import urljoin, urlparse

import httpx
from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, Span


class CorpusError(ValueError):
    """Raised when a corpus cannot be located or parsed."""


@dataclass(frozen=True)
class Corpus:
    """A parsed corpus manifest and its OTLP export requests."""

    manifest: Mapping[str, Any]
    requests: Sequence[ExportTraceServiceRequest]
    source: str


def load_corpus(source: str | Path = "default") -> Corpus:
    """Load a bundled corpus name, local corpus directory, or HTTP(S) directory."""
    if isinstance(source, str) and urlparse(source).scheme in {"http", "https"}:
        manifest_text, traces_text = _read_http_corpus(source)
        display_source = source
    else:
        corpus_path = _resolve_local_corpus(source)
        manifest_text = _read_text(corpus_path / "manifest.json")
        traces_text = _read_text(corpus_path / "traces.jsonl")
        display_source = str(corpus_path)

    manifest = _parse_manifest(manifest_text, display_source)
    requests = _group_requests_by_trace_id(_parse_requests(traces_text, display_source))
    _validate_counts(manifest, requests, display_source)
    return Corpus(manifest=manifest, requests=requests, source=display_source)


def _resolve_local_corpus(source: str | Path) -> Path:
    path = Path(source).expanduser()
    if path.is_dir():
        return path

    if isinstance(source, Path) or path.is_absolute() or len(path.parts) != 1:
        raise CorpusError(f"Corpus directory does not exist: {path}")

    corpora_path = Path(__file__).with_name("corpora")
    if source == "default":
        if _is_corpus_directory(corpora_path):
            return corpora_path
        default_path = corpora_path / "default"
        if _is_corpus_directory(default_path):
            return default_path
        candidates = sorted(
            candidate for candidate in corpora_path.glob("*") if _is_corpus_directory(candidate)
        )
        if not candidates:
            raise CorpusError("No bundled corpora are installed")
        return candidates[0]

    bundled_path = corpora_path / source
    if _is_corpus_directory(bundled_path):
        return bundled_path
    raise CorpusError(f"Unknown bundled corpus or local directory: {source}")


def _is_corpus_directory(path: Path) -> bool:
    return (path / "manifest.json").is_file() and (path / "traces.jsonl").is_file()


def _read_http_corpus(source: str) -> tuple[str, str]:
    base_url = source.rstrip("/") + "/"
    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            manifest_response = client.get(urljoin(base_url, "manifest.json"))
            manifest_response.raise_for_status()
            traces_response = client.get(urljoin(base_url, "traces.jsonl"))
            traces_response.raise_for_status()
    except httpx.HTTPError as error:
        raise CorpusError(f"Unable to load corpus from {source}: {error}") from error
    return manifest_response.text, traces_response.text


def _read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as error:
        raise CorpusError(f"Unable to read corpus file {path}: {error}") from error


def _parse_manifest(text: str, source: str) -> Mapping[str, Any]:
    try:
        manifest = json.loads(text)
    except json.JSONDecodeError as error:
        raise CorpusError(f"Invalid manifest.json in {source}: {error}") from error
    if not isinstance(manifest, dict):
        raise CorpusError(f"manifest.json in {source} must contain a JSON object")
    if not manifest:
        raise CorpusError(f"manifest.json in {source} must not be empty")
    return manifest


def _parse_requests(text: str, source: str) -> tuple[ExportTraceServiceRequest, ...]:
    requests = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        request = ExportTraceServiceRequest()
        try:
            Parse(line, request)
        except ParseError as error:
            raise CorpusError(
                f"Invalid traces.jsonl entry in {source} at line {line_number}: {error}"
            ) from error
        if not any(_iter_spans(request)):
            raise CorpusError(
                f"traces.jsonl entry in {source} at line {line_number} contains no spans"
            )
        requests.append(request)
    if not requests:
        raise CorpusError(f"traces.jsonl in {source} contains no requests")
    return tuple(requests)


def _validate_counts(
    manifest: Mapping[str, Any],
    requests: Sequence[ExportTraceServiceRequest],
    source: str,
) -> None:
    spans = tuple(span for request in requests for span in _iter_spans(request))
    for span in spans:
        if len(span.trace_id) != 16:
            raise CorpusError(f"A span in {source} has a trace ID that is not 16 bytes")
        if len(span.span_id) != 8:
            raise CorpusError(f"A span in {source} has a span ID that is not 8 bytes")

    trace_count = len({span.trace_id for span in spans})
    expected_counts = {
        "trace_count": trace_count,
        "span_count": len(spans),
    }
    for field, actual in expected_counts.items():
        expected = manifest.get(field)
        if expected is not None and (not isinstance(expected, int) or expected != actual):
            raise CorpusError(
                f"manifest.json in {source} declares {field}={expected!r}, but parsed {actual}"
            )


def _iter_spans(request: ExportTraceServiceRequest):  # type: ignore[no-untyped-def]
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _group_requests_by_trace_id(
    requests: Sequence[ExportTraceServiceRequest],
) -> tuple[ExportTraceServiceRequest, ...]:
    grouped_requests: dict[bytes, ExportTraceServiceRequest] = {}
    for request in requests:
        for resource_spans in request.resource_spans:
            grouped_resource_spans: dict[bytes, ResourceSpans] = {}
            for scope_spans in resource_spans.scope_spans:
                spans_by_trace_id: dict[bytes, list[Span]] = {}
                for span in scope_spans.spans:
                    spans_by_trace_id.setdefault(span.trace_id, []).append(span)
                for trace_id, spans in spans_by_trace_id.items():
                    trace_request = grouped_requests.setdefault(
                        trace_id, ExportTraceServiceRequest()
                    )
                    new_resource_spans = grouped_resource_spans.get(trace_id)
                    if new_resource_spans is None:
                        new_resource_spans = trace_request.resource_spans.add()
                        new_resource_spans.resource.CopyFrom(resource_spans.resource)
                        new_resource_spans.schema_url = resource_spans.schema_url
                        grouped_resource_spans[trace_id] = new_resource_spans
                    new_scope_spans = new_resource_spans.scope_spans.add()
                    new_scope_spans.scope.CopyFrom(scope_spans.scope)
                    new_scope_spans.schema_url = scope_spans.schema_url
                    new_scope_spans.spans.extend(spans)
    return tuple(grouped_requests.values())
