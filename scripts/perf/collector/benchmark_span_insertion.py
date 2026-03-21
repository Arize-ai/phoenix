# /// script
# dependencies = []
# ///
"""
Span Insertion Benchmark

Measures span insertion performance across batch sizes and trace topologies.
Produces JSON (for programmatic consumption) and markdown table (for human reading)
with a comparison section showing percentage improvement between old and new paths.

Usage:
    python benchmark_span_insertion.py [options]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import aiosqlite
import sqlean
from sqlalchemy import StaticPool, event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from phoenix.db import models
from phoenix.db.engines import _dumps as _json_serializer
from phoenix.db.engines import set_sqlite_pragma
from phoenix.db.insertion.cumulative import recompute_trace_cumulative_values
from phoenix.db.insertion.span import insert_span
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode


@dataclass(frozen=True)
class BatchResult:
    """Result of a single batch insertion."""

    batch_size: int
    latency_sec: float
    query_count: int = 0

    @property
    def spans_per_sec(self) -> float:
        if self.latency_sec <= 0:
            return 0.0
        return self.batch_size / self.latency_sec


@dataclass
class BenchmarkRun:
    """Collects results for a single configuration (path + topology + batch_size)."""

    path_name: str
    topology: str
    batch_size: int
    results: list[BatchResult] = field(default_factory=list)

    def add_result(self, result: BatchResult) -> None:
        self.results.append(result)

    @property
    def latencies(self) -> list[float]:
        return [r.latency_sec for r in self.results]

    @property
    def query_counts(self) -> list[int]:
        return [r.query_count for r in self.results]

    def compute_stats(self) -> BenchmarkStats:
        lats = self.latencies
        if not lats:
            return BenchmarkStats()
        return BenchmarkStats(
            n_runs=len(lats),
            mean_latency=statistics.mean(lats),
            p50_latency=statistics.median(lats),
            p95_latency=_percentile(lats, 95),
            min_latency=min(lats),
            max_latency=max(lats),
            mean_spans_per_sec=statistics.mean([r.spans_per_sec for r in self.results]),
            mean_query_count=statistics.mean(self.query_counts) if any(self.query_counts) else 0,
        )


@dataclass(frozen=True)
class BenchmarkStats:
    """Computed statistics for a benchmark run."""

    n_runs: int = 0
    mean_latency: float = 0.0
    p50_latency: float = 0.0
    p95_latency: float = 0.0
    min_latency: float = 0.0
    max_latency: float = 0.0
    mean_spans_per_sec: float = 0.0
    mean_query_count: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "n_runs": self.n_runs,
            "mean_latency_sec": round(self.mean_latency, 6),
            "p50_latency_sec": round(self.p50_latency, 6),
            "p95_latency_sec": round(self.p95_latency, 6),
            "min_latency_sec": round(self.min_latency, 6),
            "max_latency_sec": round(self.max_latency, 6),
            "mean_spans_per_sec": round(self.mean_spans_per_sec, 2),
            "mean_query_count": round(self.mean_query_count, 1),
        }


@dataclass(frozen=True)
class ComparisonRow:
    """A single row in the old_path vs new_path comparison table."""

    topology: str
    batch_size: int
    old_stats: BenchmarkStats
    new_stats: BenchmarkStats

    @property
    def latency_improvement_pct(self) -> Optional[float]:
        if self.old_stats.p50_latency <= 0:
            return None
        return (
            (self.old_stats.p50_latency - self.new_stats.p50_latency)
            / self.old_stats.p50_latency
            * 100
        )

    @property
    def throughput_improvement_pct(self) -> Optional[float]:
        if self.old_stats.mean_spans_per_sec <= 0:
            return None
        return (
            (self.new_stats.mean_spans_per_sec - self.old_stats.mean_spans_per_sec)
            / self.old_stats.mean_spans_per_sec
            * 100
        )

    @property
    def query_reduction_pct(self) -> Optional[float]:
        if self.old_stats.mean_query_count <= 0:
            return None
        return (
            (self.old_stats.mean_query_count - self.new_stats.mean_query_count)
            / self.old_stats.mean_query_count
            * 100
        )


def _percentile(data: list[float], pct: int) -> float:
    """Compute the given percentile of a list of values."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (pct / 100)
    f = int(k)
    c = f + 1
    if c >= len(sorted_data):
        return sorted_data[-1]
    return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])


def _fmt_pct(value: Optional[float]) -> str:
    """Format a percentage value for display."""
    if value is None:
        return "N/A"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}%"


def _fmt_float(value: float, decimals: int = 4) -> str:
    """Format a float for table display."""
    return f"{value:.{decimals}f}"


def build_comparison(runs: list[BenchmarkRun]) -> list[ComparisonRow]:
    """Build comparison rows pairing old_path and new_path runs by topology + batch_size."""
    by_key: dict[tuple[str, int], dict[str, BenchmarkStats]] = {}
    for run in runs:
        key = (run.topology, run.batch_size)
        if key not in by_key:
            by_key[key] = {}
        by_key[key][run.path_name] = run.compute_stats()

    rows = []
    for (topology, batch_size), path_stats in sorted(
        by_key.items(), key=lambda x: (x[0][0], x[0][1])
    ):
        old = path_stats.get("old_path", BenchmarkStats())
        new = path_stats.get("new_path", BenchmarkStats())
        if old.n_runs > 0 and new.n_runs > 0:
            rows.append(
                ComparisonRow(
                    topology=topology,
                    batch_size=batch_size,
                    old_stats=old,
                    new_stats=new,
                )
            )
    return rows


def format_results_markdown(runs: list[BenchmarkRun]) -> str:
    """Format all benchmark results as a markdown string.

    Produces two sections:
    1. Detailed results table (all runs)
    2. Comparison table (old_path vs new_path with percentage improvement)
    """
    lines: list[str] = []

    # -- Section 1: Detailed Results --
    lines.append("## Span Insertion Benchmark Results\n")
    lines.append(
        "| Path | Topology | Batch Size | N Runs "
        "| P50 (s) | P95 (s) | Mean (s) | Spans/sec | Queries |"
    )
    lines.append(
        "|------|----------|----------:|-------:"
        "|--------:|--------:|---------:|----------:|--------:|"
    )

    for run in sorted(runs, key=lambda r: (r.path_name, r.topology, r.batch_size)):
        stats = run.compute_stats()
        if stats.n_runs == 0:
            continue
        lines.append(
            f"| {run.path_name} "
            f"| {run.topology} "
            f"| {run.batch_size} "
            f"| {stats.n_runs} "
            f"| {_fmt_float(stats.p50_latency)} "
            f"| {_fmt_float(stats.p95_latency)} "
            f"| {_fmt_float(stats.mean_latency)} "
            f"| {_fmt_float(stats.mean_spans_per_sec, 1)} "
            f"| {_fmt_float(stats.mean_query_count, 1)} |"
        )

    # -- Section 2: Comparison --
    comparisons = build_comparison(runs)
    if comparisons:
        lines.append("")
        lines.append("## Comparison: old_path vs new_path\n")
        lines.append(
            "| Topology | Batch Size "
            "| Old P50 (s) | New P50 (s) | Latency Improvement "
            "| Old Spans/s | New Spans/s | Throughput Improvement "
            "| Query Reduction |"
        )
        lines.append(
            "|----------|----------:"
            "|------------:|------------:|--------------------:"
            "|------------:|------------:|---------------------:"
            "|----------------:|"
        )
        for row in comparisons:
            lines.append(
                f"| {row.topology} "
                f"| {row.batch_size} "
                f"| {_fmt_float(row.old_stats.p50_latency)} "
                f"| {_fmt_float(row.new_stats.p50_latency)} "
                f"| {_fmt_pct(row.latency_improvement_pct)} "
                f"| {_fmt_float(row.old_stats.mean_spans_per_sec, 1)} "
                f"| {_fmt_float(row.new_stats.mean_spans_per_sec, 1)} "
                f"| {_fmt_pct(row.throughput_improvement_pct)} "
                f"| {_fmt_pct(row.query_reduction_pct)} |"
            )

    lines.append("")
    return "\n".join(lines)


def _build_summary(comparisons: list[ComparisonRow]) -> dict[str, Any]:
    """Build a summary section with environment info and key metrics."""
    import platform
    import sys

    # Aggregate key metrics across all comparisons
    latency_improvements = [
        r.latency_improvement_pct for r in comparisons if r.latency_improvement_pct is not None
    ]
    throughput_improvements = [
        r.throughput_improvement_pct
        for r in comparisons
        if r.throughput_improvement_pct is not None
    ]
    query_reductions = [
        r.query_reduction_pct for r in comparisons if r.query_reduction_pct is not None
    ]

    # Projections from the performance improvement design
    projections = {
        "throughput_improvement_pct": 40.0,
        "query_reduction_pct": 52.0,
    }

    def _mean_or_none(values: list[float]) -> Optional[float]:
        return round(statistics.mean(values), 2) if values else None

    mean_throughput = _mean_or_none(throughput_improvements)
    mean_query_reduction = _mean_or_none(query_reductions)

    passes_throughput = (
        mean_throughput is not None and mean_throughput >= projections["throughput_improvement_pct"]
    )
    passes_query_reduction = (
        mean_query_reduction is not None
        and mean_query_reduction >= projections["query_reduction_pct"]
    )

    return {
        "test_date": datetime.now().isoformat(),
        "environment": {
            "python_version": sys.version,
            "os": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        },
        "key_metrics": {
            "mean_latency_improvement_pct": _mean_or_none(latency_improvements),
            "mean_throughput_improvement_pct": mean_throughput,
            "mean_query_reduction_pct": mean_query_reduction,
        },
        "projections": projections,
        "pass_fail": {
            "throughput": "PASS" if passes_throughput else "FAIL",
            "query_reduction": "PASS" if passes_query_reduction else "FAIL",
        },
    }


def format_results_json(runs: list[BenchmarkRun]) -> dict[str, Any]:
    """Format all benchmark results as a JSON-serializable dict.

    Structure:
    {
        "summary": { test_date, environment, key_metrics, projections, pass_fail },
        "runs": [ { path_name, topology, batch_size, stats: {...} }, ... ],
        "comparison": [ { topology, batch_size, old: {...}, new: {...}, improvements: {...} }, ... ]
    }
    """
    run_entries = []
    for run in sorted(runs, key=lambda r: (r.path_name, r.topology, r.batch_size)):
        stats = run.compute_stats()
        if stats.n_runs == 0:
            continue
        run_entries.append(
            {
                "path_name": run.path_name,
                "topology": run.topology,
                "batch_size": run.batch_size,
                "stats": stats.to_dict(),
            }
        )

    comparison_entries = []
    comparisons = build_comparison(runs)
    for row in comparisons:
        comparison_entries.append(
            {
                "topology": row.topology,
                "batch_size": row.batch_size,
                "old_path": row.old_stats.to_dict(),
                "new_path": row.new_stats.to_dict(),
                "improvements": {
                    "latency_improvement_pct": (
                        round(row.latency_improvement_pct, 2)
                        if row.latency_improvement_pct is not None
                        else None
                    ),
                    "throughput_improvement_pct": (
                        round(row.throughput_improvement_pct, 2)
                        if row.throughput_improvement_pct is not None
                        else None
                    ),
                    "query_reduction_pct": (
                        round(row.query_reduction_pct, 2)
                        if row.query_reduction_pct is not None
                        else None
                    ),
                },
            }
        )

    return {
        "summary": _build_summary(comparisons),
        "runs": run_entries,
        "comparison": comparison_entries,
    }


def write_outputs(runs: list[BenchmarkRun], output_dir: Path) -> tuple[Path, Path]:
    """Write JSON and markdown output files. Returns (json_path, md_path)."""
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / "benchmark_results.json"
    md_path = output_dir / "benchmark_results.md"

    json_data = format_results_json(runs)
    json_path.write_text(json.dumps(json_data, indent=2) + "\n")

    md_text = format_results_markdown(runs)
    md_path.write_text(md_text)

    return json_path, md_path


def print_results(runs: list[BenchmarkRun]) -> None:
    """Print markdown results to stdout."""
    print(format_results_markdown(runs))


# ---------------------------------------------------------------------------
# Span generation
# ---------------------------------------------------------------------------

_NOW = datetime(2024, 1, 1, tzinfo=timezone.utc)

BATCH_SIZES = [100, 500, 1000]


class Topology(str, Enum):
    LINEAR = "linear"
    BRANCHING = "branching"
    MIXED = "mixed"


def _make_span(
    span_id: str,
    *,
    trace_id: str,
    parent_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status_code: SpanStatusCode = SpanStatusCode.OK,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> Span:
    """Create a single Span following the test helper pattern."""
    token_count: dict[str, int] = {}
    if prompt_tokens:
        token_count["prompt"] = prompt_tokens
    if completion_tokens:
        token_count["completion"] = completion_tokens
    attributes: dict[str, object] = {"llm": {"token_count": token_count}} if token_count else {}
    st = start_time or _NOW
    et = end_time or (st + timedelta(milliseconds=50))
    return Span(
        name=f"span-{span_id}",
        context=SpanContext(trace_id=trace_id, span_id=span_id),
        span_kind=SpanKind.CHAIN,
        parent_id=parent_id,
        start_time=st,
        end_time=et,
        status_code=status_code,
        status_message="",
        attributes=attributes,
        events=[],
        conversation=None,
    )


def _generate_linear_trace(trace_id: str, depth: int) -> list[Span]:
    """Generate a linear chain of spans: root -> child1 -> child2 -> ..."""
    spans: list[Span] = []
    parent_id: Optional[str] = None
    for i in range(depth):
        span_id = f"{trace_id}-s{i}"
        t = _NOW + timedelta(milliseconds=i * 50)
        span = _make_span(
            span_id,
            trace_id=trace_id,
            parent_id=parent_id,
            start_time=t,
            end_time=t + timedelta(milliseconds=50),
            prompt_tokens=1,
            completion_tokens=1,
            status_code=SpanStatusCode.ERROR if i == depth - 1 else SpanStatusCode.OK,
        )
        spans.append(span)
        parent_id = span_id
    return spans


def _generate_branching_trace(trace_id: str, fan_out: int, depth: int) -> list[Span]:
    """Generate a branching tree of spans with given fan-out and depth."""
    spans: list[Span] = []
    counter = 0

    def _build(parent_span_id: Optional[str], current_depth: int) -> None:
        nonlocal counter
        if current_depth >= depth:
            return
        for _ in range(fan_out if parent_span_id is not None else 1):
            span_id = f"{trace_id}-s{counter}"
            counter += 1
            t = _NOW + timedelta(milliseconds=counter * 10)
            is_leaf = current_depth == depth - 1
            span = _make_span(
                span_id,
                trace_id=trace_id,
                parent_id=parent_span_id,
                start_time=t,
                end_time=t + timedelta(milliseconds=50),
                prompt_tokens=2,
                completion_tokens=1,
                status_code=SpanStatusCode.ERROR if is_leaf else SpanStatusCode.OK,
            )
            spans.append(span)
            _build(span_id, current_depth + 1)

    _build(None, 0)
    return spans


def generate_spans(
    topology: Topology,
    total_spans: int,
    *,
    fan_out: int = 3,
    trace_depth: int = 5,
) -> list[Span]:
    """Generate a batch of spans with the specified topology and approximate count."""
    spans: list[Span] = []
    trace_num = 0

    if topology == Topology.LINEAR:
        while len(spans) < total_spans:
            trace_id = f"trace-lin-{trace_num}-{uuid.uuid4().hex[:8]}"
            trace_spans = _generate_linear_trace(trace_id, trace_depth)
            spans.extend(trace_spans)
            trace_num += 1

    elif topology == Topology.BRANCHING:
        while len(spans) < total_spans:
            trace_id = f"trace-br-{trace_num}-{uuid.uuid4().hex[:8]}"
            trace_spans = _generate_branching_trace(trace_id, fan_out, trace_depth)
            spans.extend(trace_spans)
            trace_num += 1

    elif topology == Topology.MIXED:
        while len(spans) < total_spans:
            if trace_num % 2 == 0:
                trace_id = f"trace-mix-lin-{trace_num}-{uuid.uuid4().hex[:8]}"
                trace_spans = _generate_linear_trace(trace_id, trace_depth)
            else:
                trace_id = f"trace-mix-br-{trace_num}-{uuid.uuid4().hex[:8]}"
                trace_spans = _generate_branching_trace(trace_id, fan_out, trace_depth)
            spans.extend(trace_spans)
            trace_num += 1

    return spans


# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

# Track keeper connections by engine id so they don't get GC'd
_KEEPERS: dict[int, Any] = {}


async def _create_engine(db_url: Optional[str] = None) -> AsyncEngine:
    """Create a database engine for benchmarking.

    If db_url is provided and starts with 'postgresql', creates a PostgreSQL
    engine via asyncpg. Otherwise creates an in-memory SQLite engine using sqlean.
    """
    if db_url and db_url.startswith("postgresql"):
        return await _create_pg_engine(db_url)
    return await _create_sqlite_engine()


async def _create_sqlite_engine() -> AsyncEngine:
    """Create an in-memory SQLite engine using sqlean for extensions."""
    sqlean.extensions.enable("text", "stats")
    db_name = f"benchmark_{uuid.uuid4().hex[:8]}"
    uri = f"file:{db_name}?mode=memory&cache=shared"

    # Keeper connection keeps the named in-memory DB alive
    keeper = sqlean.connect(uri, uri=True)

    def async_creator() -> aiosqlite.Connection:
        conn = aiosqlite.Connection(
            lambda: sqlean.connect(uri, uri=True),
            iter_chunk_size=64,
        )
        conn.daemon = True
        return conn

    engine = create_async_engine(
        url="sqlite+aiosqlite://",
        json_serializer=_json_serializer,
        async_creator=async_creator,
        poolclass=StaticPool,
    )
    event.listen(engine.sync_engine, "connect", set_sqlite_pragma)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

    # Store keeper so it doesn't get GC'd
    _KEEPERS[id(engine)] = keeper
    return engine


async def _create_pg_engine(db_url: str) -> AsyncEngine:
    """Create a PostgreSQL engine for benchmarking.

    Creates a fresh schema per engine instance to isolate benchmark runs.
    """
    from sqlalchemy import make_url, text

    url = make_url(db_url)
    # Ensure asyncpg driver
    if "asyncpg" not in url.drivername:
        url = url.set(drivername="postgresql+asyncpg")

    schema_name = f"benchmark_{uuid.uuid4().hex[:8]}"

    engine = create_async_engine(
        url,
        json_serializer=_json_serializer,
        pool_size=5,
        max_overflow=0,
    )

    # Create isolated schema and tables
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA {schema_name}"))
        await conn.execute(text(f"SET search_path TO {schema_name}"))
        await conn.run_sync(models.Base.metadata.create_all)

    # Set search_path for all future connections via pool events
    @event.listens_for(engine.sync_engine, "connect")
    def _set_search_path(dbapi_conn: Any, _: Any) -> None:
        cursor = dbapi_conn.cursor()
        cursor.execute(f"SET search_path TO {schema_name}")
        cursor.close()

    # Store schema name for cleanup
    _KEEPERS[id(engine)] = schema_name
    return engine


async def _dispose_engine(engine: AsyncEngine) -> None:
    """Dispose engine and clean up resources."""
    keeper = _KEEPERS.pop(id(engine), None)

    # If keeper is a schema name (PG), drop the schema
    if isinstance(keeper, str) and keeper.startswith("benchmark_"):
        from sqlalchemy import text

        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"DROP SCHEMA {keeper} CASCADE"))
        except Exception:
            pass

    await engine.dispose()

    # If keeper is a sqlite connection, close it
    if keeper is not None and hasattr(keeper, "close"):
        keeper.close()


# ---------------------------------------------------------------------------
# Query counting
# ---------------------------------------------------------------------------


class QueryCounter:
    """Counts SQL statements executed on a SQLAlchemy engine.

    Usage::

        counter = QueryCounter(engine)
        counter.start()
        # ... run queries ...
        n = counter.stop()
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self._sync_engine = engine.sync_engine
        self._count = 0

    def _on_execute(
        self,
        conn: Any,
        cursor: Any,
        statement: Any,
        parameters: Any,
        context: Any,
        executemany: Any,
    ) -> None:
        self._count += 1

    def start(self) -> None:
        self._count = 0
        event.listen(self._sync_engine, "before_cursor_execute", self._on_execute)

    def stop(self) -> int:
        event.remove(self._sync_engine, "before_cursor_execute", self._on_execute)
        return self._count

    @property
    def count(self) -> int:
        return self._count


# ---------------------------------------------------------------------------
# Benchmark runner
# ---------------------------------------------------------------------------

WARMUP_BATCHES = 3
MEASUREMENT_BATCHES = 20


async def _run_single_batch(
    engine: AsyncEngine,
    spans: list[Span],
    project_name: str,
) -> BatchResult:
    """Insert a batch of spans and measure wall-time. Returns BatchResult."""
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(engine, expire_on_commit=False)

    counter = QueryCounter(engine)
    trace_rowids: set[int] = set()

    counter.start()
    start = time.perf_counter()

    async with Session.begin() as session:
        for span in spans:
            result = await insert_span(session, span, project_name)
            if result is not None:
                trace_rowids.add(result.trace_rowid)

        if trace_rowids:
            await recompute_trace_cumulative_values(session, trace_rowids)

    elapsed = time.perf_counter() - start
    query_count = counter.stop()

    return BatchResult(
        batch_size=len(spans),
        latency_sec=elapsed,
        query_count=query_count,
    )


async def run_benchmark(
    batch_sizes: Optional[list[int]] = None,
    topologies: Optional[list[Topology]] = None,
    warmup_batches: int = WARMUP_BATCHES,
    measurement_batches: int = MEASUREMENT_BATCHES,
    fan_out: int = 3,
    trace_depth: int = 5,
    db_url: Optional[str] = None,
) -> list[BenchmarkRun]:
    """Run the full benchmark across all configurations.

    For each (batch_size, topology, path) combination:
    1. Warm-up phase: run `warmup_batches` batches (results discarded)
    2. Measurement phase: run `measurement_batches` batches (results collected)

    Configuration order is randomized to reduce ordering bias.
    Each configuration gets a fresh database to avoid cross-contamination.
    """
    if batch_sizes is None:
        batch_sizes = BATCH_SIZES
    if topologies is None:
        topologies = list(Topology)

    # Build all configurations
    configs: list[tuple[int, Topology]] = []
    for batch_size in batch_sizes:
        for topology in topologies:
            configs.append((batch_size, topology))

    # Randomize order to reduce ordering bias
    random.shuffle(configs)

    runs: list[BenchmarkRun] = []

    for batch_size, topology in configs:
        print(f"  {topology.value} batch_size={batch_size} ...", end=" ", flush=True)

        run = BenchmarkRun(
            path_name="batch_recompute",
            topology=topology.value,
            batch_size=batch_size,
        )

        # Fresh DB for each configuration
        engine = await _create_engine(db_url)
        try:
            batch_num = 0
            for phase, n_batches in [("warmup", warmup_batches), ("measure", measurement_batches)]:
                for _ in range(n_batches):
                    # Generate fresh spans for each batch (unique IDs each time)
                    spans = generate_spans(
                        topology, batch_size, fan_out=fan_out, trace_depth=trace_depth
                    )
                    project_name = f"bench-{batch_num}"
                    batch_num += 1

                    result = await _run_single_batch(engine, spans, project_name)

                    if phase == "measure":
                        run.add_result(result)
        finally:
            await _dispose_engine(engine)

        stats = run.compute_stats()
        print(f"p50={stats.p50_latency:.4f}s  spans/s={stats.mean_spans_per_sec:.0f}")
        runs.append(run)

    return runs


async def async_main(
    batch_sizes: Optional[list[int]] = None,
    topologies: Optional[list[Topology]] = None,
    measurement_batches: int = MEASUREMENT_BATCHES,
    output_dir: Optional[Path] = None,
    db_url: Optional[str] = None,
) -> list[BenchmarkRun]:
    """Main async entry point for the benchmark."""
    db_label = "PostgreSQL" if db_url and db_url.startswith("postgresql") else "SQLite (in-memory)"
    print(f"Starting span insertion benchmark on {db_label}...")
    print(f"  Warmup: {WARMUP_BATCHES} batches, Measurement: {measurement_batches} batches")
    print()

    runs = await run_benchmark(
        batch_sizes=batch_sizes,
        topologies=topologies,
        measurement_batches=measurement_batches,
        db_url=db_url,
    )

    print()
    print_results(runs)

    if output_dir is not None:
        json_path, md_path = write_outputs(runs, output_dir)
        print(f"\nResults written to:\n  {json_path}\n  {md_path}")

    return runs


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark span insertion performance (old vs new path).",
    )
    parser.add_argument(
        "--batch-sizes",
        type=str,
        default="100,500,1000",
        help="Comma-separated batch sizes (default: 100,500,1000)",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=MEASUREMENT_BATCHES,
        help=f"Number of measurement batches per configuration (default: {MEASUREMENT_BATCHES})",
    )
    parser.add_argument(
        "--topologies",
        type=str,
        default="linear,branching,mixed",
        help="Comma-separated topologies (default: linear,branching,mixed)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for JSON and markdown files (default: stdout only)",
    )
    parser.add_argument(
        "--db-url",
        type=str,
        default=None,
        help="Database URL (default: in-memory SQLite). Use postgresql://user@host/dbname for PG.",
    )
    return parser.parse_args(argv)


def main(argv: Optional[list[str]] = None) -> None:
    """CLI entry point."""
    args = _parse_args(argv)

    batch_sizes = [int(x.strip()) for x in args.batch_sizes.split(",")]
    topologies = [Topology(x.strip()) for x in args.topologies.split(",")]
    output_dir = Path(args.output) if args.output else None

    asyncio.run(
        async_main(
            batch_sizes=batch_sizes,
            topologies=topologies,
            measurement_batches=args.runs,
            output_dir=output_dir,
            db_url=args.db_url,
        )
    )


if __name__ == "__main__":
    main()
