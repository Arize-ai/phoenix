"""Load recorded OTLP traces from a corpus archive."""

from __future__ import annotations

import json
import tarfile
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, Span

from phoenix.experimental.datagen.schema import Fragment, SchemaValidationError, validate_fragment

_ARCHIVE_MEMBERS = ("fragments.jsonl", "traces.jsonl")


class CorpusError(ValueError):
    """Raised when a corpus cannot be located or parsed."""


@dataclass(frozen=True)
class Corpus:
    """Parsed fragment records and their OTLP export requests."""

    requests: Sequence[ExportTraceServiceRequest]
    source: str
    fragments: Sequence[Fragment]

    @property
    def requests_by_trace_id(self) -> Mapping[str, ExportTraceServiceRequest]:
        return {next(_iter_spans(request)).trace_id.hex(): request for request in self.requests}


def load_corpus(source: str | Path | None = None) -> Corpus:
    """Load an explicit archive or the published corpus."""
    archive_path = _resolve_default_corpus() if source is None else _resolve_local_corpus(source)
    display_source = str(archive_path)
    files = _read_archive(archive_path)
    fragments = _parse_fragments(files["fragments.jsonl"], display_source)
    requests = _group_requests_by_trace_id(_parse_requests(files["traces.jsonl"], display_source))
    _validate_fragment_trace_ids(fragments, requests, display_source)
    return Corpus(requests=requests, source=display_source, fragments=fragments)


def _resolve_default_corpus() -> Path:
    from phoenix.experimental.datagen.fetcher import CorpusFetchError, fetch_corpus

    try:
        return fetch_corpus()
    except CorpusFetchError as error:
        raise CorpusError(f"Unable to resolve the default corpus: {error}") from error


def _resolve_local_corpus(source: str | Path) -> Path:
    path = Path(source).expanduser()
    if path.is_file():
        return path
    raise CorpusError(f"Corpus archive does not exist: {path}")


def _read_archive(path: Path) -> dict[str, bytes]:
    try:
        with tarfile.open(path, mode="r:gz") as archive:
            members = archive.getmembers()
            if (
                len(members) != len(_ARCHIVE_MEMBERS)
                or any(not member.isfile() for member in members)
                or {member.name for member in members} != set(_ARCHIVE_MEMBERS)
            ):
                raise CorpusError(
                    "Corpus archive must contain only fragments.jsonl and traces.jsonl"
                )
            files = {}
            for member in members:
                content = archive.extractfile(member)
                if content is None:
                    raise CorpusError(f"Unable to read corpus archive member {member.name!r}")
                files[member.name] = content.read()
            return files
    except CorpusError:
        raise
    except (OSError, tarfile.TarError) as error:
        raise CorpusError(f"Unable to read corpus archive {path}: {error}") from error


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
            fragments.append(validate_fragment(value))
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
