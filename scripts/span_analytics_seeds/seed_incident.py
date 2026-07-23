"""Seed a deterministic release-regression incident into a Phoenix database.

Generates two projects of synthetic payment-agent traces:

- ``payments-agent`` — ~2,000 spans over 48 hours. A release cut from
  ``v41`` to ``v42`` happens 20 hours before ``--now``; the span error rate
  jumps from ~2% to ~18% after the cut, concentrated in the ``acme``
  tenant. Includes a handful of orphan spans (parent never received), one
  span whose ``llm.token_count.total`` is a string instead of a number
  (exercising type-guarded numeric extraction), and one failed LLM span
  with a ~20KB input payload (exercising preview clipping and full
  recovery).
- ``payments-agent-dev`` — a decoy project with identical span names and
  attribute keys but different values, for verifying project isolation.

LLM spans carry OpenInference input/output message lists (system + user,
one assistant reply) and, when their recorded token count is usable, a
deterministic cost record priced from a per-model table — the
string-typed token span has no cost record, so cost absence is itself
queryable.

The generator is a pure function of ``(--now, --seed)``: two runs produce
byte-identical data. A ground-truth answer key exists (error rate and count
by release and hour, the five slowest failed LLM calls, the worst span id)
but is printed only with ``--answer-key`` — reading it before investigating
the data spoils the exercise.

Usage:
    python scripts/span_analytics_seeds/seed_incident.py --now 2026-07-23T12:00:00Z \
        [--seed 7] [--database-url sqlite:///path/to/phoenix.db] \
        [--migrate] [--replace] [--answer-key] [--dry-run]

Without ``--database-url`` the standard Phoenix environment configuration
is used. The target database is normally a running Phoenix's (no migration
attempted); ``--migrate`` initializes an empty database instead. Re-runs
require ``--replace``, which deletes and re-seeds this script's projects.
"""

from __future__ import annotations

import argparse
import asyncio
import random
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

MAIN_PROJECT_NAME = "payments-agent"
DECOY_PROJECT_NAME = "payments-agent-dev"

DEFAULT_SEED = 7
HOURS = 48
TRACES_PER_HOUR = 20
DECOY_HOURS = 6
RELEASE_CUT_HOURS_AGO = 20

TENANTS = ("acme", "globex", "initech", "umbrella", "stark")
MODELS = ("gpt-4o", "claude-sonnet", "llama-3-70b")
ERROR_TENANT = "acme"

DECOY_TENANTS = ("wayne", "tyrell", "cyberdyne", "weyland", "oscorp")
DECOY_MODELS = ("gpt-4o-mini", "claude-haiku", "mistral-small")

#: USD per one million tokens, (prompt rate, completion rate). Costs are
#: computed deterministically from these at build time; LLM spans whose
#: recorded token count is unusable (the string-typed row) get no cost
#: record — cost absence stays a real, queryable fact.
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "claude-sonnet": (3.00, 15.00),
    "llama-3-70b": (0.60, 0.80),
    "gpt-4o-mini": (0.15, 0.60),
    "claude-haiku": (0.80, 4.00),
    "mistral-small": (0.20, 0.60),
}

#: Fraction of a span's total tokens attributed to the prompt when only a
#: total is recorded (this workload records totals, not the split).
PROMPT_TOKEN_FRACTION = 0.8

SYSTEM_PROMPT = (
    "You are the payments support assistant. Classify the intent of each "
    "charge request and answer in one line."
)

PRE_CUT_FAILURE_RATE = 0.02
POST_CUT_FAILURE_RATE_ERROR_TENANT = 0.50
POST_CUT_FAILURE_RATE_OTHER = 0.10

ROOT_SPAN_NAME = "process_payment"
LLM_SPAN_NAME = "classify_intent"
ORPHAN_SPAN_NAME = "retry_settlement"

LARGE_INPUT_CHARS = 20_000
LARGE_INPUT_LATENCY_MS = 30_000


@dataclass
class SpanRecord:
    span_id: str
    trace_id: str
    parent_id: Optional[str]
    name: str
    span_kind: str
    start_time: datetime
    end_time: datetime
    attributes: dict[str, Any]
    events: list[dict[str, Any]]
    status_code: str
    status_message: str

    @property
    def latency_ms(self) -> float:
        return (self.end_time - self.start_time).total_seconds() * 1000


@dataclass
class TraceRecord:
    trace_id: str
    start_time: datetime
    end_time: datetime


@dataclass
class AnnotationRecord:
    span_id: str
    name: str
    score: float
    label: str
    annotator_kind: str
    identifier: str


@dataclass
class CostRecord:
    span_id: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    prompt_cost: float
    completion_cost: float

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    @property
    def total_cost(self) -> float:
        return self.prompt_cost + self.completion_cost


def _cost_record(span_id: str, model: str, total_tokens: int) -> CostRecord:
    prompt_tokens = round(total_tokens * PROMPT_TOKEN_FRACTION)
    completion_tokens = total_tokens - prompt_tokens
    prompt_rate, completion_rate = MODEL_PRICES[model]
    return CostRecord(
        span_id=span_id,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        prompt_cost=prompt_tokens * prompt_rate / 1_000_000,
        completion_cost=completion_tokens * completion_rate / 1_000_000,
    )


@dataclass
class ProjectData:
    name: str
    traces: list[TraceRecord] = field(default_factory=list)
    spans: list[SpanRecord] = field(default_factory=list)
    annotations: list[AnnotationRecord] = field(default_factory=list)
    costs: list[CostRecord] = field(default_factory=list)


@dataclass
class Incident:
    now: datetime
    seed: int
    main: ProjectData
    decoy: ProjectData


def _exception_event(kind: str, message: str, at: datetime) -> dict[str, Any]:
    return {
        "name": "exception",
        "timestamp": at.isoformat(),
        "attributes": {
            "exception.type": kind,
            "exception.message": message,
            "exception.stacktrace": (
                "Traceback (most recent call last):\n"
                '  File "payment_agent/llm.py", line 88, in classify_intent\n'
                "    response = await client.complete(prompt)\n"
                f"{kind}: {message}"
            ),
        },
    }


def _large_input_payload() -> str:
    lines = [
        f'{{"line_item": {i}, "sku": "SKU-{i:05d}", "description": "{"x" * 28}"}}'
        for i in range(LARGE_INPUT_CHARS // 64)
    ]
    return '{"order_manifest": [' + ",".join(lines) + "]}"


def _build_project(
    rng: random.Random,
    *,
    name: str,
    now: datetime,
    hours: int,
    id_prefix: str,
    tenants: tuple[str, ...],
    models: tuple[str, ...],
    with_incident: bool,
) -> ProjectData:
    project = ProjectData(name=name)
    cut = now - timedelta(hours=RELEASE_CUT_HOURS_AGO)
    counter = 0

    def span_id() -> str:
        nonlocal counter
        counter += 1
        return f"{id_prefix}{counter:015x}"

    for hour in range(hours):
        hour_start = now - timedelta(hours=hours - hour)
        for _ in range(TRACES_PER_HOUR):
            trace_start = hour_start + timedelta(seconds=rng.uniform(0, 3599))
            release = "v42" if trace_start >= cut else "v41"
            tenant = rng.choice(tenants)
            model = rng.choice(models)
            if with_incident and release == "v42":
                failure_rate = (
                    POST_CUT_FAILURE_RATE_ERROR_TENANT
                    if tenant == ERROR_TENANT
                    else POST_CUT_FAILURE_RATE_OTHER
                )
            else:
                failure_rate = PRE_CUT_FAILURE_RATE
            failed = rng.random() < failure_rate

            trace_id = f"{id_prefix}{len(project.traces) + 1:031x}"
            root_id, llm_id = span_id(), span_id()
            llm_latency_ms = int(rng.uniform(400, 2500) * (rng.uniform(3, 8) if failed else 1))
            root_overhead_ms = int(rng.uniform(20, 80))
            metadata = {
                "release": release,
                "tenant": tenant,
                "build.version": f"{release}.{hour}",
            }
            order_ref = f"order-{trace_id[-8:]}"
            prompt = (
                f"Classify the payment intent for {order_ref} from tenant {tenant}: "
                '"please charge my saved card for the renewal"'
            )
            tokens: Any = rng.randint(200, 3000)
            exception_kind = rng.choice(("UpstreamTimeoutError", "RateLimitError"))
            exception_message = f"{exception_kind.removesuffix('Error')} while calling {model}"

            llm_start = trace_start + timedelta(milliseconds=30)
            llm_end = llm_start + timedelta(milliseconds=llm_latency_ms)
            root_end = llm_end + timedelta(milliseconds=root_overhead_ms)
            status = "ERROR" if failed else "OK"
            project.spans.append(
                SpanRecord(
                    span_id=root_id,
                    trace_id=trace_id,
                    parent_id=None,
                    name=ROOT_SPAN_NAME,
                    span_kind="CHAIN",
                    start_time=trace_start,
                    end_time=root_end,
                    attributes={
                        "input": {"value": f"charge request {order_ref}"},
                        "output": {"value": "declined" if failed else "settled"},
                        "metadata": dict(metadata),
                    },
                    events=[],
                    status_code=status,
                    status_message=exception_message if failed else "",
                )
            )
            llm_output = "intent: renewal_charge" if not failed else ""
            project.spans.append(
                SpanRecord(
                    span_id=llm_id,
                    trace_id=trace_id,
                    parent_id=root_id,
                    name=LLM_SPAN_NAME,
                    span_kind="LLM",
                    start_time=llm_start,
                    end_time=llm_end,
                    attributes={
                        "llm": {
                            "model_name": model,
                            "token_count": {"total": tokens},
                            # The ingested (nested) form of the OpenInference
                            # message convention: a list of {"message": {...}}.
                            "input_messages": [
                                {"message": {"role": "system", "content": SYSTEM_PROMPT}},
                                {"message": {"role": "user", "content": prompt}},
                            ],
                            "output_messages": [
                                {"message": {"role": "assistant", "content": llm_output}},
                            ],
                        },
                        "input": {"value": prompt},
                        "output": {"value": llm_output},
                        "metadata": dict(metadata),
                    },
                    events=[_exception_event(exception_kind, exception_message, llm_end)]
                    if failed
                    else [],
                    status_code=status,
                    status_message=exception_message if failed else "",
                )
            )
            project.costs.append(_cost_record(llm_id, model, int(tokens)))
            project.traces.append(
                TraceRecord(trace_id=trace_id, start_time=trace_start, end_time=root_end)
            )
    return project


def _apply_special_rows(rng: random.Random, project: ProjectData, now: datetime) -> None:
    """Deterministically plant the special rows in the main project."""
    cut = now - timedelta(hours=RELEASE_CUT_HOURS_AGO)
    post_cut_llm = [
        s
        for s in project.spans
        if s.span_kind == "LLM" and s.start_time >= cut and s.status_code == "ERROR"
    ]
    # One failed LLM span whose recorded token count is a string, not a
    # number: numeric extraction must read it as NULL instead of failing
    # the whole query or coercing it to zero.
    mixed_type_span = post_cut_llm[3]
    mixed_type_span.attributes["llm"]["token_count"]["total"] = "n/a"
    # Its recorded token count is unusable, so it carries no cost record —
    # cost absence is a real fact, not a synthetic zero.
    project.costs = [c for c in project.costs if c.span_id != mixed_type_span.span_id]
    # It also carries a single input message (no system prompt): the
    # second-message fields must read as NULL, not fail.
    mixed_type_span.attributes["llm"]["input_messages"] = [
        {
            "message": {
                "role": "user",
                "content": mixed_type_span.attributes["input"]["value"],
            }
        },
    ]

    # One failed LLM span with a ~20KB input and the slowest latency in the
    # dataset: large enough to demonstrate preview clipping, recovered in
    # full through the drill-down path.
    large_span = next(
        s
        for s in post_cut_llm
        if s.attributes["metadata"]["tenant"] == ERROR_TENANT and s is not mixed_type_span
    )
    large_span.attributes["input"]["value"] = _large_input_payload()
    # The user message mirrors input.value, so the oversized payload also
    # exercises message-content clipping.
    large_span.attributes["llm"]["input_messages"][1]["message"]["content"] = large_span.attributes[
        "input"
    ]["value"]
    large_span.end_time = large_span.start_time + timedelta(milliseconds=LARGE_INPUT_LATENCY_MS)
    for trace in project.traces:
        if trace.trace_id == large_span.trace_id:
            trace.end_time = max(trace.end_time, large_span.end_time)
    for sibling in project.spans:
        if sibling.trace_id == large_span.trace_id and sibling.parent_id is None:
            sibling.end_time = large_span.end_time + timedelta(milliseconds=40)

    # A few orphan spans: their parent id references a span that was never
    # received, so they surface as roots flagged orphan in trace trees.
    for index in range(5):
        orphan_trace = project.traces[10 + index * 7]
        start = orphan_trace.start_time + timedelta(milliseconds=5)
        end = start + timedelta(milliseconds=int(rng.uniform(50, 400)))
        project.spans.append(
            SpanRecord(
                span_id=f"c{index + 1:015x}",
                trace_id=orphan_trace.trace_id,
                parent_id=f"feedbeef{index:08x}",
                name=ORPHAN_SPAN_NAME,
                span_kind="TOOL",
                start_time=start,
                end_time=end,
                attributes={"input": {"value": "settlement retry"}},
                events=[],
                status_code="OK",
                status_message="",
            )
        )


def _build_annotations(rng: random.Random, project: ProjectData) -> None:
    """Attach ``correctness`` eval scores to a couple dozen LLM spans.

    Two annotator identifiers score under the same annotation name — one
    LLM judge and one human reviewer — so a span can legitimately carry
    multiple rows for one annotation name. That multiplicity is exactly why
    joining spans to annotations inside a span-grain aggregate would corrupt
    counts and sums without declared reduction semantics.
    """
    llm_spans = [s for s in project.spans if s.span_kind == "LLM"][:24]
    for index, span in enumerate(llm_spans):
        judge_score = round(rng.uniform(0.1, 1.0), 2)
        project.annotations.append(
            AnnotationRecord(
                span_id=span.span_id,
                name="correctness",
                score=judge_score,
                label="correct" if judge_score >= 0.5 else "incorrect",
                annotator_kind="LLM",
                identifier="llm-judge-1",
            )
        )
        if index % 2 == 0:
            human_score = round(rng.uniform(0.0, 1.0), 2)
            project.annotations.append(
                AnnotationRecord(
                    span_id=span.span_id,
                    name="correctness",
                    score=human_score,
                    label="correct" if human_score >= 0.5 else "incorrect",
                    annotator_kind="HUMAN",
                    identifier="human-review",
                )
            )


def build_incident(now: datetime, seed: int = DEFAULT_SEED) -> Incident:
    """Build the full dataset. Pure function of (now, seed)."""
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    rng = random.Random(seed)
    main = _build_project(
        rng,
        name=MAIN_PROJECT_NAME,
        now=now,
        hours=HOURS,
        id_prefix="a",
        tenants=TENANTS,
        models=MODELS,
        with_incident=True,
    )
    _apply_special_rows(rng, main, now)
    decoy = _build_project(
        rng,
        name=DECOY_PROJECT_NAME,
        now=now,
        hours=DECOY_HOURS,
        id_prefix="b",
        tenants=DECOY_TENANTS,
        models=DECOY_MODELS,
        with_incident=False,
    )
    _build_annotations(rng, main)
    return Incident(now=now, seed=seed, main=main, decoy=decoy)


def render_ground_truth(incident: Incident) -> str:
    """The answer key: deterministic text derived from the generated spans."""
    main = incident.main
    lines: list[str] = []
    lines.append(f"# Ground truth for {main.name} (seed={incident.seed})")
    lines.append(f"now={incident.now.isoformat()}")
    lines.append(f"spans={len(main.spans)} traces={len(main.traces)}")
    lines.append(f"decoy {incident.decoy.name}: spans={len(incident.decoy.spans)}")
    lines.append("")
    lines.append("## Error rate and count by release and hour (all spans)")
    by_bucket: Counter[tuple[str, str]] = Counter()
    errors_by_bucket: Counter[tuple[str, str]] = Counter()
    for span in main.spans:
        release = span.attributes.get("metadata", {}).get("release", "(none)")
        hour = span.start_time.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:00:00+00:00")
        by_bucket[(release, hour)] += 1
        if span.status_code == "ERROR":
            errors_by_bucket[(release, hour)] += 1
    for (release, hour), count in sorted(by_bucket.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        errors = errors_by_bucket[(release, hour)]
        lines.append(f"{hour} {release} count={count} errors={errors} rate={errors / count:.4f}")
    lines.append("")
    lines.append("## Totals by release (all spans)")
    for release in sorted({r for r, _ in by_bucket}):
        count = sum(c for (r, _), c in by_bucket.items() if r == release)
        errors = sum(c for (r, _), c in errors_by_bucket.items() if r == release)
        lines.append(f"{release} count={count} errors={errors} rate={errors / count:.4f}")
    lines.append("")
    lines.append("## Five slowest failed LLM calls")
    failed_llm = [s for s in main.spans if s.span_kind == "LLM" and s.status_code == "ERROR"]
    slowest = sorted(failed_llm, key=lambda s: (-s.latency_ms, s.span_id))[:5]
    for span in slowest:
        tenant = span.attributes["metadata"]["tenant"]
        release = span.attributes["metadata"]["release"]
        lines.append(
            f"{span.span_id} latency_ms={span.latency_ms:.1f} tenant={tenant} release={release}"
        )
    lines.append("")
    lines.append(f"## Worst span: {slowest[0].span_id}")
    lines.append("")
    lines.append("## Top 10 spans by cost")
    priciest = sorted(main.costs, key=lambda c: (-c.total_cost, c.span_id))[:10]
    for cost in priciest:
        lines.append(f"{cost.span_id} cost={cost.total_cost:.6f} model={cost.model}")
    total_cost = sum(c.total_cost for c in main.costs)
    lines.append(
        f"cost records={len(main.costs)} (LLM spans with usable token counts) "
        f"total_cost={total_cost:.6f}"
    )
    lines.append("")
    lines.append("## Spans with correctness < 0.5 (any annotator)")
    low_spans = sorted(
        {a.span_id for a in main.annotations if a.name == "correctness" and a.score < 0.5}
    )
    lines.append(f"distinct spans={len(low_spans)}")
    cost_by_span = {c.span_id: c for c in main.costs}
    priciest_low = sorted(
        (cost_by_span[sid] for sid in low_spans if sid in cost_by_span),
        key=lambda c: (-c.total_cost, c.span_id),
    )[:10]
    lines.append("top 10 by cost:")
    for cost in priciest_low:
        lines.append(f"{cost.span_id} cost={cost.total_cost:.6f}")
    incorrect_spans = sorted(
        {a.span_id for a in main.annotations if a.name == "correctness" and a.label == "incorrect"}
    )
    lines.append(f"distinct spans labeled incorrect={len(incorrect_spans)}")
    return "\n".join(lines)


async def insert_incident(session: Any, incident: Incident) -> None:
    """Insert both projects with plain ORM-table inserts.

    ``session`` is an ``AsyncSession`` bound to a migrated Phoenix
    database (either backend).
    """
    from sqlalchemy import insert, select

    from phoenix.db import models

    for project_data in (incident.main, incident.decoy):
        project_rowid = await session.scalar(
            insert(models.Project).values(name=project_data.name).returning(models.Project.id)
        )
        await session.execute(
            insert(models.Trace),
            [
                {
                    "project_rowid": project_rowid,
                    "trace_id": trace.trace_id,
                    "start_time": trace.start_time,
                    "end_time": trace.end_time,
                }
                for trace in project_data.traces
            ],
        )
        trace_rowids = dict(
            (
                await session.execute(
                    select(models.Trace.trace_id, models.Trace.id).where(
                        models.Trace.project_rowid == project_rowid
                    )
                )
            ).all()
        )
        await session.execute(
            insert(models.Span),
            [
                {
                    "span_id": span.span_id,
                    "trace_rowid": trace_rowids[span.trace_id],
                    "parent_id": span.parent_id,
                    "name": span.name,
                    "span_kind": span.span_kind,
                    "start_time": span.start_time,
                    "end_time": span.end_time,
                    "attributes": span.attributes,
                    "events": span.events,
                    "status_code": span.status_code,
                    "status_message": span.status_message,
                    "cumulative_error_count": 1 if span.status_code == "ERROR" else 0,
                    "cumulative_llm_token_count_prompt": 0,
                    "cumulative_llm_token_count_completion": 0,
                }
                for span in project_data.spans
            ],
        )
        if project_data.annotations or project_data.costs:
            span_rowids = dict(
                (
                    await session.execute(
                        select(models.Span.span_id, models.Span.id)
                        .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                        .where(models.Trace.project_rowid == project_rowid)
                    )
                ).all()
            )
        if project_data.annotations:
            await session.execute(
                insert(models.SpanAnnotation),
                [
                    {
                        "span_rowid": span_rowids[annotation.span_id],
                        "name": annotation.name,
                        "label": annotation.label,
                        "score": annotation.score,
                        "explanation": None,
                        "metadata_": {},
                        "annotator_kind": annotation.annotator_kind,
                        "identifier": annotation.identifier,
                        "source": "API",
                        "user_id": None,
                    }
                    for annotation in project_data.annotations
                ],
            )
        if project_data.costs:
            span_by_id = {span.span_id: span for span in project_data.spans}
            await session.execute(
                insert(models.SpanCost),
                [
                    {
                        "span_rowid": span_rowids[cost.span_id],
                        "trace_rowid": trace_rowids[span_by_id[cost.span_id].trace_id],
                        "span_start_time": span_by_id[cost.span_id].start_time,
                        # The generative-model link is optional; keeping it
                        # unset keeps seeding self-contained and re-runnable.
                        "model_id": None,
                        "total_cost": cost.total_cost,
                        "total_tokens": float(cost.total_tokens),
                        "prompt_cost": cost.prompt_cost,
                        "prompt_tokens": float(cost.prompt_tokens),
                        "completion_cost": cost.completion_cost,
                        "completion_tokens": float(cost.completion_tokens),
                    }
                    for cost in project_data.costs
                ],
            )


async def open_seed_engine(connection_str: str, migrate: bool) -> Any:
    """Open the target database, initializing the schema only on request.

    Running migrations unconditionally fails against a database a running
    Phoenix owns: SQLite holds a write lock, and the PostgreSQL migration
    path takes an advisory lock a live server can contend for. Seeding
    targets are usually live servers, so the default probes for an
    existing migrated schema (the ``alembic_version`` table) and skips
    migration entirely; ``--migrate`` opts in for an empty database.
    """
    import sqlalchemy

    from phoenix.db.engines import create_engine

    engine = create_engine(connection_str, migrate=False, log_migrations=False)
    async with engine.connect() as conn:
        has_schema = await conn.run_sync(
            lambda sync_conn: bool(sqlalchemy.inspect(sync_conn).has_table("alembic_version"))
        )
    if has_schema:
        return engine
    await engine.dispose()
    if not migrate:
        raise SystemExit(
            "The target database has no Phoenix schema. Point --database-url at a "
            "running Phoenix's database, or pass --migrate to initialize an empty one."
        )
    return create_engine(connection_str, migrate=True, log_migrations=False)


async def replace_or_reject_existing(session: Any, names: list[str], replace: bool) -> None:
    """Make re-runs safe: the generated ids are deterministic, so inserting
    over a previous run collides. ``--replace`` deletes this script's own
    projects (by name; the schema cascades to sessions, traces, spans, and
    annotations) before re-seeding; without it, an existing project is
    reported up front instead of failing midway on an id collision.
    """
    from sqlalchemy import delete, select

    from phoenix.db import models

    existing = list(
        (
            await session.execute(select(models.Project.name).where(models.Project.name.in_(names)))
        ).scalars()
    )
    if not existing:
        return
    if replace:
        await session.execute(delete(models.Project).where(models.Project.name.in_(names)))
        return
    raise SystemExit(
        f"Project(s) already seeded: {', '.join(sorted(existing))}. "
        "Re-run with --replace to delete and re-seed them."
    )


def _print_confirmation(incident: Incident, wrote: bool) -> None:
    for project_data in (incident.main, incident.decoy):
        print(
            f'{"Seeded" if wrote else "Would seed"} project "{project_data.name}": '
            f"{len(project_data.spans)} spans, {len(project_data.traces)} traces, "
            f"{len(project_data.annotations)} annotations, "
            f"{len(project_data.costs)} cost records"
        )
    if wrote:
        print("Open the Phoenix UI and check that both projects appear.")


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--now",
        required=True,
        help="Anchor timestamp, ISO-8601 (e.g. 2026-07-23T12:00:00Z); naive means UTC.",
    )
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument(
        "--database-url",
        default=None,
        help="SQLAlchemy database URL; defaults to the Phoenix environment configuration.",
    )
    parser.add_argument(
        "--migrate",
        action="store_true",
        help=(
            "Initialize the Phoenix schema if the database is empty. Off by default: "
            "seeding a running Phoenix must not attempt migrations against a "
            "database the server owns."
        ),
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete this script's projects (if present) and re-seed them.",
    )
    parser.add_argument(
        "--answer-key",
        action="store_true",
        help=(
            "Print the ground-truth answer key. Off by default: reading it before "
            "investigating the data spoils the exercise."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the dataset and print the confirmation without writing anywhere.",
    )
    args = parser.parse_args()
    now = datetime.fromisoformat(str(args.now).replace("Z", "+00:00"))
    incident = build_incident(now, int(args.seed))

    if not args.dry_run:
        from sqlalchemy.ext.asyncio import AsyncSession

        from phoenix.config import get_env_database_connection_str

        connection_str = args.database_url or get_env_database_connection_str()
        engine = await open_seed_engine(connection_str, migrate=bool(args.migrate))
        async with AsyncSession(engine) as session:
            async with session.begin():
                await replace_or_reject_existing(
                    session,
                    [incident.main.name, incident.decoy.name],
                    replace=bool(args.replace),
                )
                await insert_incident(session, incident)
        await engine.dispose()

    _print_confirmation(incident, wrote=not args.dry_run)
    if args.answer_key:
        print()
        print(render_ground_truth(incident))


if __name__ == "__main__":
    asyncio.run(_main())
