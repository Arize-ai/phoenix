# /// script
# dependencies = []
# ///
"""
Span Insertion Benchmark

Measures span insertion performance across batch sizes and trace topologies.
Produces JSON (for programmatic consumption) and markdown table (for human reading).

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
from typing import Any, AsyncIterator, Awaitable, Callable, Optional, Protocol, runtime_checkable

import aiosqlite
import sqlean
from sqlalchemy import StaticPool, event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from phoenix.db import models
from phoenix.db.engines import _dumps as _json_serializer
from phoenix.db.engines import set_sqlite_pragma
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode


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
class SampleResult:
    """Result of a single benchmark sample (one runner invocation)."""

    latency_sec: float
    query_count: int


@dataclass(frozen=True)
class BenchmarkSuiteResult:
    """Aggregated results for a full benchmark suite run."""

    runner_name: str
    workload: WorkloadSpec
    samples: list[SampleResult] = field(default_factory=list)

    @property
    def latencies(self) -> list[float]:
        return [s.latency_sec for s in self.samples]

    @property
    def query_counts(self) -> list[int]:
        return [s.query_count for s in self.samples]

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
            mean_spans_per_sec=statistics.mean(
                [
                    self.workload.batch_size / s.latency_sec
                    for s in self.samples
                    if s.latency_sec > 0
                ]
            )
            if any(s.latency_sec > 0 for s in self.samples)
            else 0.0,
            mean_query_count=statistics.mean(self.query_counts) if any(self.query_counts) else 0,
        )


EngineFactory = Callable[[], Awaitable[AsyncEngine]]


@runtime_checkable
class Runner(Protocol):
    @property
    def name(self) -> str: ...

    async def run_sample(
        self,
        engine_factory: EngineFactory,
        workload: WorkloadSpec,
    ) -> SampleResult: ...


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


def _fmt_float(value: float, decimals: int = 4) -> str:
    """Format a float for table display."""
    return f"{value:.{decimals}f}"


def _build_environment_metadata(
    db_url: Optional[str] = None,
    seed: Optional[int] = None,
) -> dict[str, Any]:
    """Build environment metadata block."""
    import platform
    import subprocess
    import sys

    git_sha = "unknown"
    try:
        git_sha = (
            subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                stderr=subprocess.DEVNULL,
            )
            .decode()
            .strip()
        )
    except Exception:
        pass

    db_backend = "postgresql" if db_url and db_url.startswith("postgresql") else "sqlite"
    return {
        "git_sha": git_sha,
        "python_version": sys.version,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "db_backend": db_backend,
        "seed": seed,
    }


def format_results_markdown(
    results: list[BenchmarkSuiteResult],
    db_url: Optional[str] = None,
    seed: Optional[int] = None,
) -> str:
    """Format benchmark results as a markdown string."""
    lines: list[str] = []

    lines.append("## Span Insertion Benchmark Results\n")
    lines.append(
        "| Runner | Topology | Batch | Samples "
        "| P50 (s) | P95 (s) | Mean (s) "
        "| Spans/sec | Queries |"
    )
    lines.append(
        "|--------|----------|------:|--------:"
        "|--------:|--------:|--------:"
        "|----------:|--------:|"
    )

    for sr in sorted(
        results,
        key=lambda r: (
            r.runner_name,
            r.workload.topology.value,
            r.workload.batch_size,
        ),
    ):
        stats = sr.compute_stats()
        if stats.n_runs == 0:
            continue
        lines.append(
            f"| {sr.runner_name} "
            f"| {sr.workload.topology.value} "
            f"| {sr.workload.batch_size} "
            f"| {stats.n_runs} "
            f"| {_fmt_float(stats.p50_latency)} "
            f"| {_fmt_float(stats.p95_latency)} "
            f"| {_fmt_float(stats.mean_latency)} "
            f"| {_fmt_float(stats.mean_spans_per_sec, 1)} "
            f"| {_fmt_float(stats.mean_query_count, 1)} |"
        )

    env = _build_environment_metadata(db_url, seed)
    lines.append("")
    lines.append("### Environment\n")
    lines.append(f"- **Git SHA:** `{env['git_sha']}`")
    lines.append(f"- **Python:** {env['python_version']}")
    lines.append(f"- **Platform:** {env['platform']}")
    lines.append(f"- **DB Backend:** {env['db_backend']}")
    if env["seed"] is not None:
        lines.append(f"- **Seed:** {env['seed']}")

    lines.append("")
    return "\n".join(lines)


def format_results_json(
    results: list[BenchmarkSuiteResult],
    db_url: Optional[str] = None,
    seed: Optional[int] = None,
) -> dict[str, Any]:
    """Format benchmark results as a JSON-serializable dict."""
    run_entries = []
    for sr in sorted(
        results,
        key=lambda r: (
            r.runner_name,
            r.workload.topology.value,
            r.workload.batch_size,
        ),
    ):
        stats = sr.compute_stats()
        if stats.n_runs == 0:
            continue
        run_entries.append(
            {
                "runner": sr.runner_name,
                "topology": sr.workload.topology.value,
                "batch_size": sr.workload.batch_size,
                "session_mode": sr.workload.session_mode.value,
                "project_mode": sr.workload.project_mode.value,
                "token_mode": sr.workload.token_mode.value,
                "stats": stats.to_dict(),
            }
        )

    return {
        "environment": _build_environment_metadata(db_url, seed),
        "results": run_entries,
    }


def write_outputs(
    results: list[BenchmarkSuiteResult],
    output_dir: Path,
    db_url: Optional[str] = None,
    seed: Optional[int] = None,
) -> tuple[Path, Path]:
    """Write JSON and markdown output files. Returns (json_path, md_path)."""
    output_dir.mkdir(parents=True, exist_ok=True)

    json_path = output_dir / "benchmark_results.json"
    md_path = output_dir / "benchmark_results.md"

    json_data = format_results_json(results, db_url=db_url, seed=seed)
    json_path.write_text(json.dumps(json_data, indent=2) + "\n")

    md_text = format_results_markdown(results, db_url=db_url, seed=seed)
    md_path.write_text(md_text)

    return json_path, md_path


def print_results(
    results: list[BenchmarkSuiteResult],
    db_url: Optional[str] = None,
    seed: Optional[int] = None,
) -> None:
    """Print markdown results to stdout."""
    print(format_results_markdown(results, db_url=db_url, seed=seed))


# ---------------------------------------------------------------------------
# Span generation
# ---------------------------------------------------------------------------

_NOW = datetime(2024, 1, 1, tzinfo=timezone.utc)

BATCH_SIZES = [100, 500, 1000]


class Topology(str, Enum):
    LINEAR = "linear"
    BRANCHING = "branching"
    MIXED = "mixed"


class SessionMode(str, Enum):
    SINGLE = "single"
    PER_TRACE = "per_trace"


class ProjectMode(str, Enum):
    SINGLE = "single"
    ROUND_ROBIN = "round_robin"


class TokenMode(str, Enum):
    NONE = "none"
    FIXED = "fixed"
    VARIABLE = "variable"


@dataclass(frozen=True)
class WorkloadSpec:
    """Describes a single benchmark workload configuration."""

    batch_size: int
    topology: Topology
    fan_out: int = 3
    trace_depth: int = 5
    session_mode: SessionMode = SessionMode.SINGLE
    project_mode: ProjectMode = ProjectMode.SINGLE
    token_mode: TokenMode = TokenMode.FIXED
    seed: int = 42


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
    session_id: Optional[str] = None,
) -> Span:
    """Create a single Span following the test helper pattern."""
    token_count: dict[str, int] = {}
    if prompt_tokens:
        token_count["prompt"] = prompt_tokens
    if completion_tokens:
        token_count["completion"] = completion_tokens
    attributes: dict[str, object] = {}
    if token_count:
        attributes["llm"] = {"token_count": token_count}
    if session_id is not None:
        attributes["session"] = {"id": session_id}
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


def _generate_linear_trace(
    trace_id: str,
    depth: int,
    *,
    session_id: Optional[str] = None,
    prompt_tokens: int = 1,
    completion_tokens: int = 1,
) -> list[Span]:
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
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            status_code=(SpanStatusCode.ERROR if i == depth - 1 else SpanStatusCode.OK),
            session_id=session_id,
        )
        spans.append(span)
        parent_id = span_id
    return spans


def _generate_branching_trace(
    trace_id: str,
    fan_out: int,
    depth: int,
    *,
    session_id: Optional[str] = None,
    prompt_tokens: int = 2,
    completion_tokens: int = 1,
) -> list[Span]:
    """Generate a branching tree of spans with given fan-out and depth."""
    spans: list[Span] = []
    counter = 0

    def _build(parent_span_id: Optional[str], current_depth: int) -> None:
        nonlocal counter
        if current_depth >= depth:
            return
        n = fan_out if parent_span_id is not None else 1
        for _ in range(n):
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
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                status_code=(SpanStatusCode.ERROR if is_leaf else SpanStatusCode.OK),
                session_id=session_id,
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
    session_mode: SessionMode = SessionMode.SINGLE,
    token_mode: TokenMode = TokenMode.FIXED,
    seed: int = 42,
) -> list[Span]:
    """Generate a batch of spans with the specified topology.

    Uses a seeded RNG for deterministic workload generation.
    """
    rng = random.Random(seed)
    spans: list[Span] = []
    trace_num = 0

    # Session ID generation based on mode
    def _session_for_trace() -> Optional[str]:
        if session_mode == SessionMode.SINGLE:
            return "sess-0"
        elif session_mode == SessionMode.PER_TRACE:
            return f"sess-{trace_num}"
        return None

    # Token counts based on mode
    def _tokens() -> tuple[int, int]:
        if token_mode == TokenMode.NONE:
            return 0, 0
        elif token_mode == TokenMode.FIXED:
            return 1, 1
        else:  # VARIABLE
            return rng.randint(0, 10), rng.randint(0, 10)

    def _make_trace(prefix: str, linear: bool) -> list[Span]:
        hex8 = rng.randbytes(4).hex()
        sid = _session_for_trace()
        pt, ct = _tokens()
        tid = f"trace-{prefix}-{trace_num}-{hex8}"
        if linear:
            return _generate_linear_trace(
                tid,
                trace_depth,
                session_id=sid,
                prompt_tokens=pt,
                completion_tokens=ct,
            )
        return _generate_branching_trace(
            tid,
            fan_out,
            trace_depth,
            session_id=sid,
            prompt_tokens=pt,
            completion_tokens=ct,
        )

    if topology == Topology.LINEAR:
        while len(spans) < total_spans:
            spans.extend(_make_trace("lin", linear=True))
            trace_num += 1

    elif topology == Topology.BRANCHING:
        while len(spans) < total_spans:
            spans.extend(_make_trace("br", linear=False))
            trace_num += 1

    elif topology == Topology.MIXED:
        while len(spans) < total_spans:
            linear = trace_num % 2 == 0
            prefix = "mix-lin" if linear else "mix-br"
            spans.extend(_make_trace(prefix, linear=linear))
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
# Runner implementations
# ---------------------------------------------------------------------------


def _make_db_session_factory(
    engine: AsyncEngine,
) -> DbSessionFactory:
    """Create a DbSessionFactory from an AsyncEngine."""
    import contextlib

    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    Session = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory(
        lock: Optional[asyncio.Lock] = None,
    ) -> AsyncIterator[AsyncSession]:
        async with contextlib.AsyncExitStack() as stack:
            if lock:
                await stack.enter_async_context(lock)
            yield await stack.enter_async_context(Session.begin())

    return DbSessionFactory(db=factory, dialect=engine.dialect.name)


class DirectWriteRunner:
    """Runner that calls SpanBatchWriter.write() directly."""

    def __init__(self, *, verify_correctness: bool = False) -> None:
        self._verify = verify_correctness

    @property
    def name(self) -> str:
        return "direct_write"

    async def run_sample(
        self,
        engine_factory: EngineFactory,
        workload: WorkloadSpec,
    ) -> SampleResult:
        from unittest.mock import MagicMock

        from phoenix.db.bulk_inserter import SpanBatchWriter

        engine = await engine_factory()
        try:
            db = _make_db_session_factory(engine)
            cost_calc = MagicMock()
            cost_calc.calculate_cost.return_value = None
            writer = SpanBatchWriter(db=db, span_cost_calculator=cost_calc)

            spans = generate_spans(
                workload.topology,
                workload.batch_size,
                fan_out=workload.fan_out,
                trace_depth=workload.trace_depth,
            )
            batch = [(span, "bench") for span in spans]

            counter = QueryCounter(engine)
            counter.start()
            start = time.perf_counter()

            await writer.write(batch)

            elapsed = time.perf_counter() - start
            query_count = counter.stop()

            if self._verify:
                errors = await verify_sample(engine, workload, spans)
                if errors:
                    raise AssertionError(
                        f"Verification failed for {self.name}:\n"
                        + "\n".join(f"  - {e}" for e in errors)
                    )

            return SampleResult(
                latency_sec=elapsed,
                query_count=query_count,
            )
        finally:
            await _dispose_engine(engine)


class _NoOpEventQueue:
    """Minimal CanPutItem[DmlEvent] for benchmarking."""

    def put(self, item: object) -> None:
        pass


class _BenchmarkBulkInserter:
    """BulkInserter wrapper with a longer drain timeout for benchmarking.

    The production BulkInserter.__aexit__ has a 5s drain timeout, but large
    batches (e.g., branching topology at batch_size=1000) can take >5s to write.
    This wrapper overrides __aexit__ to wait up to 60s for the drain to complete.
    """

    def __init__(self, inserter: Any) -> None:
        self._inserter = inserter

    async def __aenter__(self) -> Any:
        return await self._inserter.__aenter__()

    async def __aexit__(self, *args: Any) -> None:
        self._inserter._running = False
        self._inserter._wake_event.set()
        if self._inserter._task:
            try:
                await asyncio.wait_for(self._inserter._task, timeout=60.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                self._inserter._task.cancel()
            self._inserter._task = None


class BulkInserterRunner:
    """Runner that exercises the real BulkInserter async pipeline."""

    def __init__(self, *, verify_correctness: bool = False) -> None:
        self._verify = verify_correctness

    @property
    def name(self) -> str:
        return "bulk_inserter"

    async def run_sample(
        self,
        engine_factory: EngineFactory,
        workload: WorkloadSpec,
    ) -> SampleResult:
        from unittest.mock import MagicMock

        from phoenix.db.bulk_inserter import BulkInserter

        engine = await engine_factory()
        try:
            db = _make_db_session_factory(engine)
            cost_calc = MagicMock()
            cost_calc.calculate_cost.return_value = None

            spans = generate_spans(
                workload.topology,
                workload.batch_size,
                fan_out=workload.fan_out,
                trace_depth=workload.trace_depth,
            )

            raw_inserter = BulkInserter(
                db=db,
                event_queue=_NoOpEventQueue(),
                span_cost_calculator=cost_calc,
                sleep=0.01,
                max_ops_per_transaction=10_000,
            )
            inserter = _BenchmarkBulkInserter(raw_inserter)

            counter = QueryCounter(engine)
            counter.start()
            start = time.perf_counter()

            async with inserter as (_, enqueue_span, __, ___):
                for span in spans:
                    await enqueue_span(span, "bench")

            elapsed = time.perf_counter() - start
            query_count = counter.stop()

            if self._verify:
                errors = await verify_sample(engine, workload, spans)
                if errors:
                    raise AssertionError(
                        f"Verification failed for {self.name}:\n"
                        + "\n".join(f"  - {e}" for e in errors)
                    )

            return SampleResult(
                latency_sec=elapsed,
                query_count=query_count,
            )
        finally:
            await _dispose_engine(engine)


# ---------------------------------------------------------------------------
# Correctness verification
# ---------------------------------------------------------------------------


async def verify_sample(
    engine: AsyncEngine,
    workload: WorkloadSpec,
    spans: list[Span],
) -> list[str]:
    """Verify DB state after insertion. Returns list of error messages (empty = pass)."""
    from sqlalchemy import func, select
    from sqlalchemy.ext.asyncio import async_sessionmaker

    Session = async_sessionmaker(engine, expire_on_commit=False)
    errors: list[str] = []

    async with Session() as session:
        # (a) Span count matches
        db_count = await session.scalar(select(func.count()).select_from(models.Span))
        if db_count != len(spans):
            errors.append(f"Span count mismatch: expected {len(spans)}, got {db_count}")

        # (b) Each trace's time range encompasses its spans
        trace_rows = (
            await session.execute(
                select(
                    models.Trace.trace_id,
                    models.Trace.start_time,
                    models.Trace.end_time,
                )
            )
        ).all()
        for trace_id, t_start, t_end in trace_rows:
            span_rows = (
                await session.execute(
                    select(
                        models.Span.start_time,
                        models.Span.end_time,
                    )
                    .where(models.Span.trace_rowid == models.Trace.id)
                    .where(models.Trace.trace_id == trace_id)
                )
            ).all()
            if span_rows:
                min_start = min(r[0] for r in span_rows)
                max_end = max(r[1] for r in span_rows)
                if t_start > min_start:
                    errors.append(
                        f"Trace {trace_id}: start_time {t_start} > min span start {min_start}"
                    )
                if t_end < max_end:
                    errors.append(f"Trace {trace_id}: end_time {t_end} < max span end {max_end}")

        # (c) Cumulative values: root spans should have correct totals
        root_spans = (
            await session.execute(
                select(
                    models.Span.span_id,
                    models.Span.cumulative_error_count,
                    models.Span.cumulative_llm_token_count_prompt,
                    models.Span.cumulative_llm_token_count_completion,
                ).where(models.Span.parent_id.is_(None))
            )
        ).all()

        # Build expected cumulative from input spans
        spans_by_trace: dict[str, list[Span]] = {}
        for s in spans:
            spans_by_trace.setdefault(s.context.trace_id, []).append(s)

        for span_id, cum_err, cum_prompt, cum_comp in root_spans:
            trace_id = span_id.rsplit("-s", 1)[0]
            trace_spans = spans_by_trace.get(trace_id, [])
            expected_errors = sum(1 for s in trace_spans if s.status_code == SpanStatusCode.ERROR)
            if cum_err != expected_errors:
                errors.append(
                    f"Root {span_id}: cumulative_error_count "
                    f"{cum_err} != expected {expected_errors}"
                )

    return errors


# ---------------------------------------------------------------------------
# Runner registry
# ---------------------------------------------------------------------------

_RunnerFactory = Callable[..., Runner]

_RUNNER_REGISTRY: dict[str, _RunnerFactory] = {
    "direct_write": DirectWriteRunner,
    "bulk_inserter": BulkInserterRunner,
}

WARMUP_BATCHES = 3
MEASUREMENT_BATCHES = 20


def resolve_runners(
    names: list[str],
    *,
    verify_correctness: bool = False,
) -> list[Runner]:
    """Resolve runner names to Runner instances."""
    runners: list[Runner] = []
    for name in names:
        cls = _RUNNER_REGISTRY.get(name)
        if cls is None:
            valid = ", ".join(sorted(_RUNNER_REGISTRY))
            raise ValueError(f"Unknown runner {name!r}. Valid: {valid}")
        runners.append(cls(verify_correctness=verify_correctness))
    return runners


async def run_benchmark(
    runners: list[Runner],
    workloads: list[WorkloadSpec],
    measurement_samples: int = MEASUREMENT_BATCHES,
    warmup_samples: int = WARMUP_BATCHES,
    db_url: Optional[str] = None,
) -> list[BenchmarkSuiteResult]:
    """Run the full benchmark across all runner/workload combinations.

    For each (runner, workload):
    1. Warm-up: run warmup_samples (discarded)
    2. Measurement: run measurement_samples (collected)

    Each sample gets a fresh database via the runner's engine_factory.
    """

    async def engine_factory() -> AsyncEngine:
        return await _create_engine(db_url)

    results: list[BenchmarkSuiteResult] = []

    for runner in runners:
        for workload in workloads:
            label = f"  [{runner.name}] {workload.topology.value} batch={workload.batch_size}"
            print(f"{label} ...", end=" ", flush=True)

            samples: list[SampleResult] = []

            for phase, n in [
                ("warmup", warmup_samples),
                ("measure", measurement_samples),
            ]:
                for _ in range(n):
                    sample = await runner.run_sample(engine_factory, workload)
                    if phase == "measure":
                        samples.append(sample)

            suite = BenchmarkSuiteResult(
                runner_name=runner.name,
                workload=workload,
                samples=samples,
            )
            stats = suite.compute_stats()
            print(f"p50={stats.p50_latency:.4f}s  spans/s={stats.mean_spans_per_sec:.0f}")
            results.append(suite)

    return results


async def async_main(
    runners: list[Runner],
    workloads: list[WorkloadSpec],
    measurement_samples: int = MEASUREMENT_BATCHES,
    output_dir: Optional[Path] = None,
    db_url: Optional[str] = None,
) -> list[BenchmarkSuiteResult]:
    """Main async entry point for the benchmark."""
    db_label = "PostgreSQL" if db_url and db_url.startswith("postgresql") else "SQLite (in-memory)"
    runner_names = ", ".join(r.name for r in runners)
    print(f"Starting span insertion benchmark on {db_label}...")
    print(f"  Runners: {runner_names}")
    print(f"  Warmup: {WARMUP_BATCHES} samples, Measurement: {measurement_samples} samples")
    print()

    results = await run_benchmark(
        runners=runners,
        workloads=workloads,
        measurement_samples=measurement_samples,
        db_url=db_url,
    )

    print()
    print_results(results, db_url=db_url)

    if output_dir is not None:
        seed = workloads[0].seed if workloads else None
        json_path, md_path = write_outputs(results, output_dir, db_url=db_url, seed=seed)
        print(f"\nResults written to:\n  {json_path}\n  {md_path}")

    return results


def _parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark span insertion performance.",
    )
    parser.add_argument(
        "--batch-sizes",
        type=str,
        default="100,500,1000",
        help="Comma-separated batch sizes (default: 100,500,1000)",
    )
    parser.add_argument(
        "--runners",
        type=str,
        default="direct_write",
        help="Comma-separated runner names (default: direct_write)",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=MEASUREMENT_BATCHES,
        help=(
            "Number of measurement samples per runner per workload"
            f" (default: {MEASUREMENT_BATCHES})"
        ),
    )
    parser.add_argument(
        "--topologies",
        type=str,
        default="linear,branching,mixed",
        help="Comma-separated topologies (default: linear,branching,mixed)",
    )
    parser.add_argument(
        "--session-modes",
        type=str,
        default="single",
        help=(
            "Comma-separated session modes: "
            f"{','.join(m.value for m in SessionMode)} (default: single)"
        ),
    )
    parser.add_argument(
        "--project-modes",
        type=str,
        default="single",
        help=(
            "Comma-separated project modes: "
            f"{','.join(m.value for m in ProjectMode)} (default: single)"
        ),
    )
    parser.add_argument(
        "--token-modes",
        type=str,
        default="fixed",
        help=(
            f"Comma-separated token modes: {','.join(m.value for m in TokenMode)} (default: fixed)"
        ),
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="RNG seed for deterministic workload generation (default: 42)",
    )
    parser.add_argument(
        "--verify-correctness",
        action="store_true",
        default=False,
        help="Run correctness checks after each sample (slower)",
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

    runner_names = [x.strip() for x in args.runners.split(",")]
    runners = resolve_runners(runner_names, verify_correctness=args.verify_correctness)

    batch_sizes = [int(x.strip()) for x in args.batch_sizes.split(",")]
    topologies = [Topology(x.strip()) for x in args.topologies.split(",")]
    session_modes = [SessionMode(x.strip()) for x in args.session_modes.split(",")]
    project_modes = [ProjectMode(x.strip()) for x in args.project_modes.split(",")]
    token_modes = [TokenMode(x.strip()) for x in args.token_modes.split(",")]

    workloads = [
        WorkloadSpec(
            batch_size=bs,
            topology=topo,
            session_mode=sm,
            project_mode=pm,
            token_mode=tm,
            seed=args.seed,
        )
        for bs in batch_sizes
        for topo in topologies
        for sm in session_modes
        for pm in project_modes
        for tm in token_modes
    ]

    output_dir = Path(args.output) if args.output else None

    asyncio.run(
        async_main(
            runners=runners,
            workloads=workloads,
            measurement_samples=args.runs,
            output_dir=output_dir,
            db_url=args.db_url,
        )
    )


if __name__ == "__main__":
    main()
