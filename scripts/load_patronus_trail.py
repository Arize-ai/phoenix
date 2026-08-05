# /// script
# requires-python = ">=3.14"
# dependencies = [
#   "arize-phoenix-client==2.7.0",
#   "datasets==4.8.5",
# ]
# ///
"""
Load the Patronus TRAIL benchmark into a running Phoenix instance.

TRAIL (https://huggingface.co/datasets/PatronusAI/TRAIL) is a gated Hugging Face
dataset of 148 annotated agent execution traces (~118 GAIA + 30 SWE-Bench),
containing ~1,987 OpenTelemetry spans and 841 expert-labeled errors across
reasoning / execution / planning / tool / formatting / context categories,
plus per-trace reliability / security / instruction-adherence / planning scores.

Each TRAIL row contains two JSON-stringified columns:
  - ``trace``  : { trace_id, spans[…with nested .child_spans…] }
  - ``labels`` : { trace_id, errors[…], scores[…] }

Pipeline (per row):
  1. Fetch rows via ``datasets.load_dataset("PatronusAI/TRAIL", split=…)``
     (gated — accept the license + ``huggingface-cli login`` or set HF_TOKEN),
     or from a local datasets-server preview JSON via ``--input``.
  2. Flatten the nested ``child_spans`` tree and POST every span via
     ``client.spans.log_spans`` into ``trail-gaia`` / ``trail-swebench``.
  3. Emit annotations (batched per trace, can be disabled with
     ``--no-annotations``):
       - ``labels.errors`` → span annotations on the offending spans
         (``name="trail_error"``, ``label=<category>``, score from impact).
       - ``labels.scores`` → annotations on the trace's root span by default,
         one per metric (``trail_reliability``, ``trail_security``,
         ``trail_instruction_adherence``, ``trail_plan_opt``, ``trail_overall``).
         Use ``--scores-on-trace`` to post them as trace annotations instead.

Defaults applied unless opted out:
  - ``--regenerate-ids``: every TRAIL trace_id / span_id is remapped to a
    fresh hex ID (consistent within a single run; not persisted across runs).
    Disable with ``--no-regenerate-ids`` to keep TRAIL's original IDs.
  - ``--shift-to-now``: each trace's timestamps are shifted so its earliest
    span lands at ``now - trace_index * 1min``, preserving within-trace
    relative timing. Disable with ``--no-shift-to-now``.

Usage:
    # load both sub-corpora into Phoenix (the client reads PHOENIX_HOST /
    # PHOENIX_PORT / PHOENIX_COLLECTOR_ENDPOINT / PHOENIX_API_KEY from the env,
    # falling back to http://localhost:6006).
    uv run scripts/load_trail.py

    # dev loop on a subset
    uv run scripts/load_trail.py --source gaia --limit 3

    # spans only, no annotations
    uv run scripts/load_trail.py --no-annotations

    # keep original IDs and 2025 timestamps (and post scores at trace level)
    uv run scripts/load_trail.py \\
        --no-regenerate-ids --no-shift-to-now --scores-on-trace
"""

import argparse
import json
import logging
import re
import secrets
import sys
from collections.abc import Iterable, Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from phoenix.client import Client

logger = logging.getLogger("load_trail")

DATASET_REPO = "PatronusAI/TRAIL"

# Per-source: (HF datasets split name, target Phoenix project name)
SOURCES: dict[str, tuple[str, str]] = {
    "gaia": ("gaia", "trail-gaia"),
    "swe_bench": ("swe_bench", "trail-swebench"),
}

# TRAIL error.impact → Phoenix annotation score (higher = more severe).
IMPACT_SCORES: dict[str, float] = {"low": 0.3, "medium": 0.6, "high": 1.0}

# TRAIL per-trace metrics live under labels.scores (1-5 scale, with *_reasoning).
TRAIL_SCORE_METRICS: tuple[str, ...] = (
    "reliability",
    "security",
    "instruction_adherence",
    "plan_opt",
)

# Per-trace stagger when shift-to-now is enabled.
_SHIFT_TRACE_SPACING = timedelta(minutes=1)

# ISO 8601 duration like "PT1M24.635189S" or "PT0.420S".
_ISO_DUR_RE = re.compile(
    r"^PT"
    r"(?:(?P<h>\d+(?:\.\d+)?)H)?"
    r"(?:(?P<m>\d+(?:\.\d+)?)M)?"
    r"(?:(?P<s>\d+(?:\.\d+)?)S)?$"
)


class IdMapper:
    """Optionally remap TRAIL trace_id / span_id values to fresh hex IDs.

    When ``regenerate=True``, ``map_trace`` / ``map_span`` return a new random
    hex ID per original (32 chars for traces, 16 for spans) and remember the
    mapping for the lifetime of this object — i.e. consistent within one run
    but not persisted across runs.

    When ``regenerate=False``, both mappers return their input unchanged.
    """

    def __init__(self, regenerate: bool) -> None:
        self.regenerate = regenerate
        self.trace_ids: dict[str, str] = {}
        self.span_ids: dict[str, str] = {}

    def map_trace(self, original: str) -> str:
        if not self.regenerate or not original:
            return original
        return self.trace_ids.setdefault(original, secrets.token_hex(16))

    def map_span(self, original: str) -> str:
        if not self.regenerate or not original:
            return original
        return self.span_ids.setdefault(original, secrets.token_hex(8))


# Some TRAIL labels rows contain trailing commas before `]` or `}` that
# stdlib json refuses. Try strict first; on failure, strip those commas and
# retry — only attempted when stdlib has already given up, so we can't mangle
# otherwise-valid JSON.
_TRAILING_COMMA_RE = re.compile(r",(\s*[\]}])")


def _loads_tolerant(s: str) -> Any:
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return json.loads(_TRAILING_COMMA_RE.sub(r"\1", s))


def _parse_iso8601_duration(s: str) -> timedelta:
    if not (m := _ISO_DUR_RE.match(s)) or not any(m.groupdict().values()):
        raise ValueError(f"unparseable duration: {s!r}")
    return timedelta(
        seconds=float(m["h"] or 0) * 3600 + float(m["m"] or 0) * 60 + float(m["s"] or 0)
    )


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def _walk_spans(spans: Iterable[dict[str, Any]]) -> Iterator[dict[str, Any]]:
    """Depth-first flatten of a span tree with nested ``child_spans``."""
    for s in spans:
        yield s
        yield from _walk_spans(s.get("child_spans") or [])


def _map_status(raw: str) -> str:
    code = (raw or "").upper()
    return code if code in ("OK", "ERROR", "UNSET") else "UNSET"


def _phoenix_span_kind(raw_span: dict[str, Any]) -> str:
    """Prefer the OpenInference kind embedded in span_attributes."""
    attrs = raw_span.get("span_attributes") or {}
    return str(attrs.get("openinference.span.kind") or "UNKNOWN")


def _to_phoenix_span(raw: dict[str, Any], mapper: IdMapper) -> dict[str, Any]:
    """Convert a TRAIL/Patronus span dict to a Phoenix v1.Span-shaped payload."""
    start = _parse_timestamp(raw["timestamp"])
    end = start + _parse_iso8601_duration(raw["duration"])

    span_attrs = dict(raw.get("span_attributes") or {})
    # Carry resource and scope context into Phoenix attributes for visibility.
    if resource_attrs := raw.get("resource_attributes"):
        span_attrs.setdefault("resource", dict(resource_attrs))
    if service := raw.get("service_name"):
        span_attrs.setdefault("service.name", service)

    events: list[dict[str, Any]] = []
    for ev in raw.get("events") or []:
        if ts := (ev.get("timestamp") or ev.get("time")):
            events.append(
                {
                    "name": str(ev.get("name", "")),
                    "timestamp": _parse_timestamp(ts).isoformat(),
                    "attributes": dict(ev.get("attributes") or {}),
                }
            )

    span: dict[str, Any] = {
        "name": str(raw.get("span_name") or "span"),
        "context": {
            "trace_id": mapper.map_trace(str(raw["trace_id"])),
            "span_id": mapper.map_span(str(raw["span_id"])),
        },
        "span_kind": _phoenix_span_kind(raw),
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "status_code": _map_status(raw.get("status_code", "")),
        "attributes": span_attrs,
        "events": events,
    }
    if parent := raw.get("parent_span_id"):
        span["parent_id"] = mapper.map_span(str(parent))
    if msg := raw.get("status_message"):
        span["status_message"] = str(msg)
    return span


def _to_span_annotations(errors: list[dict[str, Any]], mapper: IdMapper) -> list[dict[str, Any]]:
    """Convert ``labels.errors`` to ``log_span_annotations`` payloads.

    One annotation per error, name=``trail_error``, identifier scoped to the
    (span, category) pair so repeated runs upsert rather than duplicate.
    """
    out: list[dict[str, Any]] = []
    for err in errors:
        if not (original := err.get("location")):
            continue
        span_id = mapper.map_span(str(original))
        category = str(err.get("category") or "unknown")
        impact = str(err.get("impact") or "MEDIUM").lower()
        description = str(err.get("description") or "")
        evidence = str(err.get("evidence") or "")
        explanation = description if not evidence else f"{description}\n\nEvidence: {evidence}"
        out.append(
            {
                "span_id": span_id,
                "name": "trail_error",
                "annotator_kind": "HUMAN",
                "result": {
                    "label": category,
                    "score": IMPACT_SCORES.get(impact, 0.6),
                    "explanation": explanation or None,
                },
                "identifier": f"trail:{span_id}:{category}",
            }
        )
    return out


def _extract_scores(
    scores_list: list[dict[str, Any]],
) -> list[tuple[str, float, str | None]]:
    """Return ``(metric, score, explanation)`` tuples from ``labels.scores[0]``."""
    if not scores_list:
        return []
    scores = scores_list[0]
    out: list[tuple[str, float, str | None]] = []
    for metric in TRAIL_SCORE_METRICS:
        if (val := scores.get(f"{metric}_score")) is not None:
            out.append((metric, float(val), scores.get(f"{metric}_reasoning")))
    if (overall := scores.get("overall")) is not None:
        out.append(("overall", float(overall), None))
    return out


def _scores_to_annotations(
    extracted: list[tuple[str, float, str | None]],
    *,
    on_trace: bool,
    target_id: str,
) -> list[dict[str, Any]]:
    """Render extracted scores as either span or trace annotation payloads."""
    id_field = "trace_id" if on_trace else "span_id"
    return [
        {
            id_field: target_id,
            "name": f"trail_{metric}",
            "annotator_kind": "HUMAN",
            "result": {"score": score, "explanation": explanation},
            "identifier": f"trail:{target_id}:{metric}",
        }
        for metric, score, explanation in extracted
    ]


def _find_root_span_id(spans: list[dict[str, Any]]) -> str | None:
    """Return the ``span_id`` of the first parentless span (Phoenix Span shape)."""
    for s in spans:
        if not s.get("parent_id"):
            return str((s.get("context") or {}).get("span_id") or "") or None
    return None


def _shift_spans_to_now(spans: list[dict[str, Any]], trace_index: int) -> None:
    """Anchor the trace's earliest span at ``now - trace_index * spacing``,
    preserving all relative timing within the trace. Mutates in place.
    """
    if not spans:
        return
    parsed_starts = [_parse_timestamp(s["start_time"]) for s in spans]
    target = datetime.now(UTC) - trace_index * _SHIFT_TRACE_SPACING
    delta = target - min(parsed_starts)
    for s, start in zip(spans, parsed_starts):
        s["start_time"] = (start + delta).isoformat()
        s["end_time"] = (_parse_timestamp(s["end_time"]) + delta).isoformat()
        for ev in s.get("events") or []:
            ev["timestamp"] = (_parse_timestamp(ev["timestamp"]) + delta).isoformat()


def _ensure_project(client: Client, name: str) -> None:
    try:
        client.projects.get(project_name=name)
        logger.info("project %s already exists", name)
        return
    except Exception:  # noqa: BLE001 — 404 if absent; fall through to create
        pass
    client.projects.create(name=name, description="Patronus TRAIL benchmark traces")
    logger.info("created project %s", name)


def _iter_rows(source: str, input_path: Path | None) -> Iterator[dict[str, str]]:
    """Yield {"trace": <json-str>, "labels": <json-str>} rows from HF or local file."""
    if input_path is not None:
        doc = json.loads(input_path.read_text())
        if isinstance(doc, dict) and "rows" in doc:  # datasets-server preview envelope
            for entry in doc["rows"]:
                yield entry["row"]
        elif isinstance(doc, list):
            yield from doc
        else:
            raise ValueError(f"unrecognized local input shape at {input_path}")
        return

    # imported lazily so --inspect/--input work offline
    from datasets import get_dataset_split_names, load_dataset

    split, _ = SOURCES[source]
    if split not in (available := get_dataset_split_names(DATASET_REPO)):
        raise ValueError(
            f"split {split!r} not found in PatronusAI/TRAIL; available: {available}. "
            f"Update SOURCES in this script to match."
        )
    logger.info("loading PatronusAI/TRAIL split=%s (gated — needs HF auth)", split)
    for row in load_dataset(DATASET_REPO, split=split):
        yield {"trace": row["trace"], "labels": row["labels"]}


def _load_source(
    client: Client,
    source: str,
    input_path: Path | None,
    limit: int | None,
    *,
    shift_to_now: bool,
    annotations: bool,
    scores_on_trace: bool,
    mapper: IdMapper,
) -> None:
    _, project = SOURCES[source]
    _ensure_project(client, project)

    n_traces = n_spans = n_span_annos = n_trace_annos = 0
    for i, row in enumerate(_iter_rows(source, input_path)):
        if limit is not None and i >= limit:
            break
        trace_doc = _loads_tolerant(row["trace"])
        labels = _loads_tolerant(row["labels"])
        original_trace_id = str(trace_doc.get("trace_id") or labels.get("trace_id") or "")
        trace_id = mapper.map_trace(original_trace_id)
        spans = [_to_phoenix_span(s, mapper) for s in _walk_spans(trace_doc.get("spans") or [])]
        if shift_to_now:
            _shift_spans_to_now(spans, i)

        span_annos: list[dict[str, Any]] = []
        trace_annos: list[dict[str, Any]] = []
        if annotations:
            span_annos = _to_span_annotations(labels.get("errors") or [], mapper)
            extracted = _extract_scores(labels.get("scores") or [])
            if extracted:
                if not scores_on_trace and (root_id := _find_root_span_id(spans)):
                    span_annos.extend(
                        _scores_to_annotations(extracted, on_trace=False, target_id=root_id)
                    )
                else:
                    if not scores_on_trace:
                        logger.warning(
                            "trace %s has no root span; falling back to trace annotation",
                            trace_id,
                        )
                    trace_annos = _scores_to_annotations(
                        extracted, on_trace=True, target_id=trace_id
                    )

        client.spans.log_spans(project_identifier=project, spans=spans)
        if span_annos:
            client.spans.log_span_annotations(span_annotations=span_annos)
        if trace_annos:
            client.traces.log_trace_annotations(trace_annotations=trace_annos)

        n_traces += 1
        n_spans += len(spans)
        n_span_annos += len(span_annos)
        n_trace_annos += len(trace_annos)

    logger.info(
        "%s: %d traces / %d spans / %d span annotations / %d trace annotations → %r",
        source,
        n_traces,
        n_spans,
        n_span_annos,
        n_trace_annos,
        project,
    )


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Load the Patronus TRAIL benchmark into Phoenix.")
    p.add_argument(
        "--source",
        choices=("gaia", "swe_bench", "both"),
        default="both",
        help="which TRAIL sub-corpus to load",
    )
    p.add_argument(
        "--input",
        type=Path,
        default=None,
        help="use a local datasets-server preview JSON instead of fetching from HF",
    )
    p.add_argument("--limit", type=int, default=None, help="cap traces per source")
    p.add_argument(
        "--shift-to-now",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="shift each trace's timestamps so its earliest span lands at "
        "(now - trace_index * 1min); preserves within-trace relative timing. "
        "(default: on; --no-shift-to-now keeps original timestamps)",
    )
    p.add_argument(
        "--regenerate-ids",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="remap every TRAIL trace_id / span_id to a fresh random hex ID "
        "(consistent within a run; not persisted across runs). "
        "(default: on; --no-regenerate-ids keeps original IDs)",
    )
    p.add_argument(
        "--annotations",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="post TRAIL errors as span annotations and trace scores as "
        "(by default) root-span annotations. "
        "(default: on; --no-annotations skips all annotation posting)",
    )
    p.add_argument(
        "--scores-on-trace",
        action="store_true",
        help="post trace-level TRAIL scores as TRACE annotations instead of "
        "annotations on the root span (the default).",
    )
    p.add_argument("--verbose", "-v", action="store_true")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    sources = ["gaia", "swe_bench"] if args.source == "both" else [args.source]

    client = Client()
    mapper = IdMapper(regenerate=args.regenerate_ids)
    for s in sources:
        _load_source(
            client,
            s,
            args.input,
            args.limit,
            shift_to_now=args.shift_to_now,
            annotations=args.annotations,
            scores_on_trace=args.scores_on_trace,
            mapper=mapper,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
