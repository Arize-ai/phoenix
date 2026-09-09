"""Prepare a private, deterministic TRAIL fixture without touching any Phoenix database.

Run through `make mcp-fixture`. Download requires an explicit HF_TOKEN in this
trusted process. Outputs contain restricted data and must never enter images or git.
The general-purpose converter remains load_patronus_trail.py.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from scripts import load_patronus_trail as loader

REVISION = "b424ce63d5973d5dcd7169b1bc3c07ccdee276d1"
CONVERTER_VERSION = "trail-deterministic-1"


def canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


class StableIds(loader.IdMapper):
    def __init__(self, namespace: str):
        super().__init__(regenerate=False)
        self.namespace = namespace

    def _map(self, kind: str, original: str, length: int) -> str:
        if not original:
            raise ValueError("Missing source ID")
        return hashlib.sha256(f"{self.namespace}:{kind}:{original}".encode()).hexdigest()[:length]

    def map_trace(self, original: str) -> str:
        return self._map("trace", original, 32)

    def map_span(self, original: str) -> str:
        return self._map("span", original, 16)


def prepare(rows: list[dict[str, str]], *, revision: str, source: str) -> dict[str, Any]:
    """Derive truth from source identities, independently of converted Phoenix spans."""
    mapper = StableIds(f"{revision}:{source}")
    decoded = [
        (loader._loads_tolerant(row["trace"]), loader._loads_tolerant(row["labels"]))
        for row in rows
    ]
    decoded.sort(key=lambda pair: str(pair[0]["trace_id"]))
    identities: set[str] = set()
    raw_span_ids: set[str] = set()
    spans, annotations, trace_annotations = [], [], []
    for trace, labels in decoded:
        trace_id = str(trace["trace_id"])
        if trace_id in identities:
            raise ValueError("Duplicate source trace")
        identities.add(trace_id)
        raw_spans = list(loader._walk_spans(trace.get("spans") or []))
        if not raw_spans:
            raise ValueError("Empty trace cannot support independent count truth")
        local_ids = {str(span["span_id"]) for span in raw_spans}
        if len(local_ids) != len(raw_spans) or local_ids.intersection(raw_span_ids):
            raise ValueError("Duplicate source span")
        raw_span_ids.update(local_ids)
        for span in raw_spans:
            if str(span["trace_id"]) != trace_id:
                raise ValueError("Span belongs to another trace")
            if span.get("parent_span_id") and str(span["parent_span_id"]) not in local_ids:
                raise ValueError("Parent span is absent from selected trace")
        converted = [loader._to_phoenix_span(span, mapper) for span in raw_spans]
        spans.extend(converted)
        for error in labels.get("errors") or []:
            if error.get("location") and str(error["location"]) not in local_ids:
                raise ValueError("Annotation targets a missing span")
        annotations.extend(loader._to_span_annotations(labels.get("errors") or [], mapper))
        trace_annotations.extend(
            loader._scores_to_annotations(
                loader._extract_scores(labels.get("scores") or []),
                on_trace=True,
                target_id=mapper.map_trace(trace_id),
            )
        )
    if not spans:
        raise ValueError("Fixture is empty")
    spans.sort(key=lambda span: (span["context"]["trace_id"], span["context"]["span_id"]))
    annotations.sort(key=lambda annotation: annotation["identifier"])
    trace_annotations.sort(key=lambda annotation: annotation["identifier"])
    project = f"mcp-trail-{source}"
    payload = {
        "project": project,
        "spans": spans,
        "span_annotations": annotations,
        "trace_annotations": trace_annotations,
    }
    source_hash = hashlib.sha256(canonical(decoded)).hexdigest()
    fixture_hash = hashlib.sha256(
        canonical(
            {
                "version": CONVERTER_VERSION,
                "revision": revision,
                "source_hash": source_hash,
                "payload": payload,
            }
        )
    ).hexdigest()
    return {
        "manifest": {
            "corpus": "PatronusAI/TRAIL",
            "revision": revision,
            "source": source,
            "converter_version": CONVERTER_VERSION,
            "source_hash": source_hash,
            "fixture_hash": fixture_hash,
            "project": project,
            "trace_count": len(identities),
            "span_count": len(raw_span_ids),
            "span_annotation_count": len(annotations),
            "trace_annotation_count": len(trace_annotations),
        },
        "truth": {
            "project": project,
            "trace_count": len(identities),
            "trace_ids": sorted(mapper.map_trace(t) for t in identities),
            "span_ids": sorted(mapper.map_span(s) for s in raw_span_ids),
        },
        "payload": payload,
    }


def download(source: str, revision: str, cache: Path) -> list[dict[str, str]]:
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise ValueError("Missing HF_TOKEN in trusted downloader environment")
    from datasets import load_dataset

    dataset = load_dataset(
        loader.DATASET_REPO, split=source, revision=revision, token=token, cache_dir=str(cache)
    )
    return [{"trace": row["trace"], "labels": row["labels"]} for row in dataset]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Private local JSON rows; skips download")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source", choices=["gaia", "swe_bench"], default="gaia")
    parser.add_argument("--revision", default=REVISION)
    args = parser.parse_args()
    if len(args.revision) != 40 or any(c not in "0123456789abcdef" for c in args.revision):
        parser.error("revision must be an immutable 40-character commit")
    os.umask(0o077)
    args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
    rows = (
        json.loads(args.input.read_text())
        if args.input
        else download(args.source, args.revision, args.output / "hf-cache")
    )
    fixture = prepare(rows, revision=args.revision, source=args.source)
    for name, value in fixture.items():
        path = args.output / f"{name}.json"
        # Never overwrite a prior fixture, which could be attached to a historical run.
        data = canonical(value) + b"\n"
        if path.exists():
            if path.read_bytes() != data:
                raise ValueError("Output contains a different fixture; use a new output directory")
        else:
            with path.open("xb") as stream:
                stream.write(data)
    print(json.dumps({"fixture_hash": fixture["manifest"]["fixture_hash"], "prepared": True}))


if __name__ == "__main__":
    main()
