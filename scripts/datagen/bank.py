"""Build and inspect canonical v2 datagen bank archives."""

from __future__ import annotations

import gzip
import json
import os
import tarfile
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Iterator, Mapping, Sequence

from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span
from phoenix.datagen.schema import (
    ComposerDefaults,
    Fragment,
    ScenarioManifestV2,
    SchemaValidationError,
    validate_fragment_v2,
    validate_manifest_v2,
)

from scripts.datagen.generation import GenerationError, GenerationRun
from scripts.datagen.quality import (
    JUDGE_SAMPLE_FRACTION,
    LONG_FRAGMENT_RULE,
    NORMALIZER_VERSION,
    SHORT_FRAGMENT_RULE,
)

_BANK_FILES = ("manifest.json", "fragments.jsonl", "traces.jsonl")


@dataclass(frozen=True)
class V2Bank:
    manifest: ScenarioManifestV2
    fragments: tuple[Fragment, ...]
    traces_bytes: bytes


@dataclass(frozen=True)
class BankPackage:
    path: Path
    sha256: str
    size_bytes: int
    manifest: ScenarioManifestV2


class BankError(ValueError):
    """Raised when staged data cannot form a valid v2 bank."""


def package_generation_run(
    run_dir: Path,
    destination: Path,
    *,
    scenario_name: str,
    generated_at: str,
    generation_revision: str,
    instrumenter_package_versions: Mapping[str, str],
    composer_defaults: ComposerDefaults | None = None,
) -> BankPackage:
    """Package accepted run fragments and their raw staged OTLP requests atomically."""
    run = GenerationRun.resume(run_dir)
    accepted = run.accepted_records
    judgments = run.judgment_records
    rows = []
    trace_parts = []
    for cell in run.cells:
        record = accepted.get(cell.cell_id)
        if record is None:
            continue
        raw_fragment = record.get("fragment")
        if not isinstance(raw_fragment, Mapping):
            raise BankError(f"accepted cell {cell.cell_id} has no fragment object")
        judgment = judgments.get(cell.cell_id)
        if judgment is None:
            raise BankError(f"accepted cell {cell.cell_id} has no terminal judgment route")
        quality_results = raw_fragment.get("quality_results")
        projected_fragment = {
            **raw_fragment,
            "quality_results": {
                **(dict(quality_results) if isinstance(quality_results, Mapping) else {}),
                "judged_outcome": _judged_outcome_projection(cell.cell_id, judgment),
            },
        }
        try:
            fragment = validate_fragment_v2(projected_fragment)
        except SchemaValidationError as error:
            raise BankError(
                f"accepted cell {cell.cell_id} fragment field {error.field!r} {error}"
            ) from error
        if fragment.fragment_id != cell.cell_id:
            raise BankError(
                f"accepted cell {cell.cell_id} has fragment_id {fragment.fragment_id!r}"
            )
        rows.append(_fragment_document(fragment))

        attempt_id = record.get("attempt_id")
        if not isinstance(attempt_id, str):
            raise BankError(f"accepted cell {cell.cell_id} has no attempt_id")
        try:
            attempt_number = int(attempt_id.rpartition(":")[2])
        except ValueError as error:
            raise BankError(f"accepted cell {cell.cell_id} has invalid attempt_id") from error
        trace_path = (
            run_dir / "staging" / cell.cell_id / f"attempt-{attempt_number}" / "traces.jsonl"
        )
        try:
            trace_content = trace_path.read_bytes()
        except OSError as error:
            raise BankError(
                f"unable to read staged traces for cell {cell.cell_id}: {error}"
            ) from error
        if not trace_content or not trace_content.endswith(b"\n"):
            raise BankError(f"staged traces for cell {cell.cell_id} must end with a newline")
        trace_parts.append(trace_content)

    if not rows:
        raise BankError("generation run has no accepted fragments")
    fragments_bytes = b"".join(_canonical_json(row) + b"\n" for row in rows)
    traces_bytes = b"".join(trace_parts)
    trace_ids, span_count, span_kinds = _trace_stats(traces_bytes)
    _validate_membership(rows, trace_ids)
    defaults = composer_defaults or _default_composer(rows)
    rejects = _read_jsonl(run_dir / "rejects.jsonl")
    judgment_summary = _judgment_summary(judgments.values(), judge_failures=run.judge_failure_count)
    manifest_value = {
        "schema_version": 2,
        "scenario_name": scenario_name,
        "generated_at": generated_at,
        "generation_revision": generation_revision,
        "matrix_sha256": run.config.matrix_sha256,
        "matrix_seed": run.config.matrix_seed,
        "fragment_count": len(rows),
        "trace_count": len(trace_ids),
        "span_count": span_count,
        "span_kinds": sorted(span_kinds),
        "instrumenter_package_versions": dict(sorted(instrumenter_package_versions.items())),
        "files": {
            "fragments.jsonl": _file_metadata(fragments_bytes),
            "traces.jsonl": _file_metadata(traces_bytes),
        },
        "quality_gate_summary": {
            "accepted": len(rows),
            "rejected": len(rejects),
            "normalizer_version": NORMALIZER_VERSION,
            "dedup_thresholds": {
                "short": SHORT_FRAGMENT_RULE.threshold,
                "long": LONG_FRAGMENT_RULE.threshold,
            },
            "judge_sample_fraction": JUDGE_SAMPLE_FRACTION,
            "judged_outcome": judgment_summary,
        },
        "composer_defaults": defaults,
    }
    try:
        manifest = validate_manifest_v2(manifest_value)
    except SchemaValidationError as error:
        raise BankError(f"manifest field {error.field!r} {error}") from error
    files = {
        "manifest.json": _canonical_json(manifest) + b"\n",
        "fragments.jsonl": fragments_bytes,
        "traces.jsonl": traces_bytes,
    }
    _write_archive_atomic(destination, scenario_name, files)
    archive_bytes = destination.read_bytes()
    return BankPackage(
        path=destination,
        sha256=sha256(archive_bytes).hexdigest(),
        size_bytes=len(archive_bytes),
        manifest=manifest,
    )


def read_v2_bank(source: Path) -> V2Bank:
    """Read and fully validate a v2 bank directory or archive."""
    if source.is_dir():
        try:
            files = {filename: (source / filename).read_bytes() for filename in _BANK_FILES}
        except OSError as error:
            raise BankError(f"unable to read bank {source}: {error}") from error
        expected_root = source.name
    else:
        files, expected_root = _read_archive(source)
    try:
        manifest_value = json.loads(files["manifest.json"])
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise BankError(f"invalid manifest.json in {source}: {error}") from error
    if not isinstance(manifest_value, dict):
        raise BankError(f"manifest.json in {source} must contain an object")
    try:
        manifest = validate_manifest_v2(manifest_value)
    except SchemaValidationError as error:
        raise BankError(f"manifest field {error.field!r} {error}") from error
    if source.is_file() and manifest["scenario_name"] != expected_root:
        raise BankError("archive root must equal manifest scenario_name")
    for filename in ("fragments.jsonl", "traces.jsonl"):
        metadata = manifest["files"][filename]
        content = files[filename]
        if len(content) != metadata["size_bytes"]:
            raise BankError(f"manifest files.{filename}.size_bytes does not match")
        if sha256(content).hexdigest() != metadata["sha256"]:
            raise BankError(f"manifest files.{filename}.sha256 does not match")

    fragments = _parse_fragments(files["fragments.jsonl"])
    trace_ids, span_count, span_kinds = _trace_stats(files["traces.jsonl"])
    _validate_membership([_fragment_document(fragment) for fragment in fragments], trace_ids)
    if manifest["fragment_count"] != len(fragments):
        raise BankError("manifest fragment_count does not match")
    if manifest["trace_count"] != len(trace_ids):
        raise BankError("manifest trace_count does not match")
    if manifest["span_count"] != span_count:
        raise BankError("manifest span_count does not match")
    if set(manifest["span_kinds"]) != span_kinds:
        raise BankError("manifest span_kinds does not match")
    return V2Bank(manifest=manifest, fragments=fragments, traces_bytes=files["traces.jsonl"])


def _read_archive(source: Path) -> tuple[dict[str, bytes], str]:
    try:
        with tarfile.open(source, mode="r:gz") as archive:
            members = archive.getmembers()
            if any(not member.isfile() for member in members):
                raise BankError("bank archive may contain only regular files")
            paths = [PurePosixPath(member.name) for member in members]
            if any(len(path.parts) != 2 for path in paths):
                raise BankError("bank archive must use one top-level scenario directory")
            roots = {path.parts[0] for path in paths}
            names = {path.parts[1] for path in paths}
            if len(roots) != 1 or names != set(_BANK_FILES) or len(members) != len(_BANK_FILES):
                raise BankError("bank archive must contain exactly the three canonical files")
            files = {}
            for member, path in zip(members, paths):
                handle = archive.extractfile(member)
                if handle is None:
                    raise BankError(f"unable to read archive member {member.name}")
                files[path.parts[1]] = handle.read()
            return files, roots.pop()
    except (OSError, tarfile.TarError) as error:
        raise BankError(f"unable to read bank archive {source}: {error}") from error


def _parse_fragments(content: bytes) -> tuple[Fragment, ...]:
    fragments = []
    fragment_ids: set[str] = set()
    try:
        lines = content.decode().splitlines()
    except UnicodeDecodeError as error:
        raise BankError("fragments.jsonl is not UTF-8") from error
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise BankError(f"invalid fragment at line {line_number}: {error}") from error
        if not isinstance(value, dict):
            raise BankError(f"fragment at line {line_number} must be an object")
        try:
            fragment = validate_fragment_v2(value)
        except SchemaValidationError as error:
            raise BankError(
                f"fragment at line {line_number} field {error.field!r} {error}"
            ) from error
        if fragment.fragment_id in fragment_ids:
            raise BankError(f"duplicate fragment_id {fragment.fragment_id!r}")
        fragment_ids.add(fragment.fragment_id)
        fragments.append(fragment)
    if not fragments:
        raise BankError("fragments.jsonl contains no fragments")
    return tuple(fragments)


def _trace_stats(content: bytes) -> tuple[set[str], int, set[str]]:
    trace_ids: set[str] = set()
    span_count = 0
    span_kinds: set[str] = set()
    for request in _parse_trace_requests(content):
        for span in _iter_spans(request):
            if len(span.trace_id) != 16:
                raise BankError("trace span has a non-16-byte traceId")
            if len(span.span_id) != 8:
                raise BankError("trace span has a non-8-byte spanId")
            trace_ids.add(span.trace_id.hex())
            span_count += 1
            span_kinds.update(
                attribute.value.string_value
                for attribute in span.attributes
                if attribute.key == "openinference.span.kind" and attribute.value.string_value
            )
    if not span_kinds:
        raise BankError("traces.jsonl contains no openinference.span.kind values")
    return trace_ids, span_count, span_kinds


def _parse_trace_requests(content: bytes) -> tuple[ExportTraceServiceRequest, ...]:
    try:
        lines = content.decode().splitlines()
    except UnicodeDecodeError as error:
        raise BankError("traces.jsonl is not UTF-8") from error
    requests = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        request = ExportTraceServiceRequest()
        try:
            Parse(line, request)
        except ParseError as error:
            raise BankError(
                f"invalid ExportTraceServiceRequest protobuf JSON at line {line_number}: {error}"
            ) from error
        if not any(_iter_spans(request)):
            raise BankError(f"trace request at line {line_number} contains no spans")
        requests.append(request)
    if not requests:
        raise BankError("traces.jsonl contains no requests")
    return tuple(requests)


def _iter_spans(request: ExportTraceServiceRequest) -> Iterator[Span]:
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _validate_membership(rows: Sequence[Mapping[str, Any]], trace_ids: set[str]) -> None:
    owners: dict[str, str] = {}
    for row in rows:
        for trace_id in row["trace_ids"]:
            if trace_id in owners:
                raise BankError(
                    f"trace_id {trace_id} belongs to both {owners[trace_id]} "
                    f"and {row['fragment_id']}"
                )
            owners[trace_id] = row["fragment_id"]
    missing = sorted(trace_ids - owners.keys())
    unknown = sorted(owners.keys() - trace_ids)
    if missing or unknown:
        raise BankError(
            f"fragment trace membership mismatch: unassigned={missing}, unknown={unknown}"
        )


def _fragment_document(fragment: Fragment) -> dict[str, Any]:
    return {
        "fragment_id": fragment.fragment_id,
        "archetype": fragment.archetype,
        "domain": fragment.domain,
        "topic": fragment.topic,
        "scenario_template": fragment.scenario_template,
        "persona": fragment.persona,
        "register": fragment.register,
        "quality_tier": fragment.quality_tier,
        "failure_mode": fragment.failure_mode,
        "length_band": fragment.length_band,
        "lane": fragment.lane,
        "models_used": [model.__dict__ for model in fragment.models_used],
        "turn_count": fragment.turn_count,
        "trace_ids": list(fragment.trace_ids),
        "content_sha256": fragment.content_sha256,
        "quality_results": dict(fragment.quality_results),
    }


def _judged_outcome_projection(cell_id: str, judgment: Mapping[str, Any]) -> dict[str, Any]:
    if judgment.get("fragment_id") != cell_id or judgment.get("cell_id") != cell_id:
        raise BankError(f"judgment identity does not match accepted cell {cell_id}")
    route_reason = judgment.get("route_reason")
    outcome = judgment.get("outcome")
    rationale = judgment.get("rationale")
    if route_reason not in {"trap_proximity", "baseline", "not_selected"}:
        raise BankError(f"accepted cell {cell_id} has an invalid judgment route")
    if route_reason == "not_selected":
        if outcome is not None or rationale is not None:
            raise BankError(f"unselected cell {cell_id} may not carry an outcome")
    elif outcome not in {"survived", "degraded", "failed"} or not isinstance(rationale, str):
        raise BankError(f"routed cell {cell_id} has no completed judgment")
    projected_fields = (
        "seeds_present",
        "engaged_seed_ids",
        "seed_proximity",
        "proximity_source",
        "targeted_seed_id",
        "seed_intensities",
        "route_reason",
        "outcome",
        "rationale",
        "contract_version",
        "prompt_sha256",
        "output_schema_sha256",
        "content_sha256",
        "attempt_id",
        "provider",
        "model",
    )
    return {field: judgment.get(field) for field in projected_fields}


def _judgment_summary(
    judgments: Iterable[Mapping[str, Any]],
    *,
    judge_failures: int,
) -> dict[str, Any]:
    records = tuple(judgments)
    routes = {reason: 0 for reason in ("trap_proximity", "baseline", "not_selected")}
    outcomes = {outcome: 0 for outcome in ("survived", "degraded", "failed")}
    for record in records:
        route = record.get("route_reason")
        outcome = record.get("outcome")
        if route in routes:
            routes[route] += 1
        if outcome in outcomes:
            outcomes[outcome] += 1
    return {
        "routes": routes,
        "judged": sum(outcomes.values()),
        "unjudged": sum(record.get("outcome") is None for record in records),
        "outcomes": outcomes,
        "judge_failures": judge_failures,
    }


def _default_composer(rows: Sequence[Mapping[str, Any]]) -> ComposerDefaults:
    archetypes = sorted({row["archetype"] for row in rows})
    return {
        "session_fragments_median": 2.0,
        "session_fragments_sigma": 1.0,
        "session_fragments_max": 24,
        "archetype_mix": {archetype: 1.0 for archetype in archetypes},
        "fragment_gap_median_seconds": 180.0,
        "fragment_gap_sigma": 0.9,
        "fragment_gap_max_seconds": 3600.0,
    }


def _file_metadata(content: bytes) -> dict[str, Any]:
    return {"sha256": sha256(content).hexdigest(), "size_bytes": len(content)}


def _canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def _read_jsonl(path: Path) -> list[Mapping[str, Any]]:
    try:
        lines = path.read_text().splitlines()
    except OSError as error:
        raise GenerationError(f"Unable to read journal {path}: {error}") from error
    values: list[Mapping[str, Any]] = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise GenerationError(f"Invalid JSON in {path} at line {line_number}") from error
        if not isinstance(value, dict):
            raise GenerationError(f"Expected object in {path} at line {line_number}")
        values.append(value)
    return values


def _write_archive_atomic(
    destination: Path, scenario_name: str, files: Mapping[str, bytes]
) -> None:
    if (
        not scenario_name
        or scenario_name in {".", ".."}
        or PurePosixPath(scenario_name).name != scenario_name
    ):
        raise BankError("scenario_name must be one safe path component")
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        dir=destination.parent, prefix=f".{destination.name}.", suffix=".tmp"
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as raw:
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                with tarfile.open(
                    fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT
                ) as archive:
                    for filename in _BANK_FILES:
                        content = files[filename]
                        info = tarfile.TarInfo(f"{scenario_name}/{filename}")
                        info.size = len(content)
                        info.mtime = 0
                        info.mode = 0o644
                        info.uid = 0
                        info.gid = 0
                        info.uname = ""
                        info.gname = ""
                        archive.addfile(info, fileobj=_BytesReader(content))
            raw.flush()
            os.fsync(raw.fileno())
        read_v2_bank(temporary)
        os.replace(temporary, destination)
        directory_descriptor = os.open(destination.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


class _BytesReader:
    def __init__(self, content: bytes) -> None:
        self._content = content
        self._position = 0

    def read(self, size: int = -1) -> bytes:
        if size < 0:
            size = len(self._content) - self._position
        start = self._position
        self._position = min(len(self._content), self._position + size)
        return self._content[start : self._position]
