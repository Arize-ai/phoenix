"""Seed a realistic support-copilot workload into a Phoenix database.

One project, ``support-copilot``: ~300 chat sessions from ~120 users over
the trailing 24 hours. Each session holds one to five turns; each turn is
its own trace with an AGENT root (``copilot_turn``, carrying ``session.id``,
``user.id``, and nested ``metadata`` with plan/channel), a RETRIEVER child
with three scored ``retrieval.documents`` entries, an occasional TOOL call,
and an LLM span (two models, prompt/completion/total token counts with
~10% of totals missing, ~6% errors with exception events). LLM spans carry
OpenInference message lists with the *accumulating* conversation: turn N
resends system + all prior user/assistant pairs + the current user message
(2 + 2·(N−1) entries), so conversation depth varies per call and prompt
tokens — hence cost — grow with the carried history, as instrumented chat
applications actually behave. LLM spans with a recorded total token count
carry a deterministic cost record priced from a per-model table; the
missing-total spans have none, so cost absence mirrors token absence.
Roughly a third of the AGENT turns carry a ``helpfulness`` span annotation
from an LLM-judge-style annotator.

**No answer key exists for this project, by design.** It is the organic-use
dataset: there is no planted regression to find and no expected result to
check against — it exists to be questioned freely. The annotations follow
the same rule: scores are plausible organic texture, not an engineered
pattern.

The generator is a pure function of ``(--now, --seed)``: two runs produce
identical data.

The workload also carries an instrumentation drop (``metadata.channel``
stops being recorded ~6 hours before the anchor while usage continues) and
a sprinkle of GUARDRAIL-kind ``safety_check`` spans (~5% of turns, mostly
``pass``, some ``trigger``).

Usage:
    python scripts/span_analytics_seeds/seed_support_copilot.py \
        [--now 2026-07-23T12:00:00Z] [--seed 20260723] \
        [--database-url sqlite:///path/to/phoenix.db] \
        [--migrate] [--replace] [--cardinality N] [--with-policy-props] \
        [--dry-run]

``--now`` defaults to the current time. Without ``--database-url`` the
standard Phoenix environment configuration is used. The target database is
normally a running Phoenix's (no migration attempted); ``--migrate``
initializes an empty database instead. Re-runs require ``--replace``, which
deletes and re-seeds this script's project.
"""

from __future__ import annotations

import argparse
import asyncio
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

PROJECT_NAME = "support-copilot"

DEFAULT_SEED = 20260723
SESSION_COUNT = 300
USER_COUNT = 120

#: (model name, probability weight of picking it).
MODELS: tuple[tuple[str, float], ...] = (("gpt-4o", 0.7), ("claude-sonnet-4-5", 0.3))
TOOLS = ("lookup_order", "refund_status", "escalate", "kb_search")
TOPICS = ("billing", "refunds", "api keys", "rate limits", "sso setup", "data export")

#: Customer organizations. The awkward names are deliberate: values with
#: embedded quotes and backslashes must survive filter-grammar escaping
#: and URL encoding end to end.
ORGS = ("acme-labs", "o'brien-corp", "globex\\emea", "initech")

#: USD per one million tokens, (prompt rate, completion rate). Costs are
#: computed deterministically from these at build time; LLM spans whose
#: recorded total token count is missing get no cost record — cost
#: absence stays a real, queryable fact.
MODEL_PRICES: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "claude-sonnet-4-5": (3.00, 15.00),
}

SYSTEM_PROMPT = (
    "You are the support copilot. Answer the customer's question using the "
    "retrieved knowledge-base passages; escalate when unsure."
)

ERROR_RATE = 0.06
TOOL_CALL_RATE = 0.4
TOOL_ERROR_RATE = 0.08
MISSING_TOKEN_TOTAL_RATE = 0.1
ANNOTATION_RATE = 1 / 3
GUARDRAIL_RATE = 0.05
GUARDRAIL_TRIGGER_RATE = 0.15

#: Instrumentation drop: metadata.channel stops being written this many
#: hours before the anchor — the "did usage fall or did we stop
#: recording" question needs data where recording, not usage, changed.
CHANNEL_DROPPED_AFTER_HOURS = 6.0

#: Secret-shaped values planted only under --with-policy-props: they look
#: like live API keys but are fake.
POLICY_PROP_KEYS = (
    "sk-live-4f3a9b1c8d2e7f6a5b4c3d2e1f0a9b8c",
    "sk-live-7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b",
    "sk-live-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
)

ANNOTATION_NAME = "helpfulness"
ANNOTATOR_IDENTIFIER = "llm-judge-helpfulness"

_EXPLANATIONS = (
    "The answer addresses the question directly and cites the relevant steps.",
    "Partially helpful: the steps are correct but assume an admin role the user may lack.",
    "The response is generic and does not engage with the specifics of the request.",
    "Clear, actionable guidance with the right level of detail.",
    "The answer is on topic but omits the prerequisite configuration.",
    "Helpful summary, though the linked procedure has since changed.",
)


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
    llm_token_count_prompt: Optional[int] = None
    llm_token_count_completion: Optional[int] = None


@dataclass
class TraceRecord:
    trace_id: str
    session_id: str
    start_time: datetime
    end_time: datetime


@dataclass
class SessionRecord:
    session_id: str
    start_time: datetime
    end_time: datetime


@dataclass
class AnnotationRecord:
    span_id: str
    name: str
    score: float
    explanation: str
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


@dataclass
class Workload:
    now: datetime
    seed: int
    project_name: str
    sessions: list[SessionRecord] = field(default_factory=list)
    traces: list[TraceRecord] = field(default_factory=list)
    spans: list[SpanRecord] = field(default_factory=list)
    annotations: list[AnnotationRecord] = field(default_factory=list)
    costs: list[CostRecord] = field(default_factory=list)


def _exception_event(message: str, at: datetime) -> dict[str, Any]:
    return {
        "name": "exception",
        "timestamp": at.isoformat(),
        "attributes": {
            "exception.type": "RuntimeError",
            "exception.message": message,
            "exception.stacktrace": (
                "Traceback (most recent call last):\n"
                '  File "copilot/llm.py", line 142, in complete\n'
                "    response = await client.chat(messages)\n"
                f"RuntimeError: {message}"
            ),
        },
    }


def build_workload(
    now: datetime,
    seed: int = DEFAULT_SEED,
    session_count: int = SESSION_COUNT,
    with_policy_props: bool = False,
) -> Workload:
    """Build the full dataset. Pure function of its arguments.

    ``with_policy_props`` plants a few fake API-key-shaped strings in span
    attributes. It exists for facilitators only, to demonstrate — on
    purpose, with fake values — that observed-value discovery will surface
    secret-shaped strings if an application records them; it is never on
    by default.
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    rng = random.Random(seed)
    workload = Workload(now=now, seed=seed, project_name=PROJECT_NAME)

    docs = {
        topic: [f"{topic} doc {i}: " + "x" * rng.randint(80, 400) for i in range(8)]
        for topic in TOPICS
    }
    users = [f"user-{i:03d}" for i in range(USER_COUNT)]
    span_counter = 0
    trace_counter = 0

    def next_span_id() -> str:
        nonlocal span_counter
        span_counter += 1
        return f"d{span_counter:015x}"

    def next_trace_id() -> str:
        nonlocal trace_counter
        trace_counter += 1
        return f"d{trace_counter:031x}"

    for session_index in range(session_count):
        session_id = f"sess-{session_index:04d}"
        user = rng.choice(users)
        session_start = now - timedelta(hours=rng.uniform(0.2, 24))
        turns = rng.randint(1, 5)
        turn_start = session_start
        session_end = session_start
        # The running conversation: chat applications resend history, so
        # turn N carries system + all prior user/assistant pairs + the
        # current user message (2 + 2·(N−1) entries). Conversation depth
        # then varies meaningfully per call, and prompt size — hence cost —
        # grows with the carried history.
        history: list[dict[str, Any]] = []
        for turn in range(turns):
            topic = rng.choice(TOPICS)
            model = MODELS[0][0] if rng.random() < MODELS[0][1] else MODELS[1][0]
            failed = rng.random() < ERROR_RATE
            question = f"How do I handle {topic}? (turn {turn + 1})"
            duration_s = rng.uniform(1.2, 9.0)
            trace_id = next_trace_id()
            root_id = next_span_id()
            root_end = turn_start + timedelta(seconds=duration_s)
            # The channel value is always drawn (keeping the stream stable)
            # but stops being *recorded* after the drop point: usage did not
            # change, instrumentation did.
            channel = rng.choice(["web", "slack"])
            metadata: dict[str, Any] = {
                "plan": rng.choice(["free", "pro", "enterprise"]),
                "org": rng.choice(list(ORGS)),
            }
            if turn_start < now - timedelta(hours=CHANNEL_DROPPED_AFTER_HOURS):
                metadata["channel"] = channel

            workload.spans.append(
                SpanRecord(
                    span_id=root_id,
                    trace_id=trace_id,
                    parent_id=None,
                    name="copilot_turn",
                    span_kind="AGENT",
                    start_time=turn_start,
                    end_time=root_end,
                    attributes={
                        "session": {"id": session_id},
                        "user": {"id": user},
                        "input": {"value": question},
                        "output": {"value": "failed" if failed else "resolved"},
                        # Over OTLP this arrives as a JSON string that
                        # ingestion un-flattens; direct insertion writes the
                        # nested dict the ingested form has.
                        "metadata": metadata,
                    },
                    events=[],
                    status_code="ERROR" if failed else "OK",
                    status_message="turn failed" if failed else "",
                )
            )

            retriever_start = turn_start + timedelta(seconds=0.05)
            workload.spans.append(
                SpanRecord(
                    span_id=next_span_id(),
                    trace_id=trace_id,
                    parent_id=root_id,
                    name="kb_retrieve",
                    span_kind="RETRIEVER",
                    start_time=retriever_start,
                    end_time=retriever_start + timedelta(seconds=rng.uniform(0.1, 0.6)),
                    attributes={
                        # Session context propagates to child spans, as
                        # OpenInference session propagation does in
                        # instrumented chat applications.
                        "session": {"id": session_id},
                        "user": {"id": user},
                        "input": {"value": question},
                        "retrieval": {
                            "documents": [
                                {
                                    "document": {
                                        "content": rng.choice(docs[topic]),
                                        "score": round(rng.uniform(0.3, 0.98), 3),
                                    }
                                }
                                for _ in range(3)
                            ]
                        },
                    },
                    events=[],
                    status_code="OK",
                    status_message="",
                )
            )

            if rng.random() < TOOL_CALL_RATE:
                tool_start = retriever_start + timedelta(seconds=0.7)
                tool_failed = rng.random() < TOOL_ERROR_RATE
                workload.spans.append(
                    SpanRecord(
                        span_id=next_span_id(),
                        trace_id=trace_id,
                        parent_id=root_id,
                        name="tool_call",
                        span_kind="TOOL",
                        start_time=tool_start,
                        end_time=tool_start + timedelta(seconds=rng.uniform(0.2, 2.0)),
                        attributes={
                            "session": {"id": session_id},
                            "user": {"id": user},
                            "tool": {"name": rng.choice(TOOLS)},
                        },
                        events=[],
                        status_code="ERROR" if tool_failed else "OK",
                        status_message="tool timeout" if tool_failed else "",
                    )
                )

            if rng.random() < GUARDRAIL_RATE:
                guardrail_start = retriever_start + timedelta(seconds=0.85)
                workload.spans.append(
                    SpanRecord(
                        span_id=next_span_id(),
                        trace_id=trace_id,
                        parent_id=root_id,
                        name="safety_check",
                        span_kind="GUARDRAIL",
                        start_time=guardrail_start,
                        end_time=guardrail_start + timedelta(seconds=rng.uniform(0.02, 0.15)),
                        attributes={
                            "session": {"id": session_id},
                            "user": {"id": user},
                            "guardrail": {
                                "outcome": "trigger"
                                if rng.random() < GUARDRAIL_TRIGGER_RATE
                                else "pass"
                            },
                        },
                        events=[],
                        status_code="OK",
                        status_message="",
                    )
                )

            llm_start = retriever_start + timedelta(seconds=1.0)
            llm_end = llm_start + timedelta(seconds=duration_s * 0.6)
            llm_id = next_span_id()
            answer = f"Here is how to handle {topic}..." + "y" * rng.randint(50, 800)
            input_messages = [
                {"message": {"role": "system", "content": SYSTEM_PROMPT}},
                *history,
                {"message": {"role": "user", "content": question}},
            ]
            # Token counts follow the actual payloads (~4 characters per
            # token, plus jitter) instead of being drawn independently:
            # prompt size grows with the resent history, so token spend and
            # cost grow with conversation depth, and completion size tracks
            # the answer text.
            prompt_chars = sum(len(m["message"]["content"]) for m in input_messages)
            prompt_tokens = prompt_chars // 4 + rng.randint(0, 40)
            completion_tokens = len(answer) // 4 + rng.randint(0, 20)
            token_count: dict[str, Any] = {
                "prompt": prompt_tokens,
                "completion": completion_tokens,
                "total": prompt_tokens + completion_tokens,
            }
            if rng.random() < MISSING_TOKEN_TOTAL_RATE:
                token_count.pop("total")  # missingness texture
            workload.spans.append(
                SpanRecord(
                    span_id=llm_id,
                    trace_id=trace_id,
                    parent_id=root_id,
                    name=f"{model}.chat",
                    span_kind="LLM",
                    start_time=llm_start,
                    end_time=llm_end,
                    attributes={
                        "session": {"id": session_id},
                        "user": {"id": user},
                        "llm": {
                            "model_name": model,
                            "token_count": token_count,
                            # The ingested (nested) form of the OpenInference
                            # message convention: a list of {"message": {...}}.
                            "input_messages": input_messages,
                            "output_messages": [
                                {"message": {"role": "assistant", "content": answer}},
                            ],
                        },
                        "input": {"value": question},
                        "output": {"value": answer},
                    },
                    events=[
                        _exception_event(
                            "upstream 429: rate limited",
                            llm_start + timedelta(seconds=1),
                        )
                    ]
                    if failed
                    else [],
                    status_code="ERROR" if failed else "OK",
                    status_message="upstream 429" if failed else "",
                    llm_token_count_prompt=prompt_tokens,
                    llm_token_count_completion=completion_tokens,
                )
            )
            # Cost is recorded only when the total token count was: the
            # ~10% missing-total spans have no cost record, so cost absence
            # mirrors token-count absence as a queryable fact.
            if "total" in token_count:
                prompt_rate, completion_rate = MODEL_PRICES[model]
                workload.costs.append(
                    CostRecord(
                        span_id=llm_id,
                        model=model,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        prompt_cost=prompt_tokens * prompt_rate / 1_000_000,
                        completion_cost=completion_tokens * completion_rate / 1_000_000,
                    )
                )

            # Organic annotation texture: an LLM-judge helpfulness score on
            # roughly a third of the turns. No engineered pattern and no
            # answer key — the scores exist to be discovered, not solved.
            if rng.random() < ANNOTATION_RATE:
                workload.annotations.append(
                    AnnotationRecord(
                        span_id=root_id,
                        name=ANNOTATION_NAME,
                        score=round(rng.uniform(0.0, 1.0), 2),
                        explanation=rng.choice(_EXPLANATIONS),
                        annotator_kind="LLM",
                        identifier=ANNOTATOR_IDENTIFIER,
                    )
                )

            # The turn's exchange joins the history the next turn resends.
            history.append({"message": {"role": "user", "content": question}})
            history.append({"message": {"role": "assistant", "content": answer}})

            trace_end = max(root_end, llm_end)
            workload.traces.append(
                TraceRecord(
                    trace_id=trace_id,
                    session_id=session_id,
                    start_time=turn_start,
                    end_time=trace_end,
                )
            )
            session_end = max(session_end, trace_end)
            turn_start = turn_start + timedelta(seconds=duration_s + rng.uniform(5, 60))
        workload.sessions.append(
            SessionRecord(
                session_id=session_id,
                start_time=session_start,
                end_time=session_end,
            )
        )
    if with_policy_props:
        # Facilitator-only governance demonstration: value discovery will
        # faithfully surface these secret-shaped (fake) strings.
        agent_spans = [s for s in workload.spans if s.span_kind == "AGENT"]
        for span, fake_key in zip(agent_spans, POLICY_PROP_KEYS):
            span.attributes["metadata"]["debug_api_key"] = fake_key
    return workload


async def insert_workload(session: Any, workload: Workload) -> None:
    """Insert the project with plain ORM-table inserts.

    ``session`` is an ``AsyncSession`` bound to a migrated Phoenix
    database (either backend).
    """
    from sqlalchemy import insert, select

    from phoenix.db import models

    project_rowid = await session.scalar(
        insert(models.Project).values(name=workload.project_name).returning(models.Project.id)
    )
    await session.execute(
        insert(models.ProjectSession),
        [
            {
                "session_id": record.session_id,
                "project_id": project_rowid,
                "start_time": record.start_time,
                "end_time": record.end_time,
            }
            for record in workload.sessions
        ],
    )
    session_rowids = dict(
        (
            await session.execute(
                select(models.ProjectSession.session_id, models.ProjectSession.id).where(
                    models.ProjectSession.project_id == project_rowid
                )
            )
        ).all()
    )
    await session.execute(
        insert(models.Trace),
        [
            {
                "project_rowid": project_rowid,
                "trace_id": trace.trace_id,
                "project_session_rowid": session_rowids[trace.session_id],
                "start_time": trace.start_time,
                "end_time": trace.end_time,
            }
            for trace in workload.traces
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
                "llm_token_count_prompt": span.llm_token_count_prompt,
                "llm_token_count_completion": span.llm_token_count_completion,
            }
            for span in workload.spans
        ],
    )
    if workload.annotations or workload.costs:
        span_rowids = dict(
            (
                await session.execute(
                    select(models.Span.span_id, models.Span.id)
                    .join(models.Trace, models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.project_rowid == project_rowid)
                )
            ).all()
        )
    if workload.annotations:
        # Uniqueness is (name, span_rowid, identifier); one identifier per
        # span here, so re-seeding after --replace never collides.
        await session.execute(
            insert(models.SpanAnnotation),
            [
                {
                    "span_rowid": span_rowids[annotation.span_id],
                    "name": annotation.name,
                    "label": None,
                    "score": annotation.score,
                    "explanation": annotation.explanation,
                    "metadata_": {},
                    "annotator_kind": annotation.annotator_kind,
                    "identifier": annotation.identifier,
                    "source": "API",
                    "user_id": None,
                }
                for annotation in workload.annotations
            ],
        )
    if workload.costs:
        span_by_id = {span.span_id: span for span in workload.spans}
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
                for cost in workload.costs
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
    project (by name; the schema cascades to sessions, traces, spans, and
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


def _print_confirmation(workload: Workload, wrote: bool) -> None:
    print(
        f'{"Seeded" if wrote else "Would seed"} project "{workload.project_name}": '
        f"{len(workload.spans)} spans, {len(workload.traces)} traces, "
        f"{len(workload.sessions)} sessions, {len(workload.annotations)} annotations, "
        f"{len(workload.costs)} cost records"
    )
    if wrote:
        print("Open the Phoenix UI and check that the project appears.")


async def _main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--now",
        default=None,
        help=(
            "Anchor timestamp, ISO-8601 (e.g. 2026-07-23T12:00:00Z); naive means UTC. "
            "Defaults to the current time."
        ),
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
        help="Delete this script's project (if present) and re-seed it.",
    )
    parser.add_argument(
        "--cardinality",
        type=int,
        default=SESSION_COUNT,
        help=f"Number of sessions to generate (default {SESSION_COUNT}).",
    )
    parser.add_argument(
        "--with-policy-props",
        action="store_true",
        help=(
            "Facilitator-only: plant a few fake API-key-shaped strings in span "
            "attributes to demonstrate the governance exposure of observed-value "
            "discovery. Off by default."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Build the dataset and print the confirmation without writing anywhere.",
    )
    args = parser.parse_args()
    now = (
        datetime.fromisoformat(str(args.now).replace("Z", "+00:00"))
        if args.now
        else datetime.now(timezone.utc)
    )
    workload = build_workload(
        now,
        int(args.seed),
        session_count=int(args.cardinality),
        with_policy_props=bool(args.with_policy_props),
    )

    if not args.dry_run:
        from sqlalchemy.ext.asyncio import AsyncSession

        from phoenix.config import get_env_database_connection_str

        connection_str = args.database_url or get_env_database_connection_str()
        engine = await open_seed_engine(connection_str, migrate=bool(args.migrate))
        async with AsyncSession(engine) as session:
            async with session.begin():
                await replace_or_reject_existing(
                    session, [workload.project_name], replace=bool(args.replace)
                )
                await insert_workload(session, workload)
        await engine.dispose()

    _print_confirmation(workload, wrote=not args.dry_run)


if __name__ == "__main__":
    asyncio.run(_main())
