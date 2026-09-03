"""A/B the ingest cost of the trace-liveness stamp, measured through the shipped insert path.

Online trace evals need to know when a trace last received a span, so
``bulk_inserter._insert_spans`` stamps ``traces.last_span_ingested_at`` once per batch via
``advance_trace_liveness``. The stamped column is covered by the partial index
``ix_traces_project_rowid_last_span_ingested_at``, so on PostgreSQL the UPDATE cannot be
heap-only: every stamp writes a new tuple *and* an index entry. This harness measures what
that costs the batch it rides in.

Both arms drive the real ``BulkInserter._insert_spans`` over the same generated batch. The
only difference is that the B arm replaces the module-level ``advance_trace_liveness`` with a
no-op, so the shipped savepoint the session stamp already opens stays in the baseline and the
delta is the UPDATE alone. ``_insert_spans`` is called directly rather than through the
inserter's run loop: the loop's ``_has_work()`` goes False before a batch finishes writing, so
polling it would close the timing window in the middle of the transaction being measured.

The report is a matrix over two axes:

- **spans per trace** — how many trace rows a 1000-span batch stamps. At 1 span per trace the
  batch stamps 1000 rows, which is the worst case an app of single-LLM-call traces actually
  produces; 5 is a typical tool-using request; 20 is a deep agent trace. Batch size is held at
  the production ``max_ops_per_transaction`` default of 1000.
- **trace state** — whether the batch's traces are new (the stamp goes NULL to a value, so the
  partial index gains an entry) or continuing (the traces were stamped by an earlier batch, so
  the stamp rewrites a tuple and leaves a dead index entry behind). Continuing traces are the
  streaming case, where a trace's spans arrive spread over several batches.

Spans carry no session id, so ``advance_project_session_liveness`` is a no-op and the baseline
is span ingest without any liveness write. That is the conservative denominator: ingesting
session-bearing spans costs more, which would make the same absolute delta a smaller share.

Each cell runs the two arms back to back within a repetition and flips their order every
other repetition, so the table growth both arms see cancels to first order. The batch figures
are medians of the paired differences, reported with their full range: run-to-run variance in
span ingest is larger than the effect, so a single sample says nothing. Alongside them the
harness reports the wall time the driver spent inside the stamp statement itself, which is far
less noisy but sees only the statement, not what its extra WAL and index churn cost at COMMIT
or later at vacuum.

Usage::

    uv run python scripts/perf/online_eval_trace_liveness_ab.py --dialect sqlite
    uv run python scripts/perf/online_eval_trace_liveness_ab.py --dialect postgresql \
        --postgres-url postgresql+asyncpg://user@localhost:5432/perf

SQLite seeds a temp file DB. PostgreSQL needs an empty target database; pointing
``--postgres-url`` at one that already has tables requires ``--drop-existing``.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import random
import statistics
import time
from collections.abc import AsyncIterator, Iterable, Iterator, Sequence
from datetime import datetime, timedelta, timezone
from queue import SimpleQueue
from tempfile import NamedTemporaryFile
from typing import Any, NamedTuple, Optional
from unittest.mock import patch

import sqlalchemy
from sqlalchemy import event, make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from phoenix.db import bulk_inserter as bulk_inserter_module
from phoenix.db import models
from phoenix.db.bulk_inserter import BulkInserter
from phoenix.db.engines import aio_postgresql_engine, aio_sqlite_engine
from phoenix.server.daemons.generative_model_store import GenerativeModelStore
from phoenix.server.daemons.span_cost_calculator import SpanCostCalculator
from phoenix.server.dml_event import DmlEvent
from phoenix.server.types import DbSessionFactory
from phoenix.trace.schemas import Span, SpanContext, SpanKind, SpanStatusCode

_EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)
_PROJECT_NAME = "trace-liveness-ab"
_STAMP_STATEMENT = "update traces set last_span_ingested_at"


class Cell(NamedTuple):
    spans_per_trace: int
    trace_state: str


class Sample(NamedTuple):
    """One repetition's paired arms, run back to back so drift affects both alike."""

    without_ms: float
    with_ms: float
    stamp_stmt_ms: float
    stamped_rows: int


class Result(NamedTuple):
    cell: Cell
    traces_per_batch: int
    samples: list[Sample]

    @property
    def stamped_rows(self) -> int:
        """Trace rows the stamp actually touched per batch, which should equal the intent."""
        observed = {sample.stamped_rows for sample in self.samples}
        if observed != {self.traces_per_batch}:
            raise RuntimeError(
                f"{self.cell} stamped {sorted(observed)} trace rows per batch, "
                f"expected {self.traces_per_batch}"
            )
        return self.traces_per_batch


# --- workload --------------------------------------------------------------------------------


class SpanFactory:
    """Generates batches of spans with ids no earlier batch has used.

    ``insert_span`` returns ``None`` on a span id it has already seen, and a skipped span
    contributes no trace rowid to stamp, so every measured batch has to be new work.
    """

    def __init__(self) -> None:
        self._next_trace = 0
        self._next_span = 0

    def new_traces(self, count: int) -> list[str]:
        trace_ids = [f"{self._next_trace + offset:032x}" for offset in range(count)]
        self._next_trace += count
        return trace_ids

    def roots(self, trace_ids: Iterable[str]) -> list[tuple[Span, str]]:
        return [
            (self._span(trace_id, _root_span_id(trace_id), None), _PROJECT_NAME)
            for trace_id in trace_ids
        ]

    def children(self, trace_ids: Iterable[str], per_trace: int) -> list[tuple[Span, str]]:
        batch: list[tuple[Span, str]] = []
        for trace_id in trace_ids:
            for _ in range(per_trace):
                self._next_span += 1
                span_id = f"b{self._next_span:015x}"
                batch.append(
                    (self._span(trace_id, span_id, _root_span_id(trace_id)), _PROJECT_NAME)
                )
        return batch

    def _span(self, trace_id: str, span_id: str, parent_id: Optional[str]) -> Span:
        return Span(
            name="perf-span",
            context=SpanContext(trace_id=trace_id, span_id=span_id),
            span_kind=SpanKind.CHAIN,
            parent_id=parent_id,
            start_time=_EPOCH,
            end_time=_EPOCH + timedelta(seconds=1),
            status_code=SpanStatusCode.OK,
            status_message="",
            attributes={},
            events=[],
            conversation=None,
        )


def _root_span_id(trace_id: str) -> str:
    """The root span id a trace's later batches parent their spans to.

    Root and child span ids are drawn from disjoint prefixes, and both from the low end of the
    zero-padded counter rather than its high end. Either kind of collision would be deduped by
    `insert_span`, which then contributes no trace rowid, and the batch would silently stamp
    fewer trace rows than the workload claims.
    """
    return f"a{trace_id[17:]}"


def build_batch(
    factory: SpanFactory, cell: Cell, batch_size: int, rng: random.Random
) -> tuple[list[tuple[Span, str]], list[tuple[Span, str]]]:
    """Return the untimed setup batch and the batch to measure."""
    traces_per_batch = batch_size // cell.spans_per_trace
    trace_ids = factory.new_traces(traces_per_batch)
    if cell.trace_state == "new":
        measured = factory.roots(trace_ids) + factory.children(trace_ids, cell.spans_per_trace - 1)
        setup: list[tuple[Span, str]] = []
    else:
        setup = factory.roots(trace_ids)
        measured = factory.children(trace_ids, cell.spans_per_trace)
    rng.shuffle(measured)
    return setup, measured


# --- measurement -----------------------------------------------------------------------------


class StampTimer:
    """Wall time and row count of the trace-liveness UPDATE, from the driver's cursor events.

    The row count is what tells a reader the batch stamped the workload the table claims: a
    generated batch whose span ids collide gets deduped by `insert_span`, contributes no trace
    rowid, and would otherwise silently measure an empty stamp.
    """

    def __init__(self, engine: AsyncEngine) -> None:
        self.total = 0.0
        self.rows = 0
        self._entered: Optional[float] = None
        event.listen(engine.sync_engine, "before_cursor_execute", self._before)
        event.listen(engine.sync_engine, "after_cursor_execute", self._after)

    def reset(self) -> None:
        self.total = 0.0
        self.rows = 0
        self._entered = None

    def _before(
        self,
        _conn: Any,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        if _STAMP_STATEMENT in statement.lower():
            self._entered = time.perf_counter()

    def _after(
        self,
        _conn: Any,
        cursor: Any,
        _statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        if self._entered is not None:
            self.total += time.perf_counter() - self._entered
            self.rows += max(0, cursor.rowcount)
            self._entered = None


@contextlib.contextmanager
def trace_stamp(enabled: bool) -> Iterator[None]:
    """Toggle the stamp from outside ingest, leaving its enclosing savepoint in both arms."""
    if enabled:
        yield
        return

    async def _skip(session: AsyncSession, trace_rowids: Iterable[int]) -> None:
        return None

    with patch.object(bulk_inserter_module, "advance_trace_liveness", _skip):
        yield


async def insert_batch(
    inserter: BulkInserter, batch: Sequence[tuple[Span, str]], *, stamp: bool
) -> float:
    inserter._spans.extend(batch)
    with trace_stamp(stamp):
        start = time.perf_counter()
        await inserter._insert_spans(len(batch))
        return time.perf_counter() - start


async def measure_cell(
    inserter: BulkInserter,
    factory: SpanFactory,
    timer: StampTimer,
    cell: Cell,
    batch_size: int,
    runs: int,
    rng: random.Random,
) -> Result:
    samples: list[Sample] = []
    for run in range(runs):
        arm_ms: dict[bool, float] = {}
        stamp_stmt_ms = 0.0
        stamped_rows = 0
        # Flip which arm goes first every other repetition, so the table growth each arm sees
        # over the run cancels to first order.
        for stamp in (run % 2 == 0, run % 2 != 0):
            setup, measured = build_batch(factory, cell, batch_size, rng)
            if setup:
                await insert_batch(inserter, setup, stamp=True)
            timer.reset()
            arm_ms[stamp] = await insert_batch(inserter, measured, stamp=stamp) * 1000
            if stamp:
                stamp_stmt_ms = timer.total * 1000
                stamped_rows = timer.rows
        samples.append(
            Sample(
                without_ms=arm_ms[False],
                with_ms=arm_ms[True],
                stamp_stmt_ms=stamp_stmt_ms,
                stamped_rows=stamped_rows,
            )
        )
    return Result(
        cell=cell,
        traces_per_batch=batch_size // cell.spans_per_trace,
        samples=samples,
    )


# --- reporting -------------------------------------------------------------------------------


def render(results: list[Result], dialect: str, batch_size: int, runs: int) -> str:
    lines = [
        f"## {dialect} — batch size {batch_size}, {runs} paired repetitions per cell\n",
        "| spans/trace | trace state | trace rows stamped/batch | batch ms without stamp | "
        "paired delta ms | paired delta % | paired delta % range | stamp stmt ms | stamp stmt % |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for result in results:
        without = statistics.median(s.without_ms for s in result.samples)
        deltas = sorted(s.with_ms - s.without_ms for s in result.samples)
        delta = statistics.median(deltas)
        stmt = statistics.median(s.stamp_stmt_ms for s in result.samples)
        lines.append(
            f"| {result.cell.spans_per_trace} | {result.cell.trace_state} "
            f"| {result.stamped_rows} | {without:.0f} | {delta:+.1f} "
            f"| {100 * delta / without:+.2f} "
            f"| {100 * deltas[0] / without:+.2f} … {100 * deltas[-1] / without:+.2f} "
            f"| {stmt:.2f} | {100 * stmt / without:.3f} |"
        )
    worst = max(results, key=_attributed_pct)
    lines.append(
        f"\n**Worst cell:** the stamp statement is {_attributed_pct(worst):.3f}% of batch wall "
        f"time at {worst.cell.spans_per_trace} span(s)/trace on {worst.cell.trace_state} traces "
        f"({worst.traces_per_batch} trace rows stamped per {batch_size}-span batch); the paired "
        f"batch delta there is {_paired_pct(worst):+.2f}%.\n"
    )
    lines.append(
        "`stamp stmt` is the wall time the driver spent inside the "
        "`UPDATE traces SET last_span_ingested_at` statement itself. It excludes what the extra "
        "WAL and index churn cost at COMMIT and later at vacuum, which only the paired batch "
        "delta can see — and that delta is reported with its full range because run-to-run "
        "variance in span ingest is larger than the effect being measured.\n"
    )
    return "\n".join(lines)


def _paired_pct(result: Result) -> float:
    without = statistics.median(s.without_ms for s in result.samples)
    return 100 * statistics.median(s.with_ms - s.without_ms for s in result.samples) / without


def _attributed_pct(result: Result) -> float:
    without = statistics.median(s.without_ms for s in result.samples)
    return 100 * statistics.median(s.stamp_stmt_ms for s in result.samples) / without


# --- driver ----------------------------------------------------------------------------------


@contextlib.asynccontextmanager
async def build_engine(
    dialect: str, postgres_url: Optional[str], drop_existing: bool
) -> AsyncIterator[AsyncEngine]:
    if dialect == "sqlite":
        tmp = NamedTemporaryFile(suffix=".db", delete=False)
        tmp.close()
        engine = aio_sqlite_engine(make_url(f"sqlite+aiosqlite:///{tmp.name}"), migrate=False)
    else:
        if not postgres_url:
            raise SystemExit("--postgres-url is required for --dialect postgresql")
        engine = aio_postgresql_engine(make_url(postgres_url), migrate=False)
        existing = await _table_names(engine)
        # Seeding drops every table it is about to recreate, so a mistyped URL would destroy
        # whatever lives at the target. Refuse unless it is empty or the caller opted in.
        if existing and not drop_existing:
            await engine.dispose()
            raise SystemExit(
                f"{postgres_url} already has {len(existing)} tables; seeding would drop them. "
                "Point --postgres-url at an empty database, or pass --drop-existing."
            )
    try:
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.drop_all)
            await conn.run_sync(models.Base.metadata.create_all)
        yield engine
    finally:
        await engine.dispose()


async def _table_names(engine: AsyncEngine) -> list[str]:
    async with engine.connect() as conn:
        return list(await conn.run_sync(lambda sync: sqlalchemy.inspect(sync).get_table_names()))


def _session_factory(engine: AsyncEngine) -> DbSessionFactory:
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    @contextlib.asynccontextmanager
    async def factory() -> AsyncIterator[AsyncSession]:
        async with sessions.begin() as session:
            yield session

    return DbSessionFactory(db=factory, dialect=engine.dialect.name)


async def run(args: argparse.Namespace) -> str:
    cells = [
        Cell(spans_per_trace, trace_state)
        for spans_per_trace in args.spans_per_trace
        for trace_state in ("new", "continuing")
    ]
    async with build_engine(args.dialect, args.postgres_url, args.drop_existing) as engine:
        db = _session_factory(engine)
        inserter = BulkInserter(
            db,
            event_queue=SimpleQueue[DmlEvent](),
            span_cost_calculator=SpanCostCalculator(db, GenerativeModelStore(db)),
        )
        # One factory for the whole run keeps span ids unique across every cell.
        factory = SpanFactory()
        timer = StampTimer(engine)
        results = [
            await measure_cell(
                inserter, factory, timer, cell, args.batch_size, args.runs, random.Random(args.seed)
            )
            for cell in cells
        ]
    return render(results, args.dialect, args.batch_size, args.runs)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dialect", choices=["sqlite", "postgresql"], default="sqlite")
    parser.add_argument("--postgres-url", default=None)
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--spans-per-trace", type=int, nargs="+", default=[1, 5, 20])
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--seed", type=int, default=1234)
    parser.add_argument(
        "--drop-existing",
        action="store_true",
        help="Allow seeding to drop the tables already present in the target database.",
    )
    args = parser.parse_args()
    print(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
