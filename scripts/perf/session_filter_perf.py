"""Aggregate-predicate perf harness for the session filter DSL.

Benchmarks the two SQL shapes a session aggregate predicate can compile to — Option A (the
grouped-subquery LEFT JOIN that ``SessionFilter`` emits) and Option B (per-session correlated
scalar subqueries) — across cardinality tiers and both dialects, in two load shapes:

- **view-shaped**: a paginated, project-wide filter (single ``num_traces >= 5`` and combined
  ``num_traces >= 5 AND total_cost > 0.1``);
- **sweep-shaped**: the online-eval tick — the filter scoped to a small candidate set
  (10/100/1000 sessions), asserting per-tick latency stays ~flat as total session count grows.

Each measured query runs ``--runs`` times in randomized order; we report median + p95 wall-clock
and a structural plan check (SQLite: no ``CORRELATED SCALAR SUBQUERY`` for Option A; PostgreSQL:
HashAggregate + Hash/Merge Join, no per-row ``SubPlan``).

Usage::

    uv run python scripts/perf/session_filter_perf.py --dialect sqlite --sessions 1000 10000
    uv run python scripts/perf/session_filter_perf.py --dialect postgresql \
        --postgres-url postgresql+psycopg://user@localhost:5432/perf --sessions 1000

SQLite seeds a temp file DB; PostgreSQL requires an empty target database (``--postgres-url``).
Seeding is bulk Core inserts; larger tiers require proportionally more memory for seeding.
"""

from __future__ import annotations

import argparse
import random
import statistics
import time
from datetime import datetime, timedelta, timezone
from tempfile import NamedTemporaryFile
from typing import Any, Callable, Optional

from sqlalchemy import Engine, create_engine, select, text
from sqlalchemy.sql.expression import Select

from phoenix.db import models
from phoenix.trace.dsl.session_filter import SessionFilter

_EPOCH = datetime(2024, 1, 1, tzinfo=timezone.utc)
_SINGLE = "num_traces >= 5"
_COMBINED = "num_traces >= 5 and total_cost > 0.1"


# --- seeding ---------------------------------------------------------------------------------


def _skewed_num_traces(rng: random.Random) -> int:
    """Skewed traces-per-session: most sessions are short, a long tail is deep."""
    roll = rng.random()
    if roll < 0.80:
        return rng.randint(1, 4)
    if roll < 0.95:
        return rng.randint(5, 20)
    return rng.randint(20, 60)


def seed(engine: Engine, n_sessions: int, rng: random.Random) -> dict[str, Any]:
    """Bulk-seed one project with ``n_sessions`` skewed sessions; return counts + rowids."""
    # Reset between tiers so an unscoped grouped aggregate never sees a prior tier's rows (a fresh
    # SQLite temp file is already empty; a reused PostgreSQL database is not).
    models.Base.metadata.drop_all(engine)
    models.Base.metadata.create_all(engine)
    trace_rows: list[dict[str, Any]] = []
    span_rows: list[dict[str, Any]] = []
    cost_rows: list[dict[str, Any]] = []
    session_rows: list[dict[str, Any]] = []

    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            conn.exec_driver_sql("PRAGMA synchronous=OFF")
            conn.exec_driver_sql("PRAGMA journal_mode=MEMORY")
        project_id = conn.execute(
            models.Project.__table__.insert().values(name="perf").returning(models.Project.id)
        ).scalar_one()

        for _ in range(n_sessions):
            start = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            session_rows.append(
                {
                    "session_id": f"s{rng.getrandbits(48):x}",
                    "project_id": project_id,
                    "start_time": start,
                    "end_time": start + timedelta(seconds=rng.randint(1, 600)),
                }
            )
        conn.execute(models.ProjectSession.__table__.insert(), session_rows)
        session_ids = list(
            conn.execute(
                select(models.ProjectSession.id).where(
                    models.ProjectSession.project_id == project_id
                )
            ).scalars()
        )

        span_counter = 0
        trace_counter = 0
        for session_rowid in session_ids:
            # 0.02 flat cost per trace ⇒ any session with >=5 traces clears the 0.1 cost bar.
            num_traces = _skewed_num_traces(rng)
            base = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            for trace_index in range(num_traces):
                trace_start = base + timedelta(seconds=trace_index)
                trace_rows.append(
                    {
                        "trace_id": f"t{trace_counter:x}",
                        "project_rowid": project_id,
                        "project_session_rowid": session_rowid,
                        "start_time": trace_start,
                        "end_time": trace_start + timedelta(seconds=2),
                    }
                )
                trace_counter += 1
        conn.execute(models.Trace.__table__.insert(), trace_rows)
        trace_ids = list(
            conn.execute(
                select(models.Trace.id, models.Trace.project_session_rowid).where(
                    models.Trace.project_rowid == project_id
                )
            )
        )

        for trace_id, session_rowid in trace_ids:
            spans_in_trace = rng.randint(8, 16)
            root_span_id = f"sp{span_counter:x}"
            root_start = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            span_rows.append(_span_row(root_span_id, None, trace_id, "LLM", root_start))
            span_counter += 1
            cost_rows.append(
                {
                    "span_rowid": None,  # filled after span ids resolve; see below
                    "trace_rowid": trace_id,
                    "span_start_time": root_start,
                    "total_cost": 0.02,
                    "prompt_cost": 0.02,
                    "completion_cost": 0.0,
                    "_root_span_id": root_span_id,
                }
            )
            for _ in range(spans_in_trace - 1):
                kind = "TOOL" if rng.random() < 0.5 else "LLM"
                span_rows.append(
                    _span_row(f"sp{span_counter:x}", root_span_id, trace_id, kind, root_start)
                )
                span_counter += 1
        conn.execute(models.Span.__table__.insert(), span_rows)

        # Resolve root span rowids for the cost rows (SpanCost.span_rowid is NOT NULL).
        root_ids = dict(
            conn.execute(
                select(models.Span.span_id, models.Span.id).where(models.Span.parent_id.is_(None))
            ).all()
        )
        for cost_row in cost_rows:
            cost_row["span_rowid"] = root_ids[cost_row.pop("_root_span_id")]
        conn.execute(models.SpanCost.__table__.insert(), cost_rows)

        if engine.dialect.name == "postgresql":
            conn.exec_driver_sql("ANALYZE")

    return {
        "project_id": project_id,
        "session_ids": session_ids,
        "n_sessions": len(session_ids),
        "n_traces": len(trace_rows),
        "n_spans": len(span_rows),
    }


def _span_row(
    span_id: str, parent_id: Optional[str], trace_rowid: int, kind: str, start: datetime
) -> dict[str, Any]:
    return {
        "trace_rowid": trace_rowid,
        "span_id": span_id,
        "parent_id": parent_id,
        "name": "op",
        "span_kind": kind,
        "start_time": start,
        "end_time": start + timedelta(seconds=1),
        "attributes": {},
        "events": [],
        "status_code": "OK",
        "status_message": "",
        "cumulative_error_count": 0,
        "cumulative_llm_token_count_prompt": 5,
        "cumulative_llm_token_count_completion": 7,
        "llm_token_count_prompt": 5 if kind == "LLM" else None,
        "llm_token_count_completion": 7 if kind == "LLM" else None,
    }


# --- query shapes ----------------------------------------------------------------------------


def option_a(
    condition: str, project_id: int, candidates: Optional[list[int]] = None
) -> Select[Any]:
    # Matches SessionFilter.__call__ usage; the grouped-subquery joins are 1:1 per session, so no
    # DISTINCT is needed for these predicates (and DISTINCT + ORDER BY a non-selected column is
    # rejected by PostgreSQL in the paginated view shape).
    base = select(models.ProjectSession.id).where(models.ProjectSession.project_id == project_id)
    if candidates is not None:
        base = base.where(models.ProjectSession.id.in_(candidates))
    return SessionFilter(condition)(
        base,
        candidate_session_rowids=candidates,
        project_rowids=[project_id],
        aggregate_shape="grouped",
    )


def option_b(
    condition: str, project_id: int, candidates: Optional[list[int]] = None
) -> Select[Any]:
    """The same predicate expressed with the production correlated aggregate shape."""
    session_col = models.ProjectSession.id
    base = select(session_col).where(models.ProjectSession.project_id == project_id)
    if candidates is not None:
        base = base.where(session_col.in_(candidates))
    return SessionFilter(condition)(
        base,
        candidate_session_rowids=candidates,
        project_rowids=[project_id],
        aggregate_shape="correlated",
    )


# --- measurement -----------------------------------------------------------------------------


def _time_once(engine: Engine, stmt: Select[Any]) -> float:
    start = time.perf_counter()
    with engine.connect() as conn:
        conn.execute(stmt).fetchall()
    return time.perf_counter() - start


def measure(
    engine: Engine, tasks: dict[str, Callable[[], Select[Any]]], runs: int
) -> dict[str, dict[str, float]]:
    samples: dict[str, list[float]] = {label: [] for label in tasks}
    order = list(tasks)
    rng = random.Random(0)
    for _ in range(runs):
        rng.shuffle(order)
        for label in order:
            samples[label].append(_time_once(engine, tasks[label]()))
    return {
        label: {
            "median_ms": statistics.median(times) * 1000,
            "p95_ms": _p95(times) * 1000,
        }
        for label, times in samples.items()
    }


def _p95(times: list[float]) -> float:
    ordered = sorted(times)
    index = max(0, int(round(0.95 * (len(ordered) - 1))))
    return ordered[index]


def explain(engine: Engine, stmt: Select[Any]) -> str:
    compiled = str(stmt.compile(engine, compile_kwargs={"literal_binds": True}))
    keyword = "EXPLAIN QUERY PLAN" if engine.dialect.name == "sqlite" else "EXPLAIN ANALYZE"
    with engine.connect() as conn:
        rows = conn.execute(text(f"{keyword} {compiled}")).fetchall()
    return "\n".join(" ".join(str(cell) for cell in row) for row in rows)


def plan_check(dialect: str, plan_a: str, plan_b: str) -> dict[str, bool]:
    upper_a = plan_a.upper()
    upper_b = plan_b.upper()
    if dialect == "sqlite":
        return {
            "option_a_no_correlated_scalar": "CORRELATED SCALAR SUBQUERY" not in upper_a,
            "option_b_has_correlated_scalar": "CORRELATED SCALAR SUBQUERY" in upper_b,
        }
    return {
        "option_a_has_hashaggregate": "HASHAGGREGATE" in upper_a,
        "option_a_no_subplan": "SUBPLAN" not in upper_a,
        "option_b_has_subplan": "SUBPLAN" in upper_b,
    }


# --- driver ----------------------------------------------------------------------------------


def run_tier(engine: Engine, dialect: str, n_sessions: int, runs: int, rng: random.Random) -> str:
    stats = seed(engine, n_sessions, rng)
    project_id = stats["project_id"]
    lines: list[str] = []
    lines.append(
        f"### {dialect} — {stats['n_sessions']} sessions, "
        f"{stats['n_traces']} traces, {stats['n_spans']} spans\n"
    )

    # View-shaped: paginated project-wide filter.
    def view(builder: Callable[..., Select[Any]], condition: str) -> Select[Any]:
        return (
            builder(condition, project_id)
            .order_by(models.ProjectSession.start_time.desc())
            .limit(50)
        )

    view_tasks: dict[str, Callable[[], Select[Any]]] = {
        "A single (num_traces>=5)": lambda: view(option_a, _SINGLE),
        "B single (num_traces>=5)": lambda: view(option_b, _SINGLE),
        "A combined": lambda: view(option_a, _COMBINED),
        "B combined": lambda: view(option_b, _COMBINED),
        "unfiltered page": lambda: (
            select(models.ProjectSession.id)
            .where(models.ProjectSession.project_id == project_id)
            .order_by(models.ProjectSession.start_time.desc())
            .limit(50)
        ),
    }
    view_results = measure(engine, view_tasks, runs)
    lines.append("**View-shaped** (median / p95 ms, {} runs):\n".format(runs))
    lines.append("| query | median ms | p95 ms |")
    lines.append("|---|---|---|")
    for label, result in view_results.items():
        lines.append(f"| {label} | {result['median_ms']:.1f} | {result['p95_ms']:.1f} |")
    lines.append("")

    plan_a = explain(engine, view(option_a, _COMBINED))
    plan_b = explain(engine, view(option_b, _COMBINED))
    checks = plan_check(dialect, plan_a, plan_b)
    lines.append("**Structural plan check:** " + ", ".join(f"{k}={v}" for k, v in checks.items()))
    lines.append(
        "\n<details><summary>Option A plan</summary>\n\n```\n" + plan_a + "\n```\n</details>"
    )
    lines.append(
        "<details><summary>Option B plan</summary>\n\n```\n" + plan_b + "\n```\n</details>\n"
    )

    # Sweep-shaped: candidate-scoped tick at 10/100/1000.
    session_ids = stats["session_ids"]
    sweep_tasks: dict[str, Callable[[], Select[Any]]] = {}
    for k in (10, 100, 1000):
        if k > len(session_ids):
            continue
        candidates = rng.sample(session_ids, k)
        sweep_tasks[f"A sweep k={k}"] = lambda cond=_COMBINED, cands=candidates: option_a(
            cond, project_id, cands
        )
        sweep_tasks[f"B sweep k={k}"] = lambda cond=_COMBINED, cands=candidates: option_b(
            cond, project_id, cands
        )
    sweep_results = measure(engine, sweep_tasks, runs)
    lines.append("**Sweep-shaped** (candidate-scoped, combined predicate):\n")
    lines.append("| query | median ms | p95 ms |")
    lines.append("|---|---|---|")
    for label, result in sweep_results.items():
        lines.append(f"| {label} | {result['median_ms']:.1f} | {result['p95_ms']:.1f} |")
    lines.append("")
    return "\n".join(lines)


def build_engine(dialect: str, postgres_url: Optional[str]) -> tuple[Engine, Optional[str]]:
    if dialect == "sqlite":
        tmp = NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        return create_engine(f"sqlite:///{tmp.name}"), tmp.name
    if not postgres_url:
        raise SystemExit("--postgres-url is required for --dialect postgresql")
    return create_engine(postgres_url), None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dialect", choices=["sqlite", "postgresql"], default="sqlite")
    parser.add_argument("--postgres-url", default=None)
    parser.add_argument("--sessions", type=int, nargs="+", default=[1000, 10000])
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--seed", type=int, default=1234)
    args = parser.parse_args()

    report: list[str] = [f"## {args.dialect} ({args.runs} runs/query)\n"]
    for n_sessions in args.sessions:
        engine, tmp_path = build_engine(args.dialect, args.postgres_url)
        rng = random.Random(args.seed)
        try:
            report.append(run_tier(engine, args.dialect, n_sessions, args.runs, rng))
        finally:
            engine.dispose()
    print("\n".join(report))


if __name__ == "__main__":
    main()
