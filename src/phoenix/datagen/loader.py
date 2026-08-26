"""Load recorded OTLP traces from a local directory or the corpus cache."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, Span

from phoenix.datagen.schema import (
    Fragment,
    SchemaValidationError,
    validate_corpus_manifest_v2,
    validate_fragment_v2,
)


class CorpusError(ValueError):
    """Raised when a corpus cannot be located or parsed."""


@dataclass(frozen=True)
class Corpus:
    """A parsed corpus manifest and its OTLP export requests."""

    manifest: Mapping[str, Any]
    requests: Sequence[ExportTraceServiceRequest]
    source: str
    fragments: Sequence[Fragment]

    @property
    def schema_version(self) -> int:
        version = self.manifest.get("schema_version")
        return version if type(version) is int else 1

    @property
    def requests_by_trace_id(self) -> Mapping[str, ExportTraceServiceRequest]:
        return {next(_iter_spans(request)).trace_id.hex(): request for request in self.requests}


def load_corpus(source: str | Path | None = None) -> Corpus:
    """Load the bundled or published corpus, or an explicit local directory."""
    corpus_path = _resolve_default_corpus() if source is None else _resolve_local_corpus(source)
    display_source = str(corpus_path)

    manifest = _parse_manifest(_read_bytes(corpus_path / "manifest.json"), display_source)
    version = manifest.get("schema_version")
    if type(version) is not int or version != 2:
        raise CorpusError(f"manifest.json in {display_source} field 'schema_version' must be 2")
    manifest_v2 = _validate_corpus_manifest_v2(manifest, display_source)

    fragments = _parse_fragments(_read_bytes(corpus_path / "fragments.jsonl"), display_source)
    requests = _group_requests_by_trace_id(
        _parse_requests(_read_bytes(corpus_path / "traces.jsonl"), display_source)
    )
    _validate_fragment_trace_ids(fragments, requests, display_source)
    return Corpus(
        manifest=manifest_v2,
        requests=requests,
        source=display_source,
        fragments=fragments,
    )


def _resolve_default_corpus() -> Path:
    """Prefer a corpus bundled with the package; otherwise fetch the published corpus."""
    assets_root = Path(__file__).parent / "assets"
    bundled = next(
        (entry for entry in sorted(assets_root.glob("*")) if (entry / "manifest.json").is_file()),
        None,
    )
    if bundled is not None:
        return bundled

    from phoenix.datagen.fetcher import CorpusFetchError, fetch_corpus

    try:
        return fetch_corpus()
    except CorpusFetchError as error:
        raise CorpusError(f"Unable to resolve the default corpus: {error}") from error


def _resolve_local_corpus(source: str | Path) -> Path:
    path = Path(source).expanduser()
    if path.is_dir():
        return path
    raise CorpusError(f"Corpus directory does not exist: {path}")


def _read_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise CorpusError(f"Unable to read corpus file {path}: {error}") from error


def _parse_manifest(content: bytes, source: str) -> Mapping[str, Any]:
    try:
        manifest = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise CorpusError(f"Invalid manifest.json in {source}: {error}") from error
    if not isinstance(manifest, dict):
        raise CorpusError(f"manifest.json in {source} must contain a JSON object")
    if not manifest:
        raise CorpusError(f"manifest.json in {source} must not be empty")
    return manifest


def _parse_requests(content: bytes, source: str) -> tuple[ExportTraceServiceRequest, ...]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise CorpusError(f"Invalid UTF-8 in traces.jsonl in {source}: {error}") from error
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
        raise CorpusError(f"corpus in {source} contains no traces")
    return tuple(requests)


def _validate_corpus_manifest_v2(manifest: Mapping[str, Any], source: str) -> Mapping[str, Any]:
    try:
        return validate_corpus_manifest_v2(manifest)
    except SchemaValidationError as error:
        raise CorpusError(f"manifest.json in {source} field {error.field!r} {error}") from error


def _parse_fragments(content: bytes, source: str) -> tuple[Fragment, ...]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise CorpusError(f"Invalid UTF-8 in fragments.jsonl in {source}: {error}") from error
    fragments = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise CorpusError(
                f"Invalid fragments.jsonl entry in {source} at line {line_number}: {error}"
            ) from error
        if not isinstance(value, dict):
            raise CorpusError(
                f"fragments.jsonl in {source} at line {line_number} must contain a JSON object"
            )
        try:
            fragments.append(validate_fragment_v2(value))
        except SchemaValidationError as error:
            raise CorpusError(
                f"fragments.jsonl in {source} at line {line_number} field {error.field!r} {error}"
            ) from error
    if not fragments:
        raise CorpusError(f"corpus in {source} contains no fragments")
    return tuple(fragments)


def _validate_fragment_trace_ids(
    fragments: Sequence[Fragment],
    requests: Sequence[ExportTraceServiceRequest],
    source: str,
) -> None:
    parsed_trace_ids = {next(_iter_spans(request)).trace_id.hex() for request in requests}
    for fragment in fragments:
        for trace_id in fragment.trace_ids:
            if trace_id not in parsed_trace_ids:
                raise CorpusError(
                    f"fragments.jsonl in {source} fragment {fragment.fragment_id!r} field "
                    f"'trace_ids' references unknown trace ID {trace_id!r}"
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
