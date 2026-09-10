"""Build a replay corpus from recorded fragment and trace rows."""

from __future__ import annotations

import argparse
import gzip
import io
import json
import os
import sys
import tarfile
import tempfile
from collections import Counter
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from statistics import fmean, median
from typing import Any, Iterator, Mapping, Sequence, TextIO

from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import (
    ExportTraceServiceRequest,
)
from opentelemetry.proto.trace.v1.trace_pb2 import Span

from phoenix.experimental.datagen.loader import Corpus, CorpusError, load_corpus

_ARCHIVE_MEMBERS = ("fragments.jsonl", "traces.jsonl")
_FRAGMENT_FIELDS = ("fragment_id", "archetype", "domain", "trace_ids")
_SPAN_KIND = "openinference.span.kind"
_SESSION_ID = "session.id"
_INPUT_VALUE = "input.value"


@dataclass(frozen=True)
class CorpusPackage:
    path: Path
    sha256: str
    size_bytes: int
    fragment_count: int
    trace_count: int
    span_count: int
    span_kind_counts: Mapping[str, int]
    span_kind_shares: Mapping[str, float]
    spans_per_trace: Mapping[str, int | float]
    tool_span_count: int
    tool_span_share: float
    llm_turns_by_session: Mapping[str, int]
    llm_turns_per_session: Mapping[str, int | float]
    opening_diversity_by_domain: Mapping[str, Mapping[str, int]]


class CorpusArchiveError(ValueError):
    """Raised when recorded rows cannot form a corpus archive."""


def package_corpus(source: Path, destination: Path) -> CorpusPackage:
    """Package recorded rows atomically and verify the completed archive."""
    fragments_bytes = _project_fragments(_read_bytes(source / "fragments.jsonl"))
    traces_bytes = _read_bytes(source / "traces.jsonl")
    corpus = _write_archive_atomic(
        destination,
        {
            "fragments.jsonl": fragments_bytes,
            "traces.jsonl": traces_bytes,
        },
    )
    archive_bytes = destination.read_bytes()
    statistics = _corpus_statistics(corpus)
    return CorpusPackage(
        path=destination,
        sha256=sha256(archive_bytes).hexdigest(),
        size_bytes=len(archive_bytes),
        fragment_count=len(corpus.fragments),
        trace_count=len(corpus.requests),
        **statistics,
    )


def _corpus_statistics(corpus: Corpus) -> dict[str, Any]:
    spans_per_trace = [sum(1 for _ in _iter_spans(request)) for request in corpus.requests]
    span_kind_counts: Counter[str] = Counter()
    llm_turns_by_session: Counter[str] = Counter()
    for request in corpus.requests:
        for span in _iter_spans(request):
            span_kind = _string_attribute(span, _SPAN_KIND) or "UNKNOWN"
            span_kind_counts[span_kind] += 1
            if session_id := _string_attribute(span, _SESSION_ID):
                llm_turns_by_session.setdefault(session_id, 0)
                if span_kind == "LLM":
                    llm_turns_by_session[session_id] += 1

    openings_by_domain: dict[str, set[str]] = {}
    fragments_by_domain: Counter[str] = Counter()
    for fragment in corpus.fragments:
        fragments_by_domain[fragment.domain] += 1
        request = corpus.requests_by_trace_id.get(fragment.trace_ids[0])
        if request is None:
            continue
        for span in _iter_spans(request):
            if span.parent_span_id:
                continue
            if opening := _string_attribute(span, _INPUT_VALUE):
                openings_by_domain.setdefault(fragment.domain, set()).add(opening[:200])
                break

    span_count = sum(span_kind_counts.values())
    span_kind_counts.setdefault("TOOL", 0)
    span_kind_shares = {
        span_kind: count / span_count for span_kind, count in span_kind_counts.items()
    }
    tool_span_count = span_kind_counts["TOOL"]
    return {
        "span_count": span_count,
        "span_kind_counts": dict(span_kind_counts),
        "span_kind_shares": span_kind_shares,
        "spans_per_trace": _distribution(spans_per_trace),
        "tool_span_count": tool_span_count,
        "tool_span_share": tool_span_count / span_count,
        "llm_turns_by_session": dict(llm_turns_by_session),
        "llm_turns_per_session": _distribution(list(llm_turns_by_session.values())),
        "opening_diversity_by_domain": {
            domain: {
                "fragments": fragments_by_domain[domain],
                "distinct_openings": len(openings_by_domain.get(domain, set())),
            }
            for domain in sorted(fragments_by_domain)
        },
    }


def _iter_spans(request: ExportTraceServiceRequest) -> Iterator[Span]:
    for resource_spans in request.resource_spans:
        for scope_spans in resource_spans.scope_spans:
            yield from scope_spans.spans


def _string_attribute(span: Span, key: str) -> str | None:
    attribute = next((attribute for attribute in span.attributes if attribute.key == key), None)
    if attribute is None or attribute.value.WhichOneof("value") != "string_value":
        return None
    return attribute.value.string_value or None


def _distribution(values: Sequence[int]) -> dict[str, int | float]:
    if not values:
        return {}
    return {
        "min": min(values),
        "median": median(values),
        "mean": fmean(values),
        "max": max(values),
    }


def _read_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise CorpusArchiveError(f"unable to read recorded corpus file {path}: {error}") from error


def _project_fragments(content: bytes) -> bytes:
    try:
        lines = content.decode("utf-8").splitlines()
    except UnicodeDecodeError as error:
        raise CorpusArchiveError(f"fragments.jsonl is not valid UTF-8: {error}") from error
    documents = []
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise CorpusArchiveError(
                f"invalid fragments.jsonl entry at line {line_number}: {error}"
            ) from error
        if not isinstance(value, Mapping):
            raise CorpusArchiveError(
                f"fragments.jsonl entry at line {line_number} must be a JSON object"
            )
        documents.append({field: value[field] for field in _FRAGMENT_FIELDS if field in value})
    if not documents:
        raise CorpusArchiveError("fragments.jsonl contains no fragments")
    return b"".join(_canonical_bytes(document) + b"\n" for document in documents)


def _canonical_bytes(value: Mapping[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def _write_archive_atomic(destination: Path, files: Mapping[str, bytes]) -> Corpus:
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
                    for filename in _ARCHIVE_MEMBERS:
                        content = files[filename]
                        info = tarfile.TarInfo(filename)
                        info.size = len(content)
                        info.mtime = 0
                        info.mode = 0o644
                        info.uid = 0
                        info.gid = 0
                        info.uname = ""
                        info.gname = ""
                        archive.addfile(info, fileobj=io.BytesIO(content))
            raw.flush()
            os.fsync(raw.fileno())
        try:
            corpus = load_corpus(temporary)
        except CorpusError as error:
            raise CorpusArchiveError(f"invalid corpus: {error}") from error
        os.replace(temporary, destination)
        directory_descriptor = os.open(destination.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
        return corpus
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="directory containing recorded corpus rows")
    parser.add_argument("--archive", type=Path, required=True)
    return parser


def command(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO = sys.stdout,
    stderr: TextIO = sys.stderr,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        package = package_corpus(args.source, args.archive)
    except (CorpusArchiveError, OSError, ValueError) as error:
        print(json.dumps({"error": type(error).__name__, "message": str(error)}), file=stderr)
        return 2
    print(json.dumps(_package_document(package), indent=2, sort_keys=True), file=stdout)
    return 0


def _package_document(package: CorpusPackage) -> dict[str, Any]:
    return {
        "archive": str(package.path),
        "sha256": package.sha256,
        "size_bytes": package.size_bytes,
        "fragment_count": package.fragment_count,
        "trace_count": package.trace_count,
        "span_count": package.span_count,
        "span_kind_counts": dict(package.span_kind_counts),
        "span_kind_shares": dict(package.span_kind_shares),
        "spans_per_trace": dict(package.spans_per_trace),
        "tool_span_count": package.tool_span_count,
        "tool_span_share": package.tool_span_share,
        "llm_turns_by_session": dict(package.llm_turns_by_session),
        "llm_turns_per_session": dict(package.llm_turns_per_session),
        "opening_diversity_by_domain": {
            domain: dict(counts) for domain, counts in package.opening_diversity_by_domain.items()
        },
    }


if __name__ == "__main__":
    raise SystemExit(command())
