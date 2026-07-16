from __future__ import annotations

import argparse
import hashlib
import logging
import os
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta, timezone

from phoenix.client import Client
from phoenix.client.__generated__ import v1

from evals.pxi.offline_evals.evaluators import EVALUATORS
from evals.pxi.offline_evals.models import EvaluatorSpec, RunSummary
from evals.pxi.offline_evals.topology import span_id, trace_id

logger = logging.getLogger(__name__)

DEFAULT_LOOKBACK = timedelta(hours=48)
DEFAULT_SETTLE_DELAY = timedelta(minutes=5)
DEFAULT_PROJECT = "pxi_dev"
DEFAULT_TIMEOUT_SECONDS = 120
MAX_CANDIDATE_ROOTS = 5_000
MAX_SPANS_PER_BATCH = 10_000
TRACE_ID_BATCH_SIZE = 100


def _sampled(spec: EvaluatorSpec, artifact_id: str) -> bool:
    if spec.sample_rate >= 1.0:
        return True
    if spec.sample_rate <= 0.0:
        return False
    digest = hashlib.sha256(f"{spec.name}:{artifact_id}".encode()).digest()
    rho = int.from_bytes(digest[:8], "big") / 2**64
    return rho < spec.sample_rate


def _existing_annotation_keys(
    client: Client,
    *,
    project: str,
    roots: Sequence[v1.Span],
    specs: Sequence[EvaluatorSpec],
) -> set[tuple[str, str, str]]:
    if not roots:
        return set()
    annotations = client.spans.get_span_annotations(
        spans=roots,
        project_identifier=project,
        include_annotation_names=sorted({spec.name for spec in specs}),
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    return {
        (annotation["span_id"], annotation["name"], annotation.get("identifier", ""))
        for annotation in annotations
    }


def _fetch_batch_spans(client: Client, *, project: str, batch: Sequence[str]) -> list[v1.Span]:
    """Fetch all spans for a batch of trace ids, splitting the batch when full.

    ``get_spans`` paginates internally up to ``limit``, so a response of
    exactly ``MAX_SPANS_PER_BATCH`` spans may be truncated. That can happen
    from aggregate volume alone (many medium-sized traces per batch), so
    rather than failing the run, halve the batch and retry; only a single
    trace exceeding the limit on its own is an error.
    """
    spans = client.spans.get_spans(
        project_identifier=project,
        trace_ids=list(batch),
        limit=MAX_SPANS_PER_BATCH,
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    if len(spans) < MAX_SPANS_PER_BATCH:
        return list(spans)
    if len(batch) == 1:
        raise RuntimeError(
            f"trace {batch[0]} alone reached the span safety limit ({MAX_SPANS_PER_BATCH})"
        )
    middle = len(batch) // 2
    return _fetch_batch_spans(client, project=project, batch=batch[:middle]) + _fetch_batch_spans(
        client, project=project, batch=batch[middle:]
    )


def _load_trace_spans(
    client: Client, *, project: str, trace_ids: Iterable[str]
) -> dict[str, list[v1.Span]]:
    ids = sorted(set(trace_ids))
    grouped: dict[str, list[v1.Span]] = defaultdict(list)
    for offset in range(0, len(ids), TRACE_ID_BATCH_SIZE):
        batch = ids[offset : offset + TRACE_ID_BATCH_SIZE]
        for span in _fetch_batch_spans(client, project=project, batch=batch):
            grouped[trace_id(span)].append(span)
    for spans in grouped.values():
        spans.sort(key=lambda span: span["start_time"])
    return dict(grouped)


def run_evaluators(
    client: Client,
    *,
    project: str,
    specs: Sequence[EvaluatorSpec],
    now: datetime | None = None,
    lookback: timedelta = DEFAULT_LOOKBACK,
    settle_delay: timedelta = DEFAULT_SETTLE_DELAY,
    dry_run: bool = False,
) -> dict[str, RunSummary]:
    if not specs:
        return {}
    unsupported = [spec.name for spec in specs if spec.target != "trace"]
    if unsupported:
        raise NotImplementedError(
            f"offline runner does not yet support non-trace evaluators: {unsupported}"
        )
    missing_env = {
        spec.name: missing
        for spec in specs
        if (missing := [key for key in spec.required_env_fn() if not os.getenv(key)])
    }
    if missing_env:
        raise RuntimeError(f"missing required environment variables: {missing_env}")

    current = now or datetime.now(timezone.utc)
    roots = client.spans.get_spans(
        project_identifier=project,
        start_time=current - lookback,
        end_time=current - settle_delay,
        parent_id="null",
        name=sorted({spec.root_span_name for spec in specs}),
        limit=MAX_CANDIDATE_ROOTS,
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    if len(roots) == MAX_CANDIDATE_ROOTS:
        raise RuntimeError("candidate discovery reached its safety limit; reduce the run window")

    summaries = {
        spec.name: RunSummary(discovered=sum(root["name"] == spec.root_span_name for root in roots))
        for spec in specs
    }
    existing = _existing_annotation_keys(client, project=project, roots=roots, specs=specs)
    pending: list[tuple[EvaluatorSpec, v1.Span]] = []
    for spec in specs:
        summary = summaries[spec.name]
        for root in roots:
            if root["name"] != spec.root_span_name:
                continue
            key = (span_id(root), spec.name, spec.identifier)
            if key in existing:
                summary.already_annotated += 1
            elif not _sampled(spec, trace_id(root)):
                summary.sampled_out += 1
            else:
                pending.append((spec, root))

    traces = _load_trace_spans(
        client, project=project, trace_ids=(trace_id(root) for _, root in pending)
    )
    annotations: list[v1.SpanAnnotationData] = []
    for spec, root in pending:
        artifact_spans = traces.get(trace_id(root), [])
        if not spec.applies_to(root, artifact_spans):
            summaries[spec.name].not_applicable += 1
            continue
        try:
            result = spec.evaluate(root, artifact_spans)
        except Exception:
            logger.exception("%s failed on trace %s; continuing", spec.name, trace_id(root))
            summaries[spec.name].errors += 1
            continue
        if result is None:
            summaries[spec.name].not_applicable += 1
            continue
        summaries[spec.name].evaluated += 1
        annotation: v1.SpanAnnotationData = {
            "name": spec.name,
            "annotator_kind": spec.annotator_kind,
            "span_id": span_id(root),
            "identifier": spec.identifier,
            "result": {"score": result.score},
        }
        if result.explanation is not None:
            annotation["result"]["explanation"] = result.explanation
        if result.metadata:
            annotation["metadata"] = result.metadata
        annotations.append(annotation)

    if annotations and not dry_run:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    for annotation in annotations:
        summaries[annotation["name"]].annotations += 1
    return summaries


def _default_project() -> str:
    return os.getenv("PHOENIX_PROJECT") or os.getenv("PHOENIX_PROJECT_NAME") or DEFAULT_PROJECT


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate recent, already-ingested PXI turns.")
    parser.add_argument(
        "--eval",
        action="append",
        choices=sorted(EVALUATORS),
        help="Evaluator to run; repeat for multiple evaluators (default: all).",
    )
    parser.add_argument("--project", default=_default_project())
    parser.add_argument("--lookback-hours", type=float, default=48.0)
    parser.add_argument("--settle-minutes", type=float, default=5.0)
    parser.add_argument(
        "--dry-run", action="store_true", help="Evaluate without writing annotations."
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_arg_parser().parse_args(argv)
    selected = args.eval or list(EVALUATORS)
    specs = [EVALUATORS[name] for name in selected]
    summaries = run_evaluators(
        Client(),
        project=args.project,
        specs=specs,
        lookback=timedelta(hours=args.lookback_hours),
        settle_delay=timedelta(minutes=args.settle_minutes),
        dry_run=args.dry_run,
    )
    print(f"PXI offline evals: project={args.project} dry_run={args.dry_run}")
    for name, summary in summaries.items():
        annotation_verb = "would_write" if args.dry_run else "written"
        print(
            f"  {name}: discovered={summary.discovered} "
            f"already_annotated={summary.already_annotated} "
            f"sampled_out={summary.sampled_out} "
            f"not_applicable={summary.not_applicable} "
            f"evaluated={summary.evaluated} errors={summary.errors} "
            f"{annotation_verb}={summary.annotations}"
        )
    return 1 if any(summary.errors for summary in summaries.values()) else 0


if __name__ == "__main__":
    raise SystemExit(main())
