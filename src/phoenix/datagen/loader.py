"""Load recorded OTLP trace scenarios from disk or HTTP."""

from __future__ import annotations

import json
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import urljoin, urlparse

import httpx
from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import ResourceSpans, Span

from phoenix.datagen.schema import (
    Fragment,
    ScenarioManifestV2,
    SchemaValidationError,
    validate_fragment_v2,
    validate_manifest_v2,
)


class ScenarioError(ValueError):
    """Raised when a scenario cannot be located or parsed."""


@dataclass(frozen=True)
class Scenario:
    """A parsed scenario manifest and its OTLP export requests."""

    manifest: Mapping[str, Any]
    requests: Sequence[ExportTraceServiceRequest]
    source: str
    fragments: Sequence[Fragment] = ()

    @property
    def schema_version(self) -> int:
        version = self.manifest.get("schema_version")
        return version if type(version) is int else 1

    @property
    def requests_by_trace_id(self) -> Mapping[str, ExportTraceServiceRequest]:
        return {next(_iter_spans(request)).trace_id.hex(): request for request in self.requests}


def load_scenario(source: str | Path = "default") -> Scenario:
    """Load a bundled scenario name, local directory, or HTTP(S) directory."""
    if isinstance(source, str) and urlparse(source).scheme in {"http", "https"}:
        display_source = source
        manifest_bytes = _read_http_file(source, "manifest.json")
    else:
        scenario_path = _resolve_local_scenario(source)
        display_source = str(scenario_path)
        manifest_bytes = _read_bytes(scenario_path / "manifest.json")

    manifest = _parse_manifest(manifest_bytes, display_source)
    version = manifest.get("schema_version")
    if version is not None and (type(version) is not int or version != 2):
        raise ScenarioError(f"manifest.json in {display_source} field 'schema_version' must be 2")

    if isinstance(source, str) and urlparse(source).scheme in {"http", "https"}:
        traces_bytes = _read_http_file(source, "traces.jsonl")
    else:
        traces_bytes = _read_bytes(scenario_path / "traces.jsonl")

    fragments: tuple[Fragment, ...] = ()
    scenario_source = display_source
    if version == 2:
        manifest = _validate_manifest_v2(manifest, display_source)
        scenario_source = f"{manifest['scenario_name']} ({display_source})"
        if isinstance(source, str) and urlparse(source).scheme in {"http", "https"}:
            fragments_bytes = _read_http_file(source, "fragments.jsonl")
        else:
            fragments_bytes = _read_bytes(scenario_path / "fragments.jsonl")
        _validate_file_metadata(manifest, "traces.jsonl", traces_bytes, scenario_source)
        _validate_file_metadata(manifest, "fragments.jsonl", fragments_bytes, scenario_source)
        fragments = _parse_fragments(fragments_bytes, scenario_source)

    requests = _group_requests_by_trace_id(_parse_requests(traces_bytes, scenario_source))
    _validate_counts(manifest, requests, scenario_source, fragments)
    if version == 2:
        _validate_fragment_membership(fragments, requests, scenario_source)
    return Scenario(
        manifest=manifest,
        requests=requests,
        source=display_source,
        fragments=fragments,
    )


def _resolve_local_scenario(source: str | Path) -> Path:
    path = Path(source).expanduser()
    if path.is_dir():
        return path

    if isinstance(source, Path) or path.is_absolute() or len(path.parts) != 1:
        raise ScenarioError(f"Scenario directory does not exist: {path}")

    assets_path = Path(__file__).with_name("assets")
    if source == "default":
        if _is_scenario_directory(assets_path):
            return assets_path
        default_path = assets_path / "default"
        if _is_scenario_directory(default_path):
            return default_path
        candidates = sorted(
            candidate for candidate in assets_path.glob("*") if _is_scenario_directory(candidate)
        )
        if not candidates:
            raise ScenarioError("No bundled scenarios are installed")
        return candidates[0]

    bundled_path = assets_path / source
    if _is_scenario_directory(bundled_path):
        return bundled_path
    from phoenix.datagen.fetcher import AssetFetchError, fetch_scenario

    try:
        return fetch_scenario(source)
    except AssetFetchError as error:
        raise ScenarioError(f"Unable to resolve scenario {source!r}: {error}") from error


def _is_scenario_directory(path: Path) -> bool:
    return (path / "manifest.json").is_file() and (path / "traces.jsonl").is_file()


def _read_http_file(source: str, filename: str) -> bytes:
    base_url = source.rstrip("/") + "/"
    try:
        with httpx.Client(follow_redirects=True, timeout=30.0) as client:
            response = client.get(urljoin(base_url, filename))
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise ScenarioError(
            f"Unable to load scenario file {filename} from {source}: {error}"
        ) from error
    return bytes(response.content)


def _read_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise ScenarioError(f"Unable to read scenario file {path}: {error}") from error


def _parse_manifest(content: bytes, source: str) -> Mapping[str, Any]:
    try:
        manifest = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ScenarioError(f"Invalid manifest.json in {source}: {error}") from error
    if not isinstance(manifest, dict):
        raise ScenarioError(f"manifest.json in {source} must contain a JSON object")
    if not manifest:
        raise ScenarioError(f"manifest.json in {source} must not be empty")
    return manifest


def _parse_requests(content: bytes, source: str) -> tuple[ExportTraceServiceRequest, ...]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ScenarioError(f"Invalid UTF-8 in traces.jsonl in {source}: {error}") from error
    requests = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        request = ExportTraceServiceRequest()
        try:
            Parse(line, request)
        except ParseError as error:
            raise ScenarioError(
                f"Invalid traces.jsonl entry in {source} at line {line_number}: {error}"
            ) from error
        if not any(_iter_spans(request)):
            raise ScenarioError(
                f"traces.jsonl entry in {source} at line {line_number} contains no spans"
            )
        requests.append(request)
    if not requests:
        raise ScenarioError(f"traces.jsonl in {source} contains no requests")
    return tuple(requests)


def _validate_manifest_v2(manifest: Mapping[str, Any], source: str) -> ScenarioManifestV2:
    try:
        return validate_manifest_v2(manifest)
    except SchemaValidationError as error:
        raise ScenarioError(f"manifest.json in {source} field {error.field!r} {error}") from error


def _parse_fragments(content: bytes, source: str) -> tuple[Fragment, ...]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ScenarioError(f"Invalid UTF-8 in fragments.jsonl in {source}: {error}") from error
    fragments = []
    for line_number, line in enumerate(text.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ScenarioError(
                f"Invalid fragments.jsonl entry in {source} at line {line_number}: {error}"
            ) from error
        if not isinstance(value, dict):
            raise ScenarioError(
                f"fragments.jsonl in {source} at line {line_number} must contain a JSON object"
            )
        try:
            fragments.append(validate_fragment_v2(value))
        except SchemaValidationError as error:
            raise ScenarioError(
                f"fragments.jsonl in {source} at line {line_number} field {error.field!r} {error}"
            ) from error
    if not fragments:
        raise ScenarioError(f"fragments.jsonl in {source} contains no fragments")
    return tuple(fragments)


def _validate_file_metadata(
    manifest: ScenarioManifestV2, filename: str, content: bytes, source: str
) -> None:
    metadata = manifest["files"][filename]
    actual_size = len(content)
    if metadata["size_bytes"] != actual_size:
        raise ScenarioError(
            f"manifest.json in {source} field 'files.{filename}.size_bytes' declares "
            f"{metadata['size_bytes']!r}, but read {actual_size}"
        )
    actual_digest = sha256(content).hexdigest()
    if metadata["sha256"] != actual_digest:
        raise ScenarioError(
            f"manifest.json in {source} field 'files.{filename}.sha256' does not match "
            f"the file digest"
        )


def _validate_counts(
    manifest: Mapping[str, Any],
    requests: Sequence[ExportTraceServiceRequest],
    source: str,
    fragments: Sequence[Fragment] = (),
) -> None:
    spans = tuple(span for request in requests for span in _iter_spans(request))
    for span in spans:
        if len(span.trace_id) != 16:
            raise ScenarioError(f"A span in {source} has a trace ID that is not 16 bytes")
        if len(span.span_id) != 8:
            raise ScenarioError(f"A span in {source} has a span ID that is not 8 bytes")

    trace_count = len({span.trace_id for span in spans})
    expected_counts = {
        "trace_count": trace_count,
        "span_count": len(spans),
    }
    if manifest.get("schema_version") == 2:
        expected_counts["fragment_count"] = len(fragments)
    for field, actual in expected_counts.items():
        expected = manifest.get(field)
        if expected is not None and (not isinstance(expected, int) or expected != actual):
            raise ScenarioError(
                f"manifest.json in {source} declares {field}={expected!r}, but parsed {actual}"
            )

    if manifest.get("schema_version") == 2:
        actual_span_kinds = {
            attribute.value.string_value
            for span in spans
            for attribute in span.attributes
            if attribute.key == "openinference.span.kind" and attribute.value.string_value
        }
        expected_span_kinds = set(manifest["span_kinds"])
        if expected_span_kinds != actual_span_kinds:
            raise ScenarioError(
                f"manifest.json in {source} field 'span_kinds' declares "
                f"{sorted(expected_span_kinds)!r}, but parsed {sorted(actual_span_kinds)!r}"
            )


def _validate_fragment_membership(
    fragments: Sequence[Fragment],
    requests: Sequence[ExportTraceServiceRequest],
    source: str,
) -> None:
    parsed_trace_ids = {next(_iter_spans(request)).trace_id.hex() for request in requests}
    owner_by_trace_id: dict[str, str] = {}
    fragment_ids: set[str] = set()
    for fragment in fragments:
        if fragment.fragment_id in fragment_ids:
            raise ScenarioError(
                f"fragments.jsonl in {source} field 'fragment_id' contains duplicate "
                f"fragment {fragment.fragment_id!r}"
            )
        fragment_ids.add(fragment.fragment_id)
        for trace_id in fragment.trace_ids:
            if trace_id not in parsed_trace_ids:
                raise ScenarioError(
                    f"fragments.jsonl in {source} fragment {fragment.fragment_id!r} field "
                    f"'trace_ids' references unknown trace ID {trace_id!r}"
                )
            if owner := owner_by_trace_id.get(trace_id):
                raise ScenarioError(
                    f"fragments.jsonl in {source} fragment {fragment.fragment_id!r} field "
                    f"'trace_ids' also assigns trace ID {trace_id!r} owned by fragment {owner!r}"
                )
            owner_by_trace_id[trace_id] = fragment.fragment_id
    unassigned = sorted(parsed_trace_ids - owner_by_trace_id.keys())
    if unassigned:
        raise ScenarioError(
            f"fragments.jsonl in {source} field 'trace_ids' does not assign parsed trace IDs "
            f"{unassigned!r}"
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
