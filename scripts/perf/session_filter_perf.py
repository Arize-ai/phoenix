"""Perf harness for the session filter DSL, measured through the seams the server calls.

Every measured query is built by ``phoenix.server.session_filters`` —
``apply_session_filter_to_page`` for a page and ``get_filtered_session_rowids_subquery`` for a
count or a sweep — so the harness tracks the shipped dispatch instead of a local reconstruction
of it. The filter-and-sort overlap case composes ``ProjectSessionSort`` with the page seam the
same way the sessions resolver does.

The report is a matrix over three axes:

- **construct family** — aggregate, quantifier (``any`` and ``all``), reduction, root-span IO in
  both its window and its ``EXISTS`` form, wire-key attribute, and annotation;
- **access pattern** — page (a paginated, project-wide filter), count (an exact filtered count),
  and sweep (the online-eval tick, scoped to a small candidate set);
- **selectivity** — frequent, rare, and zero-match, because ``any`` exits on the first match and
  ``all`` on the first counterexample, so their costs invert across those regimes.

Each measured query runs ``--runs`` times in randomized order; we report median and p95
wall-clock.

Usage::

    uv run python scripts/perf/session_filter_perf.py --dialect sqlite --sessions 1000 10000
    uv run python scripts/perf/session_filter_perf.py --dialect postgresql \
        --postgres-url postgresql+psycopg://user@localhost:5432/perf --sessions 1000

SQLite seeds a temp file DB. PostgreSQL needs an empty target database; pointing
``--postgres-url`` at one that already has tables requires ``--drop-existing``. Seeding is bulk
Core inserts; larger tiers require proportionally more memory for seeding.
"""

from __future__ import annotations

import argparse
import random
import statistics
import time
from datetime import datetime, timedelta, timezone
from tempfile import NamedTemporaryFile
from typing import Any, Callable, NamedTuple, Optional

from sqlalchemy import Engine, create_engine, func, inspect, select, text
from sqlalchemy.sql.expression import Select

from phoenix.db import models
from phoenix.server.api.input_types.ProjectSessionSort import (
    ProjectSessionColumn,
    ProjectSessionSort,
)
from phoenix.server.api.types.SortDir import SortDir
from phoenix.server.session_filters import (
    apply_session_filter_to_page,
    get_filtered_session_rowids_subquery,
)

_EPOCH = datetime(2024, 1, 1, tzinfo=timezone.utc)
_PAGE_SIZE = 50
_ABSENT = "no-such-value-in-the-seed"

# Seeded frequencies the selectivity labels below are read from.
_ERROR_SESSION_RATE = 0.05
_LLM_ONLY_SESSION_RATE = 0.05
_ANNOTATED_SESSION_RATE = 0.30
_MULTI_IDENTIFIER_RATE = 0.20
_SPAN_ANNOTATION_RATE = 0.10
_MODELS = ("gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet", None)
_INPUTS = ("where is my refund", "cancel my order", "reset my password")


class Condition(NamedTuple):
    family: str
    selectivity: str
    condition: str


CONDITIONS: tuple[Condition, ...] = (
    Condition("aggregate", "frequent", "num_traces >= 2"),
    Condition("aggregate", "rare", "num_traces >= 30"),
    Condition("aggregate", "zero", "num_traces >= 100000"),
    Condition("quantifier any", "frequent", 'any(s.span_kind == "TOOL" for s in spans)'),
    Condition("quantifier any", "rare", 'any(s.status_code == "ERROR" for s in spans)'),
    Condition("quantifier any", "zero", f'any(s.name == "{_ABSENT}" for s in spans)'),
    Condition("quantifier all", "frequent", 'all(s.status_code == "OK" for s in spans)'),
    Condition("quantifier all", "rare", 'all(s.span_kind == "LLM" for s in spans)'),
    Condition("quantifier all", "zero", f'all(s.name == "{_ABSENT}" for s in spans)'),
    Condition("reduction", "frequent", 'len([s for s in spans if s.span_kind == "TOOL"]) >= 1'),
    Condition("reduction", "rare", 'len([s for s in spans if s.span_kind == "TOOL"]) >= 60'),
    Condition("reduction", "zero", 'len([s for s in spans if s.span_kind == "TOOL"]) >= 100000'),
    Condition("cost detail reduction", "frequent", "sum(d.tokens for d in span_cost_details) > 0"),
    Condition("cost detail reduction", "rare", "sum(d.tokens for d in span_cost_details) > 400"),
    Condition(
        "cost detail reduction", "zero", "sum(d.tokens for d in span_cost_details) > 1000000000"
    ),
    Condition("span annotation", "frequent", "any(a.score >= 0.0 for a in span_annotations)"),
    Condition("span annotation", "rare", "any(a.score > 0.99 for a in span_annotations)"),
    Condition("span annotation", "zero", "any(a.score > 1.5 for a in span_annotations)"),
    Condition("io window", "frequent", "'refund' in first_input or 'order' in first_input"),
    Condition("io window", "rare", "'password' in first_input"),
    Condition("io window", "zero", f"'{_ABSENT}' in first_input"),
    Condition("io exists", "frequent", "'refund' in any_input or 'order' in any_input"),
    Condition("io exists", "rare", "'password' in any_input"),
    Condition("io exists", "zero", f"'{_ABSENT}' in any_input"),
    Condition("attribute", "frequent", '"gpt" in attributes["llm.model_name"]'),
    Condition("attribute", "rare", 'attributes["llm.model_name"] == "claude-3-5-sonnet"'),
    Condition("attribute", "zero", f'attributes["llm.model_name"] == "{_ABSENT}"'),
    Condition("annotation", "frequent", 'annotations["Quality"].score >= 0.0'),
    Condition("annotation", "rare", 'annotations["Quality"].score > 0.95'),
    Condition("annotation", "zero", 'annotations["Quality"].score > 1.5'),
)

_SORT_OVERLAP_CONDITION = "num_traces >= 5"


# --- seeding ---------------------------------------------------------------------------------


def _skewed_num_traces(rng: random.Random) -> int:
    """Skewed traces-per-session: most sessions are short, a long tail is deep."""
    roll = rng.random()
    if roll < 0.80:
        return rng.randint(1, 4)
    if roll < 0.95:
        return rng.randint(5, 20)
    return rng.randint(20, 60)


def seed(
    engine: Engine,
    n_sessions: int,
    rng: random.Random,
    *,
    reset: bool = True,
    project_name: str = "perf",
    id_prefix: str = "",
) -> dict[str, Any]:
    """Bulk-seed one project with ``n_sessions`` skewed sessions; return counts + rowids."""
    if reset:
        models.Base.metadata.drop_all(engine)
        models.Base.metadata.create_all(engine)
    trace_rows: list[dict[str, Any]] = []
    span_rows: list[dict[str, Any]] = []
    cost_rows: list[dict[str, Any]] = []
    session_rows: list[dict[str, Any]] = []
    session_annotation_rows: list[dict[str, Any]] = []

    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            conn.exec_driver_sql("PRAGMA synchronous=OFF")
            conn.exec_driver_sql("PRAGMA journal_mode=MEMORY")
        project_id = conn.execute(
            models.Project.__table__.insert().values(name=project_name).returning(models.Project.id)
        ).scalar_one()

        for _ in range(n_sessions):
            start = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            session_rows.append(
                {
                    "session_id": f"{id_prefix}s{rng.getrandbits(48):x}",
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

        erroring_sessions: set[int] = set()
        llm_only_sessions: set[int] = set()
        span_counter = 0
        trace_counter = 0
        for session_rowid in session_ids:
            # 0.02 flat cost per trace ⇒ any session with >=5 traces clears the 0.1 cost bar.
            num_traces = _skewed_num_traces(rng)
            if rng.random() < _ERROR_SESSION_RATE:
                erroring_sessions.add(session_rowid)
            if rng.random() < _LLM_ONLY_SESSION_RATE:
                llm_only_sessions.add(session_rowid)
            base = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            for trace_index in range(num_traces):
                trace_start = base + timedelta(seconds=trace_index)
                trace_rows.append(
                    {
                        "trace_id": f"{id_prefix}t{trace_counter:x}",
                        "project_rowid": project_id,
                        "project_session_rowid": session_rowid,
                        "start_time": trace_start,
                        "end_time": trace_start + timedelta(seconds=2),
                    }
                )
                trace_counter += 1
            if rng.random() < _ANNOTATED_SESSION_RATE:
                identifiers = ["primary"]
                if rng.random() < _MULTI_IDENTIFIER_RATE:
                    identifiers.append("second-pass")
                for identifier in identifiers:
                    session_annotation_rows.append(
                        _annotation_row(
                            {"project_session_id": session_rowid},
                            score=round(rng.random(), 3),
                            identifier=identifier,
                        )
                    )
        conn.execute(models.Trace.__table__.insert(), trace_rows)
        if session_annotation_rows:
            conn.execute(
                models.ProjectSessionAnnotation.__table__.insert(), session_annotation_rows
            )
        trace_ids = list(
            conn.execute(
                select(models.Trace.id, models.Trace.project_session_rowid).where(
                    models.Trace.project_rowid == project_id
                )
            )
        )

        annotated_span_ids: list[str] = []
        for trace_id, session_rowid in trace_ids:
            spans_in_trace = rng.randint(8, 16)
            root_span_id = f"{id_prefix}sp{span_counter:x}"
            root_start = _EPOCH + timedelta(seconds=rng.randint(0, 10_000_000))
            model = rng.choice(_MODELS)
            attributes: dict[str, Any] = {"input": {"value": rng.choice(_INPUTS)}}
            if model is not None:
                attributes["llm"] = {"model_name": model}
            span_rows.append(
                _span_row(root_span_id, None, trace_id, "LLM", root_start, attributes=attributes)
            )
            span_counter += 1
            cost_rows.append(
                {
                    "span_rowid": None,
                    "trace_rowid": trace_id,
                    "span_start_time": root_start,
                    "total_cost": 0.02,
                    "prompt_cost": 0.02,
                    "completion_cost": 0.0,
                    "_root_span_id": root_span_id,
                }
            )
            for _ in range(spans_in_trace - 1):
                if session_rowid in llm_only_sessions:
                    kind = "LLM"
                else:
                    kind = "TOOL" if rng.random() < 0.5 else "LLM"
                errored = session_rowid in erroring_sessions and rng.random() < 0.2
                span_id = f"{id_prefix}sp{span_counter:x}"
                span_rows.append(
                    _span_row(
                        span_id,
                        root_span_id,
                        trace_id,
                        kind,
                        root_start,
                        status_code="ERROR" if errored else "OK",
                    )
                )
                if rng.random() < _SPAN_ANNOTATION_RATE:
                    annotated_span_ids.append(span_id)
                span_counter += 1
        conn.execute(models.Span.__table__.insert(), span_rows)

        span_rowids = dict(
            conn.execute(
                select(models.Span.span_id, models.Span.id).where(
                    models.Span.trace_rowid.in_(
                        select(models.Trace.id).where(models.Trace.project_rowid == project_id)
                    )
                )
            ).all()
        )
        for cost_row in cost_rows:
            cost_row["span_rowid"] = span_rowids[cost_row.pop("_root_span_id")]
        conn.execute(models.SpanCost.__table__.insert(), cost_rows)

        if annotated_span_ids:
            conn.execute(
                models.SpanAnnotation.__table__.insert(),
                [
                    _annotation_row(
                        {"span_rowid": span_rowids[span_id]},
                        score=round(rng.random(), 3),
                        identifier="primary",
                    )
                    for span_id in annotated_span_ids
                ],
            )

        cost_ids = list(
            conn.execute(
                select(models.SpanCost.id).where(
                    models.SpanCost.trace_rowid.in_(
                        select(models.Trace.id).where(models.Trace.project_rowid == project_id)
                    )
                )
            ).scalars()
        )
        detail_rows = [
            {
                "span_cost_id": cost_id,
                "token_type": token_type,
                "is_prompt": is_prompt,
                "cost": 0.01,
                "tokens": 5,
                "cost_per_token": 0.002,
            }
            for cost_id in cost_ids
            for token_type, is_prompt in (("input", True), ("output", False))
        ]
        conn.execute(models.SpanCostDetail.__table__.insert(), detail_rows)

        if engine.dialect.name == "postgresql":
            conn.exec_driver_sql("ANALYZE")

    return {
        "project_id": project_id,
        "session_ids": session_ids,
        "n_sessions": len(session_ids),
        "n_traces": len(trace_rows),
        "n_spans": len(span_rows),
        "n_session_annotations": len(session_annotation_rows),
        "n_span_annotations": len(annotated_span_ids),
        "n_cost_details": len(detail_rows),
    }


def _annotation_row(key: dict[str, Any], score: float, identifier: str) -> dict[str, Any]:
    return {
        **key,
        "name": "Quality",
        "label": "good" if score >= 0.5 else "poor",
        "score": score,
        "metadata": {},
        "annotator_kind": "HUMAN",
        "source": "APP",
        "identifier": identifier,
    }


def _span_row(
    span_id: str,
    parent_id: Optional[str],
    trace_rowid: int,
    kind: str,
    start: datetime,
    attributes: Optional[dict[str, Any]] = None,
    status_code: str = "OK",
) -> dict[str, Any]:
    return {
        "trace_rowid": trace_rowid,
        "span_id": span_id,
        "parent_id": parent_id,
        "name": "op",
        "span_kind": kind,
        "start_time": start,
        "end_time": start + timedelta(seconds=1),
        "attributes": attributes or {},
        "events": [],
        "status_code": status_code,
        "status_message": "",
        "cumulative_error_count": 1 if status_code == "ERROR" else 0,
        "cumulative_llm_token_count_prompt": 5,
        "cumulative_llm_token_count_completion": 7,
        "llm_token_count_prompt": 5 if kind == "LLM" else None,
        "llm_token_count_completion": 7 if kind == "LLM" else None,
    }


# --- query shapes ----------------------------------------------------------------------------


def page(condition: str, project_id: int) -> Select[Any]:
    """A paginated project-wide filter, built exactly as the sessions resolver builds it."""
    stmt = select(models.ProjectSession.id).where(models.ProjectSession.project_id == project_id)
    stmt = apply_session_filter_to_page(stmt, condition, project_rowids=[project_id])
    return stmt.order_by(models.ProjectSession.start_time.desc()).limit(_PAGE_SIZE)


def sorted_page(condition: str, project_id: int) -> Select[Any]:
    """A page ordered by an aggregate column while filtering on the same aggregate."""
    stmt = select(models.ProjectSession).where(models.ProjectSession.project_id == project_id)
    sort_config = ProjectSessionSort(
        col=ProjectSessionColumn.numTraces, dir=SortDir.desc
    ).update_orm_expr(stmt, project_rowids=[project_id])
    stmt = apply_session_filter_to_page(
        sort_config.stmt,
        condition,
        project_rowids=[project_id],
        prejoined_aggregate=sort_config.prejoined_aggregate,
    )
    return stmt.limit(_PAGE_SIZE)


def count(condition: str, project_id: int) -> Select[Any]:
    """An exact filtered session count."""
    return (
        select(func.count(models.ProjectSession.id))
        .where(models.ProjectSession.project_id == project_id)
        .where(
            models.ProjectSession.id.in_(
                get_filtered_session_rowids_subquery(condition, project_rowids=[project_id])
            )
        )
    )


def sweep(condition: str, project_id: int, candidates: list[int]) -> Select[Any]:
    """The online-eval tick: the filter resolved against a small candidate set."""
    return (
        select(models.ProjectSession.id)
        .where(models.ProjectSession.project_id == project_id)
        .where(models.ProjectSession.id.in_(candidates))
        .where(
            models.ProjectSession.id.in_(
                get_filtered_session_rowids_subquery(condition, project_rowids=[project_id])
            )
        )
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


def _matched(engine: Engine, condition: str, project_id: int) -> int:
    with engine.connect() as conn:
        return int(conn.execute(count(condition, project_id)).scalar_one())


def explain(engine: Engine, stmt: Select[Any]) -> str:
    compiled = str(stmt.compile(engine, compile_kwargs={"literal_binds": True}))
    keyword = "EXPLAIN QUERY PLAN" if engine.dialect.name == "sqlite" else "EXPLAIN ANALYZE"
    with engine.connect() as conn:
        rows = conn.execute(text(f"{keyword} {compiled}")).fetchall()
    return "\n".join(" ".join(str(cell) for cell in row) for row in rows)


# --- driver ----------------------------------------------------------------------------------


def run_tier(engine: Engine, dialect: str, n_sessions: int, runs: int, rng: random.Random) -> str:
    stats = seed(engine, n_sessions, rng)
    project_id = stats["project_id"]
    session_ids = stats["session_ids"]
    lines: list[str] = []
    lines.append(
        f"### {dialect} — {stats['n_sessions']} sessions, "
        f"{stats['n_traces']} traces, {stats['n_spans']} spans, "
        f"{stats['n_session_annotations']} session annotations, "
        f"{stats['n_span_annotations']} span annotations, "
        f"{stats['n_cost_details']} cost details\n"
    )

    sweep_candidates = rng.sample(session_ids, min(1000, len(session_ids)))
    matched = {spec.condition: _matched(engine, spec.condition, project_id) for spec in CONDITIONS}

    tasks: dict[str, Callable[[], Select[Any]]] = {}
    for spec in CONDITIONS:
        key = f"{spec.family}|{spec.selectivity}"
        tasks[f"{key}|page"] = lambda c=spec.condition: page(c, project_id)
        tasks[f"{key}|count"] = lambda c=spec.condition: count(c, project_id)
        tasks[f"{key}|sweep"] = lambda c=spec.condition, k=sweep_candidates: sweep(c, project_id, k)
    tasks["baseline|-|unfiltered page"] = lambda: (
        select(models.ProjectSession.id)
        .where(models.ProjectSession.project_id == project_id)
        .order_by(models.ProjectSession.start_time.desc())
        .limit(_PAGE_SIZE)
    )
    tasks["sort overlap|-|page"] = lambda: sorted_page(_SORT_OVERLAP_CONDITION, project_id)
    results = measure(engine, tasks, runs)

    lines.append(f"**Matrix** (median / p95 ms, {runs} runs):\n")
    lines.append("| family | selectivity | access | matched sessions | median ms | p95 ms |")
    lines.append("|---|---|---|---|---|---|")
    for spec in CONDITIONS:
        for access in ("page", "count", "sweep"):
            result = results[f"{spec.family}|{spec.selectivity}|{access}"]
            lines.append(
                f"| {spec.family} | {spec.selectivity} | {access} | {matched[spec.condition]} "
                f"| {result['median_ms']:.1f} | {result['p95_ms']:.1f} |"
            )
    for label in ("baseline|-|unfiltered page", "sort overlap|-|page"):
        family, selectivity, access = label.split("|")
        result = results[label]
        lines.append(
            f"| {family} | {selectivity} | {access} | — "
            f"| {result['median_ms']:.1f} | {result['p95_ms']:.1f} |"
        )
    lines.append("")

    lines.append("**Conditions measured:**\n")
    lines.append("| family | selectivity | condition |")
    lines.append("|---|---|---|")
    for spec in CONDITIONS:
        lines.append(f"| {spec.family} | {spec.selectivity} | `{spec.condition}` |")
    lines.append(f"| sort overlap | — | `{_SORT_OVERLAP_CONDITION}` ordered by numTraces |")
    lines.append("")

    plan = explain(engine, sorted_page(_SORT_OVERLAP_CONDITION, project_id))
    lines.append(
        "<details><summary>Sorted-page plan</summary>\n\n```\n" + plan + "\n```\n</details>\n"
    )
    return "\n".join(lines)


def build_engine(
    dialect: str, postgres_url: Optional[str], drop_existing: bool
) -> tuple[Engine, Optional[str]]:
    if dialect == "sqlite":
        # The production driver: sqlean's `text` extension supplies the `text_contains` UDF the
        # containment predicates compile to on SQLite.
        import sqlean  # type: ignore[import-untyped]

        sqlean.extensions.enable("text")
        tmp = NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        return create_engine(f"sqlite:///{tmp.name}", module=sqlean), tmp.name
    if not postgres_url:
        raise SystemExit("--postgres-url is required for --dialect postgresql")
    engine = create_engine(postgres_url)
    # Seeding drops every table it is about to recreate, so a mistyped URL would destroy whatever
    # lives at the target. Refuse unless the database is empty or the caller opted in explicitly.
    existing = inspect(engine).get_table_names()
    if existing and not drop_existing:
        engine.dispose()
        raise SystemExit(
            f"{postgres_url} already has {len(existing)} tables; seeding would drop them. "
            "Point --postgres-url at an empty database, or pass --drop-existing."
        )
    return engine, None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dialect", choices=["sqlite", "postgresql"], default="sqlite")
    parser.add_argument("--postgres-url", default=None)
    parser.add_argument("--sessions", type=int, nargs="+", default=[1000, 10000])
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument(
        "--drop-existing",
        action="store_true",
        help="Allow seeding to drop the tables already present in the target database.",
    )
    args = parser.parse_args()

    engine, _ = build_engine(args.dialect, args.postgres_url, args.drop_existing)
    report: list[str] = [f"## {args.dialect} ({args.runs} runs/query)\n"]
    try:
        for n_sessions in args.sessions:
            rng = random.Random(args.seed)
            report.append(run_tier(engine, args.dialect, n_sessions, args.runs, rng))
    finally:
        engine.dispose()
    print("\n".join(report))


if __name__ == "__main__":
    main()
