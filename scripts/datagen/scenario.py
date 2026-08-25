"""Build and inspect canonical schema-v2 datagen corpus archives."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PurePosixPath
from typing import Any, Iterable, Mapping, Sequence, TextIO, cast

from google.protobuf.json_format import Parse, ParseError
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)

from phoenix.datagen.loader import Corpus, CorpusError, load_corpus
from phoenix.datagen.schema import (
    CorpusManifestV2,
    Fragment,
    SchemaValidationError,
    validate_corpus_manifest_v2,
    validate_fragment_v2,
)
from scripts.datagen.generation import GenerationError, GenerationRun
from scripts.datagen.quality import (
    JUDGE_SAMPLE_FRACTION,
    LONG_FRAGMENT_RULE,
    NORMALIZER_VERSION,
    SHORT_FRAGMENT_RULE,
)
from scripts.datagen.serialization import canonical_bytes, read_jsonl

_ARCHIVE_FILES = ("manifest.json", "fragments.jsonl", "traces.jsonl")
_STATIC_QUALITY_FIELDS = (
    "normalizer_version",
    "dedup_thresholds",
    "judge_sample_fraction",
)
_PROJECTED_JUDGMENT_FIELDS = (
    "seeds_present",
    "engaged_seed_ids",
    "seed_proximity",
    "proximity_source",
    "targeted_seed_id",
    "seed_intensities",
    "failure_mode",
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


@dataclass(frozen=True)
class CorpusArchive:
    manifest: CorpusManifestV2
    fragments: tuple[Fragment, ...]
    traces_bytes: bytes
    requests: tuple[ExportTraceServiceRequest, ...]


@dataclass(frozen=True)
class CorpusPackage:
    path: Path
    sha256: str
    size_bytes: int
    manifest: CorpusManifestV2


class CorpusArchiveError(ValueError):
    """Raised when staged data cannot form a valid schema-v2 corpus archive."""


def package_generation_run(
    run_dir: Path,
    destination: Path,
    *,
    generated_at: str,
    generation_revision: str,
    instrumenter_package_versions: Mapping[str, str],
) -> CorpusPackage:
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
            raise CorpusArchiveError(f"accepted cell {cell.cell_id} has no fragment object")
        judgment = judgments.get(cell.cell_id)
        if judgment is None:
            raise CorpusArchiveError(f"accepted cell {cell.cell_id} has no terminal judgment route")
        quality_results = raw_fragment.get("quality_results")
        projected_fragment = {
            **raw_fragment,
            "quality_results": {
                **(dict(quality_results) if isinstance(quality_results, Mapping) else {}),
                "judged_outcome": _judged_outcome_projection(judgment),
            },
        }
        try:
            fragment = validate_fragment_v2(projected_fragment)
        except SchemaValidationError as error:
            raise CorpusArchiveError(
                f"accepted cell {cell.cell_id} fragment field {error.field!r} {error}"
            ) from error
        if fragment.fragment_id != cell.cell_id:
            raise CorpusArchiveError(
                f"accepted cell {cell.cell_id} has fragment_id {fragment.fragment_id!r}"
            )
        rows.append(_fragment_document(fragment))

        attempt_id = record.get("attempt_id")
        if not isinstance(attempt_id, str):
            raise CorpusArchiveError(f"accepted cell {cell.cell_id} has no attempt_id")
        try:
            attempt_number = int(attempt_id.rpartition(":")[2])
        except ValueError as error:
            raise CorpusArchiveError(
                f"accepted cell {cell.cell_id} has invalid attempt_id"
            ) from error
        trace_path = (
            run_dir / "staging" / cell.cell_id / f"attempt-{attempt_number}" / "traces.jsonl"
        )
        try:
            trace_content = trace_path.read_bytes()
        except OSError as error:
            raise CorpusArchiveError(
                f"unable to read staged traces for cell {cell.cell_id}: {error}"
            ) from error
        if not trace_content or not trace_content.endswith(b"\n"):
            raise CorpusArchiveError(
                f"staged traces for cell {cell.cell_id} must end with a newline"
            )
        trace_parts.append(trace_content)

    if not rows:
        raise CorpusArchiveError("generation run has no accepted fragments")
    fragments_bytes = b"".join(canonical_bytes(row) + b"\n" for row in rows)
    traces_bytes = b"".join(trace_parts)
    trace_ids, span_count, span_kinds = _span_statistics(_parse_staged_requests(traces_bytes))
    _validate_membership(rows, trace_ids)
    rejects = read_jsonl(run_dir / "rejects.jsonl", error=CorpusArchiveError)
    judgment_summary = _judgment_summary(judgments.values(), judge_failures=run.judge_failure_count)
    quality_gate_summary: dict[str, Any] = {
        "accepted": len(rows),
        "rejected": len(rejects),
        "rejected_by_gate": _rejection_counts(rejects),
        "normalizer_version": NORMALIZER_VERSION,
        "dedup_thresholds": {
            "short": SHORT_FRAGMENT_RULE.threshold,
            "long": LONG_FRAGMENT_RULE.threshold,
        },
        "judge_sample_fraction": JUDGE_SAMPLE_FRACTION,
        "judged_outcome": judgment_summary,
    }
    if run.config.base_scenario_name is not None:
        quality_gate_summary["supplemental_lineage"] = {
            "base_scenario_name": run.config.base_scenario_name,
            "base_archive_sha256": run.config.base_archive_sha256,
        }
    manifest_value = {
        "schema_version": 2,
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
        "quality_gate_summary": quality_gate_summary,
    }
    return _write_package(
        destination,
        _validated_manifest(manifest_value),
        fragments_bytes=fragments_bytes,
        traces_bytes=traces_bytes,
    )


def merge_corpus_archives(
    base_source: Path, supplement_source: Path, destination: Path
) -> CorpusPackage:
    """Merge a supplemental corpus archive into its base corpus."""
    base_digest = _archive_sha256(base_source)
    supplement_digest = _archive_sha256(supplement_source)
    base = read_corpus_archive(base_source)
    supplement = read_corpus_archive(supplement_source)
    _validate_supplemental_lineage(base, base_digest, supplement)
    _validate_merge_compatibility(base.manifest, supplement.manifest)

    base_fragment_ids = {fragment.fragment_id for fragment in base.fragments}
    duplicate_fragment_ids = sorted(
        base_fragment_ids.intersection(fragment.fragment_id for fragment in supplement.fragments)
    )
    if duplicate_fragment_ids:
        raise CorpusArchiveError(
            f"duplicate fragment IDs across merge inputs: {duplicate_fragment_ids}"
        )
    base_trace_ids = {trace_id for fragment in base.fragments for trace_id in fragment.trace_ids}
    duplicate_trace_ids = sorted(
        base_trace_ids.intersection(
            trace_id for fragment in supplement.fragments for trace_id in fragment.trace_ids
        )
    )
    if duplicate_trace_ids:
        raise CorpusArchiveError(f"duplicate trace IDs across merge inputs: {duplicate_trace_ids}")

    fragments = (*base.fragments, *supplement.fragments)
    rows = [_fragment_document(fragment) for fragment in fragments]
    fragments_bytes = b"".join(canonical_bytes(row) + b"\n" for row in rows)
    traces_bytes = _concatenate_jsonl(base.traces_bytes, supplement.traces_bytes)
    trace_ids, span_count, span_kinds = _span_statistics((*base.requests, *supplement.requests))
    _validate_membership(rows, trace_ids)
    quality_gate_summary = _merge_quality_summaries(
        base.manifest,
        supplement.manifest,
        base_digest=base_digest,
        supplement_digest=supplement_digest,
        fragment_count=len(rows),
    )
    manifest_value = {
        "schema_version": 2,
        "generated_at": supplement.manifest["generated_at"],
        "generation_revision": supplement.manifest["generation_revision"],
        "matrix_sha256": _merged_matrix_sha256(base.manifest, supplement.manifest),
        "matrix_seed": base.manifest["matrix_seed"],
        "fragment_count": len(rows),
        "trace_count": len(trace_ids),
        "span_count": span_count,
        "span_kinds": sorted(span_kinds),
        "instrumenter_package_versions": dict(
            sorted(base.manifest["instrumenter_package_versions"].items())
        ),
        "files": {
            "fragments.jsonl": _file_metadata(fragments_bytes),
            "traces.jsonl": _file_metadata(traces_bytes),
        },
        "quality_gate_summary": quality_gate_summary,
    }
    return _write_package(
        destination,
        _validated_manifest(manifest_value),
        fragments_bytes=fragments_bytes,
        traces_bytes=traces_bytes,
    )


def _validated_manifest(value: Mapping[str, Any]) -> CorpusManifestV2:
    try:
        return validate_corpus_manifest_v2(value)
    except SchemaValidationError as error:
        raise CorpusArchiveError(f"manifest field {error.field!r} {error}") from error


def _write_package(
    destination: Path,
    manifest: CorpusManifestV2,
    *,
    fragments_bytes: bytes,
    traces_bytes: bytes,
) -> CorpusPackage:
    files = {
        "manifest.json": canonical_bytes(manifest) + b"\n",
        "fragments.jsonl": fragments_bytes,
        "traces.jsonl": traces_bytes,
    }
    _write_archive_atomic(destination, files)
    archive_bytes = destination.read_bytes()
    return CorpusPackage(
        path=destination,
        sha256=sha256(archive_bytes).hexdigest(),
        size_bytes=len(archive_bytes),
        manifest=manifest,
    )


def _archive_sha256(source: Path) -> str:
    try:
        return sha256(source.read_bytes()).hexdigest()
    except OSError as error:
        raise CorpusArchiveError(f"unable to read corpus archive {source}: {error}") from error


def _validate_supplemental_lineage(
    base: CorpusArchive, base_digest: str, supplement: CorpusArchive
) -> None:
    lineage = supplement.manifest["quality_gate_summary"].get("supplemental_lineage")
    if not isinstance(lineage, Mapping):
        raise CorpusArchiveError("supplement quality_gate_summary.supplemental_lineage is required")
    if lineage.get("base_archive_sha256") != base_digest:
        raise CorpusArchiveError("supplement base archive SHA-256 does not match the base archive")


def _validate_merge_compatibility(base: CorpusManifestV2, supplement: CorpusManifestV2) -> None:
    base_summary = base["quality_gate_summary"]
    supplement_summary = supplement["quality_gate_summary"]
    for field in _STATIC_QUALITY_FIELDS:
        if field not in base_summary or field not in supplement_summary:
            raise CorpusArchiveError(f"merge inputs must declare quality_gate_summary.{field}")
        if base_summary[field] != supplement_summary[field]:
            raise CorpusArchiveError(f"merge inputs have incompatible quality_gate_summary.{field}")


def _merge_quality_summaries(
    base: CorpusManifestV2,
    supplement: CorpusManifestV2,
    *,
    base_digest: str,
    supplement_digest: str,
    fragment_count: int,
) -> dict[str, Any]:
    base_summary = base["quality_gate_summary"]
    supplement_summary = supplement["quality_gate_summary"]
    summary = {
        "accepted": fragment_count,
        "rejected": _quality_count(base_summary, "rejected", "base")
        + _quality_count(supplement_summary, "rejected", "supplement"),
        "rejected_by_gate": _merge_count_maps(
            base_summary.get("rejected_by_gate"),
            supplement_summary.get("rejected_by_gate"),
            field="rejected_by_gate",
        ),
        "judged_outcome": _merge_judgment_summaries(
            base_summary.get("judged_outcome"), supplement_summary.get("judged_outcome")
        ),
        "merge_lineage": {
            "base": _archive_lineage(base, base_digest),
            "supplement": _archive_lineage(supplement, supplement_digest),
        },
    }
    for field in _STATIC_QUALITY_FIELDS:
        summary[field] = base_summary[field]
    return summary


def _archive_lineage(manifest: CorpusManifestV2, archive_digest: str) -> dict[str, Any]:
    return {
        "archive_sha256": archive_digest,
        "matrix_sha256": manifest["matrix_sha256"],
        "matrix_seed": manifest["matrix_seed"],
        "generation_revision": manifest["generation_revision"],
        "fragment_count": manifest["fragment_count"],
        "trace_count": manifest["trace_count"],
        "instrumenter_package_versions": dict(
            sorted(manifest["instrumenter_package_versions"].items())
        ),
    }


def _quality_count(summary: Mapping[str, Any], field: str, source: str) -> int:
    value = summary.get(field)
    if type(value) is not int or value < 0:
        raise CorpusArchiveError(
            f"{source} quality_gate_summary.{field} must be a non-negative integer"
        )
    return value


def _merge_count_maps(
    base: Any, supplement: Any, *, field: str, required_keys: Sequence[str] = ()
) -> dict[str, int]:
    counts = {key: 0 for key in required_keys}
    for source, value in (("base", base), ("supplement", supplement)):
        if not isinstance(value, Mapping):
            raise CorpusArchiveError(f"{source} quality_gate_summary.{field} must be an object")
        for key, count in value.items():
            if not isinstance(key, str) or not key or type(count) is not int or count < 0:
                raise CorpusArchiveError(
                    f"{source} quality_gate_summary.{field} must map names to non-negative integers"
                )
            counts[key] = counts.get(key, 0) + count
    return dict(sorted(counts.items()))


def _merge_judgment_summaries(base: Any, supplement: Any) -> dict[str, Any]:
    for source, value in (("base", base), ("supplement", supplement)):
        if not isinstance(value, Mapping):
            raise CorpusArchiveError(
                f"{source} quality_gate_summary.judged_outcome must be an object"
            )
    assert isinstance(base, Mapping) and isinstance(supplement, Mapping)
    return {
        "routes": _merge_count_maps(
            base.get("routes"),
            supplement.get("routes"),
            field="judged_outcome.routes",
            required_keys=("fault", "trap_proximity", "baseline", "not_selected"),
        ),
        "judged": _quality_count(base, "judged", "base judged_outcome")
        + _quality_count(supplement, "judged", "supplement judged_outcome"),
        "unjudged": _quality_count(base, "unjudged", "base judged_outcome")
        + _quality_count(supplement, "unjudged", "supplement judged_outcome"),
        "outcomes": _merge_count_maps(
            base.get("outcomes"),
            supplement.get("outcomes"),
            field="judged_outcome.outcomes",
            required_keys=("survived", "degraded", "failed"),
        ),
        "judge_failures": _quality_count(base, "judge_failures", "base judged_outcome")
        + _quality_count(supplement, "judge_failures", "supplement judged_outcome"),
    }


def _merged_matrix_sha256(base: CorpusManifestV2, supplement: CorpusManifestV2) -> str:
    document = {
        "base_matrix_sha256": base["matrix_sha256"],
        "supplement_matrix_sha256": supplement["matrix_sha256"],
    }
    return sha256(canonical_bytes(document)).hexdigest()


def _concatenate_jsonl(*parts: bytes) -> bytes:
    return b"".join(part if part.endswith(b"\n") else part + b"\n" for part in parts)


def _rejection_counts(rejects: Sequence[Mapping[str, Any]]) -> Mapping[str, int]:
    counts: dict[str, int] = {}
    for reject in rejects:
        gate = reject.get("gate", "generation")
        name = gate if isinstance(gate, str) and gate else "generation"
        counts[name] = counts.get(name, 0) + 1
    return dict(sorted(counts.items()))


def read_corpus_archive(source: Path) -> CorpusArchive:
    """Read a corpus directory or archive and apply every publish-time check."""
    if source.is_dir():
        try:
            files = {filename: (source / filename).read_bytes() for filename in _ARCHIVE_FILES}
        except OSError as error:
            raise CorpusArchiveError(f"unable to read corpus {source}: {error}") from error
    else:
        files = _read_archive(source)
    corpus = _load_extracted(files, source)
    manifest = cast(CorpusManifestV2, corpus.manifest)
    for filename in ("fragments.jsonl", "traces.jsonl"):
        metadata = manifest["files"][filename]
        content = files[filename]
        if len(content) != metadata["size_bytes"]:
            raise CorpusArchiveError(f"manifest files.{filename}.size_bytes does not match")
        if sha256(content).hexdigest() != metadata["sha256"]:
            raise CorpusArchiveError(f"manifest files.{filename}.sha256 does not match")

    fragments = tuple(corpus.fragments)
    requests = tuple(corpus.requests)
    trace_ids, span_count, span_kinds = _span_statistics(requests)
    _validate_membership([_fragment_document(fragment) for fragment in fragments], trace_ids)
    if manifest["fragment_count"] != len(fragments):
        raise CorpusArchiveError("manifest fragment_count does not match")
    if manifest["trace_count"] != len(trace_ids):
        raise CorpusArchiveError("manifest trace_count does not match")
    if manifest["span_count"] != span_count:
        raise CorpusArchiveError("manifest span_count does not match")
    if set(manifest["span_kinds"]) != span_kinds:
        raise CorpusArchiveError("manifest span_kinds does not match")
    return CorpusArchive(
        manifest=manifest,
        fragments=fragments,
        traces_bytes=files["traces.jsonl"],
        requests=requests,
    )


def _load_extracted(files: Mapping[str, bytes], source: Path) -> Corpus:
    with tempfile.TemporaryDirectory(prefix="phoenix-datagen-corpus-") as directory:
        extracted = Path(directory)
        for filename, content in files.items():
            (extracted / filename).write_bytes(content)
        try:
            return load_corpus(extracted)
        except CorpusError as error:
            raise CorpusArchiveError(f"invalid corpus {source}: {error}") from error


def _read_archive(source: Path) -> dict[str, bytes]:
    try:
        with tarfile.open(source, mode="r:gz") as archive:
            members = archive.getmembers()
            if any(not member.isfile() for member in members):
                raise CorpusArchiveError("corpus archive may contain only regular files")
            paths = [PurePosixPath(member.name) for member in members]
            if any(len(path.parts) != 2 for path in paths):
                raise CorpusArchiveError("corpus archive must use one top-level directory")
            roots = {path.parts[0] for path in paths}
            names = {path.parts[1] for path in paths}
            if (
                len(roots) != 1
                or names != set(_ARCHIVE_FILES)
                or len(members) != len(_ARCHIVE_FILES)
            ):
                raise CorpusArchiveError(
                    "corpus archive must contain exactly the three canonical files"
                )
            files = {}
            for member, path in zip(members, paths):
                handle = archive.extractfile(member)
                if handle is None:
                    raise CorpusArchiveError(f"unable to read archive member {member.name}")
                files[path.parts[1]] = handle.read()
            return files
    except (OSError, tarfile.TarError) as error:
        raise CorpusArchiveError(f"unable to read corpus archive {source}: {error}") from error


def _parse_staged_requests(content: bytes) -> tuple[ExportTraceServiceRequest, ...]:
    try:
        lines = content.decode().splitlines()
    except UnicodeDecodeError as error:
        raise CorpusArchiveError("staged traces are not UTF-8") from error
    requests = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        request = ExportTraceServiceRequest()
        try:
            Parse(line, request)
        except ParseError as error:
            raise CorpusArchiveError(
                f"invalid ExportTraceServiceRequest protobuf JSON at line {line_number}: {error}"
            ) from error
        requests.append(request)
    return tuple(requests)


def _span_statistics(
    requests: Iterable[ExportTraceServiceRequest],
) -> tuple[set[str], int, set[str]]:
    trace_ids: set[str] = set()
    span_count = 0
    span_kinds: set[str] = set()
    for request in requests:
        for resource_spans in request.resource_spans:
            for scope_spans in resource_spans.scope_spans:
                for span in scope_spans.spans:
                    trace_ids.add(span.trace_id.hex())
                    span_count += 1
                    span_kinds.update(
                        attribute.value.string_value
                        for attribute in span.attributes
                        if attribute.key == "openinference.span.kind"
                        and attribute.value.string_value
                    )
    return trace_ids, span_count, span_kinds


def _validate_membership(rows: Sequence[Mapping[str, Any]], trace_ids: set[str]) -> None:
    owners: dict[str, str] = {}
    for row in rows:
        for trace_id in row["trace_ids"]:
            if trace_id in owners:
                raise CorpusArchiveError(
                    f"trace_id {trace_id} belongs to both {owners[trace_id]} "
                    f"and {row['fragment_id']}"
                )
            owners[trace_id] = row["fragment_id"]
    missing = sorted(trace_ids - owners.keys())
    unknown = sorted(owners.keys() - trace_ids)
    if missing or unknown:
        raise CorpusArchiveError(
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


def _judged_outcome_projection(judgment: Mapping[str, Any]) -> dict[str, Any]:
    projection = {field: judgment.get(field) for field in _PROJECTED_JUDGMENT_FIELDS}
    projection["failure_mode"] = judgment.get("failure_mode", "none")
    return projection


def _judgment_summary(
    judgments: Iterable[Mapping[str, Any]],
    *,
    judge_failures: int,
) -> dict[str, Any]:
    records = tuple(judgments)
    routes = {reason: 0 for reason in ("fault", "trap_proximity", "baseline", "not_selected")}
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


def _file_metadata(content: bytes) -> dict[str, Any]:
    return {"sha256": sha256(content).hexdigest(), "size_bytes": len(content)}


def _write_archive_atomic(destination: Path, files: Mapping[str, bytes]) -> None:
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
                    for filename in _ARCHIVE_FILES:
                        content = files[filename]
                        info = tarfile.TarInfo(f"corpus/{filename}")
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
        read_corpus_archive(temporary)
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    package = subparsers.add_parser("package", help="package one completed generation run")
    package.add_argument("run_dir", type=Path)
    package.add_argument("--archive", type=Path, required=True)
    package.add_argument("--generated-at", required=True)
    package.add_argument("--generation-revision", required=True)
    package.add_argument(
        "--instrumenter-package",
        action="append",
        required=True,
        metavar="NAME=VERSION",
        help="record an instrumenter distribution version; repeat for every recorder dependency",
    )

    merge = subparsers.add_parser("merge", help="merge a supplemental corpus into its base")
    merge.add_argument("--base", type=Path, required=True)
    merge.add_argument("--supplement", type=Path, required=True)
    merge.add_argument("--archive", type=Path, required=True)
    return parser


def command(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "package":
            package = package_generation_run(
                args.run_dir,
                args.archive,
                generated_at=args.generated_at,
                generation_revision=args.generation_revision,
                instrumenter_package_versions=_parse_instrumenter_versions(
                    args.instrumenter_package
                ),
            )
        elif args.command == "merge":
            package = merge_corpus_archives(args.base, args.supplement, args.archive)
        else:
            raise AssertionError(args.command)
    except (CorpusArchiveError, GenerationError, OSError, ValueError) as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}), file=stderr)
        return 2
    print(json.dumps(_package_document(package), indent=2, sort_keys=True), file=stdout)
    return 0


def _parse_instrumenter_versions(values: Sequence[str]) -> Mapping[str, str]:
    versions: dict[str, str] = {}
    for value in values:
        name, separator, version = value.partition("=")
        if not separator or not name or not version:
            raise ValueError("--instrumenter-package must use NAME=VERSION")
        if name in versions:
            raise ValueError(f"duplicate instrumenter package {name!r}")
        versions[name] = version
    return versions


def _package_document(package: CorpusPackage) -> dict[str, Any]:
    return {
        "archive": str(package.path),
        "sha256": package.sha256,
        "size_bytes": package.size_bytes,
        "fragment_count": package.manifest["fragment_count"],
        "trace_count": package.manifest["trace_count"],
    }


if __name__ == "__main__":
    raise SystemExit(command())
