from __future__ import annotations

import argparse
import asyncio
import hashlib
import logging
import math
import os
from collections import defaultdict
from collections.abc import Iterable, Sequence
from datetime import datetime, timedelta, timezone

from phoenix.client import Client
from phoenix.client.__generated__ import v1
from phoenix.evals.evaluators import Score

from evals.pxi.online_evals import judge
from evals.pxi.online_evals.evaluators import EVALUATORS
from evals.pxi.online_evals.models import EvaluatorSpec, RunSummary
from evals.pxi.online_evals.topology import span_id, trace_id

logger = logging.getLogger(__name__)

DEFAULT_LOOKBACK = timedelta(hours=48)
DEFAULT_SETTLE_DELAY = timedelta(minutes=5)
DEFAULT_TIMEOUT_SECONDS = 120
MAX_CANDIDATE_ROOTS = 5_000
MAX_SPANS_PER_BATCH = 10_000
TRACE_ID_BATCH_SIZE = 100
ANNOTATION_WRITE_BATCH_SIZE = 100
MAX_CONCURRENT_EVALUATIONS = 8


class OversizedTraceError(RuntimeError):
    def __init__(self, trace_id: str) -> None:
        self.trace_id = trace_id
        super().__init__(
            f"trace {trace_id} alone reached the span safety limit ({MAX_SPANS_PER_BATCH})"
        )


def _sampled(spec: EvaluatorSpec, artifact_id: str) -> bool:
    """Deterministic sampling keyed on the artifact alone, not the evaluator.

    Every evaluator derives the same rho for a given trace, so evaluators with
    equal sample rates select exactly the same traces, and a lower-rate
    evaluator's selection is a strict subset of a higher-rate one's. Sampled
    traces therefore carry every applicable annotation instead of a random
    partial set.
    """
    if spec.sample_rate >= 1.0:
        return True
    if spec.sample_rate <= 0.0:
        return False
    digest = hashlib.sha256(artifact_id.encode()).digest()
    rho = int.from_bytes(digest[:8], "big") / 2**64
    return rho < spec.sample_rate


def _resolve_identifier(spec: EvaluatorSpec) -> str:
    """LLM evaluators embed the shared judge provider/model in their checkpoint
    identity, so a judge change starts a new result series automatically."""
    if spec.annotator_kind == "LLM":
        return f"{spec.identifier}:{judge.provider()}:{judge.model()}"
    return spec.identifier


def _ended_before(root: v1.Span, cutoff: datetime) -> bool:
    value = root.get("end_time")
    if not isinstance(value, str):
        logger.warning("skipping root %s without an end time", span_id(root))
        return False
    try:
        end_time = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        logger.warning("skipping root %s with invalid end time %r", span_id(root), value)
        return False
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)
    return end_time <= cutoff


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
        raise OversizedTraceError(batch[0])
    middle = len(batch) // 2
    return _fetch_batch_spans(client, project=project, batch=batch[:middle]) + _fetch_batch_spans(
        client, project=project, batch=batch[middle:]
    )


def _load_trace_spans(
    client: Client, *, project: str, trace_ids: Iterable[str]
) -> tuple[dict[str, list[v1.Span]], set[str]]:
    ids = sorted(set(trace_ids))
    grouped: dict[str, list[v1.Span]] = defaultdict(list)
    oversized: set[str] = set()
    for offset in range(0, len(ids), TRACE_ID_BATCH_SIZE):
        remaining = ids[offset : offset + TRACE_ID_BATCH_SIZE]
        while remaining:
            try:
                spans = _fetch_batch_spans(client, project=project, batch=remaining)
            except OversizedTraceError as error:
                logger.error("%s; skipping that trace", error)
                oversized.add(error.trace_id)
                remaining = [trace for trace in remaining if trace != error.trace_id]
                continue
            for span in spans:
                grouped[trace_id(span)].append(span)
            break
    for spans in grouped.values():
        spans.sort(key=lambda span: span["start_time"])
    return dict(grouped), oversized


def _flush_annotations(
    client: Client,
    annotations: list[v1.SpanAnnotationData],
    *,
    dry_run: bool,
) -> None:
    if not annotations:
        return
    if not dry_run:
        client.spans.log_span_annotations(span_annotations=annotations, sync=True)
    annotations.clear()


async def run_evaluators(
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
    if any(spec.annotator_kind == "LLM" for spec in specs):
        judge.validate_required_env()
    identifiers = {spec.name: _resolve_identifier(spec) for spec in specs}

    current = now or datetime.now(timezone.utc)
    roots = client.spans.get_spans(
        project_identifier=project,
        start_time=current - lookback,
        end_time=current,
        parent_id="null",
        name=sorted({spec.root_span_name for spec in specs}),
        limit=MAX_CANDIDATE_ROOTS,
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )
    if len(roots) == MAX_CANDIDATE_ROOTS:
        raise RuntimeError("candidate discovery reached its safety limit; reduce the run window")
    roots = [root for root in roots if _ended_before(root, current - settle_delay)]

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
            key = (span_id(root), spec.name, identifiers[spec.name])
            if key in existing:
                summary.already_annotated += 1
            elif not _sampled(spec, trace_id(root)):
                summary.sampled_out += 1
            else:
                pending.append((spec, root))

    traces, oversized_trace_ids = _load_trace_spans(
        client, project=project, trace_ids=(trace_id(root) for _, root in pending)
    )
    evaluable: list[tuple[EvaluatorSpec, v1.Span]] = []
    for spec, root in pending:
        if trace_id(root) in oversized_trace_ids:
            summaries[spec.name].errors += 1
        else:
            evaluable.append((spec, root))

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_EVALUATIONS)

    async def _evaluate(spec: EvaluatorSpec, root: v1.Span) -> Score | None:
        async with semaphore:
            return await spec.evaluate(root, traces.get(trace_id(root), []))

    tasks = [(spec, root, asyncio.create_task(_evaluate(spec, root))) for spec, root in evaluable]
    annotations: list[v1.SpanAnnotationData] = []
    for spec, root, task in tasks:
        try:
            result = await task
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
            "identifier": identifiers[spec.name],
            "result": {},
        }
        if result.score is not None:
            annotation["result"]["score"] = float(result.score)
        if result.explanation is not None:
            annotation["result"]["explanation"] = result.explanation
        if result.label is not None:
            annotation["result"]["label"] = result.label
        if result.metadata:
            annotation["metadata"] = result.metadata
        annotations.append(annotation)
        summaries[spec.name].annotations += 1
        if len(annotations) >= ANNOTATION_WRITE_BATCH_SIZE:
            _flush_annotations(client, annotations, dry_run=dry_run)

    _flush_annotations(client, annotations, dry_run=dry_run)
    return summaries


def _default_project() -> str | None:
    return os.getenv("PHOENIX_PROJECT") or os.getenv("PHOENIX_PROJECT_NAME")


def _positive_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a positive finite number") from error
    if not math.isfinite(parsed) or parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive finite number")
    return parsed


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Evaluate recent, already-ingested PXI turns.")
    parser.add_argument(
        "--eval",
        action="append",
        choices=sorted(EVALUATORS),
        help="Evaluator to run; repeat for multiple evaluators (default: all).",
    )
    default_project = _default_project()
    parser.add_argument(
        "--project",
        default=default_project,
        required=default_project is None,
        help=(
            "Phoenix project to evaluate (required unless PHOENIX_PROJECT or "
            "PHOENIX_PROJECT_NAME is set)."
        ),
    )
    parser.add_argument(
        "--lookback-hours",
        type=_positive_float,
        default=48.0,
        help="Trace discovery lookback in hours (default: 48).",
    )
    parser.add_argument(
        "--settle-minutes",
        type=_positive_float,
        default=5.0,
        help="Minimum age of a completed turn in minutes (default: 5).",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Evaluate without writing annotations."
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    if timedelta(hours=args.lookback_hours) <= timedelta(minutes=args.settle_minutes):
        parser.error("--lookback-hours must cover more time than --settle-minutes")
    selected = args.eval or list(EVALUATORS)
    specs = [EVALUATORS[name] for name in selected]
    summaries = asyncio.run(
        run_evaluators(
            Client(),
            project=args.project,
            specs=specs,
            lookback=timedelta(hours=args.lookback_hours),
            settle_delay=timedelta(minutes=args.settle_minutes),
            dry_run=args.dry_run,
        )
    )
    print(f"PXI online evals: project={args.project} dry_run={args.dry_run}")
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
