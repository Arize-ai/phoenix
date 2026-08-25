"""Load recorded OTLP trace scenarios from a local directory or the scenario cache."""

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


def load_scenario(source: str | Path | None = None) -> Scenario:
    """Load a scenario: bundled assets, the sole published scenario, a name, or a directory."""
    scenario_path = (
        _resolve_default_scenario() if source is None else _resolve_local_scenario(source)
    )
    display_source = str(scenario_path)

    manifest = _parse_manifest(_read_bytes(scenario_path / "manifest.json"), display_source)
    version = manifest.get("schema_version")
    if type(version) is not int or version != 2:
        raise ScenarioError(f"manifest.json in {display_source} field 'schema_version' must be 2")
    manifest_v2 = _validate_manifest_v2(manifest, display_source)
    scenario_source = f"{manifest_v2['scenario_name']} ({display_source})"

    fragments = _parse_fragments(_read_bytes(scenario_path / "fragments.jsonl"), scenario_source)
    requests = _group_requests_by_trace_id(
        _parse_requests(_read_bytes(scenario_path / "traces.jsonl"), scenario_source)
    )
    _validate_fragment_trace_ids(fragments, requests, scenario_source)
    return Scenario(
        manifest=manifest_v2,
        requests=requests,
        source=display_source,
        fragments=fragments,
    )


def _resolve_default_scenario() -> Path:
    """Prefer a scenario bundled with the package; otherwise fetch the sole published one."""
    assets_root = Path(__file__).parent / "assets"
    bundled = sorted(
        entry for entry in assets_root.glob("*") if (entry / "manifest.json").is_file()
    )
    if len(bundled) == 1:
        return bundled[0]
    if len(bundled) > 1:
        names = sorted(entry.name for entry in bundled)
        raise ScenarioError(
            f"Multiple scenarios are bundled with this installation {names!r}; "
            "pass --scenario to choose one"
        )

    from phoenix.datagen.fetcher import ScenarioFetchError, fetch_scenario

    try:
        return fetch_scenario()
    except ScenarioFetchError as error:
        raise ScenarioError(f"Unable to resolve the default scenario: {error}") from error


def _resolve_local_scenario(source: str | Path) -> Path:
    path = Path(source).expanduser()
    if path.is_dir():
        return path

    if isinstance(source, Path) or path.is_absolute() or len(path.parts) != 1:
        raise ScenarioError(f"Scenario directory does not exist: {path}")

    from phoenix.datagen.fetcher import ScenarioFetchError, fetch_scenario

    try:
        return fetch_scenario(source)
    except ScenarioFetchError as error:
        raise ScenarioError(f"Unable to resolve scenario {source!r}: {error}") from error


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


def _validate_fragment_trace_ids(
    fragments: Sequence[Fragment],
    requests: Sequence[ExportTraceServiceRequest],
    source: str,
) -> None:
    parsed_trace_ids = {next(_iter_spans(request)).trace_id.hex() for request in requests}
    for fragment in fragments:
        for trace_id in fragment.trace_ids:
            if trace_id not in parsed_trace_ids:
                raise ScenarioError(
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
