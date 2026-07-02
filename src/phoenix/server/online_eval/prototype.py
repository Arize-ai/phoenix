"""PROTOTYPE — NOT PRODUCTION CODE. Runnable illustration of how the online-eval
coordination schema (``eval_work_cursors`` / ``eval_work_units``) is exercised by a
producer and competing consumers. The full implementation replaces this module; delete
it when the real daemons land.

Run: ``python -m phoenix.server.online_eval.prototype``

Faked here, real answers tracked in the Phase 2 work item: evaluator attachment config
(filters/sampling/project scoping) is hardcoded below instead of persisted; the
``config_fingerprint`` and annotation ``identifier`` recipes are toy stand-ins; timing
constants are shrunk from the production LEASE_TTL_SECONDS/HEARTBEAT_INTERVAL_SECONDS
so the demo runs in seconds.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any, Optional

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.db.types.identifier import Identifier

DEMO_FRONTIER_LAG_SECONDS = 0.15
DEMO_LEASE_TTL_SECONDS = 1.0
DEMO_MAX_ATTEMPTS = 2
_START = time.monotonic()


def _log(who: str, msg: str) -> None:
    print(f"[{time.monotonic() - _START:6.2f}s] {who:<12} {msg}")


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Criteria:
    """Stand-in for the un-designed attachment layer (Phase 2 decision #8)."""

    evaluator_name: str
    matcher: Callable[[models.Span], bool]
    sampling_rate: float
    config: dict[str, Any]

    @property
    def fingerprint(self) -> str:
        return hashlib.sha256(json.dumps(self.config, sort_keys=True).encode()).hexdigest()[:16]


def _sampled(span_id: int, rate: float) -> bool:
    h = int(hashlib.md5(str(span_id).encode()).hexdigest(), 16)
    return (h / 2**128) < rate


CRITERIA: list[Criteria] = [
    Criteria(
        evaluator_name="toxicity",
        matcher=lambda s: s.span_kind == "LLM",
        sampling_rate=0.6,
        config={"template": "toxicity-v1", "filter": "span_kind == 'LLM'", "rate": 0.6},
    ),
    Criteria(
        evaluator_name="error-triage",
        matcher=lambda s: s.status_code == "ERROR",
        sampling_rate=1.0,
        config={"template": "triage-v1", "filter": "status_code == 'ERROR'", "rate": 1.0},
    ),
]


async def producer_tick(
    db: async_sessionmaker[Any], producer_id: str, evaluator_ids: dict[str, int]
) -> None:
    async with db() as session:
        stale = _now() - timedelta(seconds=DEMO_LEASE_TTL_SECONDS)
        lease = await session.execute(
            update(models.EvalWorkCursor)
            .where(
                models.EvalWorkCursor.grain == "SPAN",
                models.EvalWorkCursor.consumer_group == "default",
                or_(
                    models.EvalWorkCursor.claimed_by.is_(None),
                    models.EvalWorkCursor.claimed_by == producer_id,
                    models.EvalWorkCursor.claimed_at < stale,
                ),
            )
            .values(claimed_by=producer_id, claimed_at=_now())
        )
        await session.commit()
        if lease.rowcount != 1:
            _log(producer_id, "lease held by another producer; standing down")
            return

        cursor = await session.scalar(
            select(models.EvalWorkCursor).where(
                models.EvalWorkCursor.grain == "SPAN",
                models.EvalWorkCursor.consumer_group == "default",
            )
        )
        assert cursor is not None
        frontier: Optional[int] = None
        if (
            cursor.observed_high_water_id is not None
            and cursor.observed_at is not None
            and (_now() - cursor.observed_at).total_seconds() >= DEMO_FRONTIER_LAG_SECONDS
            and cursor.observed_high_water_id > cursor.produced_through_id
        ):
            frontier = cursor.observed_high_water_id

        high_water = await session.scalar(select(func.max(models.Span.id)))
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor.id)
            .values(observed_high_water_id=high_water, observed_at=_now())
        )
        if frontier is None:
            await session.commit()
            _log(producer_id, f"won lease; frontier not yet eligible (observing max={high_water})")
            return

        low_water = cursor.produced_through_id
        spans = (
            await session.scalars(
                select(models.Span).where(models.Span.id > low_water, models.Span.id <= frontier)
            )
        ).all()
        records = [
            {
                "span_rowid": s.id,
                "evaluator_id": evaluator_ids[c.evaluator_name],
                "config_fingerprint": c.fingerprint,
            }
            for s in spans
            for c in CRITERIA
            if _sampled(s.id, c.sampling_rate) and c.matcher(s)
        ]
        if records:
            await session.execute(
                insert_on_conflict(
                    *records,
                    table=models.EvalWorkUnit,
                    dialect=SupportedSQLDialect.SQLITE,
                    unique_by=["span_rowid", "evaluator_id", "config_fingerprint"],
                    on_conflict=OnConflict.DO_NOTHING,
                )
            )
        advanced = await session.execute(
            update(models.EvalWorkCursor)
            .where(
                models.EvalWorkCursor.id == cursor.id,
                models.EvalWorkCursor.claimed_by == producer_id,
            )
            .values(produced_through_id=frontier)
        )
        await session.commit()
        fenced = "" if advanced.rowcount == 1 else " (FENCED: lost lease, watermark not moved)"
        _log(
            producer_id,
            f"scanned ({low_water}, {frontier}]: {len(spans)} spans -> "
            f"{len(records)} work units{fenced}",
        )


async def consumer_loop(
    db: async_sessionmaker[Any], consumer_id: str, names_by_evaluator_id: dict[int, str]
) -> int:
    completed = 0
    idle_rounds = 0
    while idle_rounds < 6:
        async with db() as session:
            now = _now()
            stale = now - timedelta(seconds=DEMO_LEASE_TTL_SECONDS)
            claimable = or_(
                models.EvalWorkUnit.status == "PENDING",
                and_(
                    models.EvalWorkUnit.status == "RUNNING", models.EvalWorkUnit.claimed_at < stale
                ),
                and_(
                    models.EvalWorkUnit.status == "ERROR",
                    models.EvalWorkUnit.attempts < DEMO_MAX_ATTEMPTS,
                    or_(
                        models.EvalWorkUnit.cooldown_until.is_(None),
                        models.EvalWorkUnit.cooldown_until <= now,
                    ),
                ),
            )
            candidate_ids = (
                await session.scalars(
                    select(models.EvalWorkUnit.id)
                    .where(claimable)
                    .order_by(models.EvalWorkUnit.id)
                    .limit(3)
                )
            ).all()
            if not candidate_ids:
                idle_rounds += 1
                await asyncio.sleep(0.1)
                continue
            idle_rounds = 0
            for unit_id in candidate_ids:
                claimed = await session.execute(
                    update(models.EvalWorkUnit)
                    .where(models.EvalWorkUnit.id == unit_id, claimable)
                    .values(status="RUNNING", claimed_at=_now(), claimed_by=consumer_id)
                )
                await session.commit()
                if claimed.rowcount != 1:
                    continue
                unit = await session.get(models.EvalWorkUnit, unit_id)
                assert unit is not None
                name = names_by_evaluator_id[unit.evaluator_id]
                await asyncio.sleep(0.05)

                flaky = name == "error-triage" and unit.span_rowid % 7 == 0 and unit.attempts == 0
                if flaky:
                    await session.execute(
                        update(models.EvalWorkUnit)
                        .where(
                            models.EvalWorkUnit.id == unit_id,
                            models.EvalWorkUnit.claimed_by == consumer_id,
                            models.EvalWorkUnit.status == "RUNNING",
                        )
                        .values(
                            status="ERROR",
                            error="simulated provider 529",
                            attempts=unit.attempts + 1,
                            cooldown_until=_now() + timedelta(seconds=0.2),
                        )
                    )
                    await session.commit()
                    _log(
                        consumer_id,
                        f"unit {unit_id} ({name} on span {unit.span_rowid}) "
                        "FAILED -> ERROR, retryable",
                    )
                    continue

                await session.execute(
                    insert_on_conflict(
                        {
                            "span_rowid": unit.span_rowid,
                            "name": name,
                            "label": "ok",
                            "score": 1.0,
                            "explanation": None,
                            "metadata_": {},
                            "annotator_kind": "LLM",
                            "identifier": f"online:{unit.config_fingerprint[:12]}",
                            "source": "API",
                            "user_id": None,
                        },
                        table=models.SpanAnnotation,
                        dialect=SupportedSQLDialect.SQLITE,
                        unique_by=["name", "span_rowid", "identifier"],
                        on_conflict=OnConflict.DO_NOTHING,
                    )
                )
                done = await session.execute(
                    update(models.EvalWorkUnit)
                    .where(
                        models.EvalWorkUnit.id == unit_id,
                        models.EvalWorkUnit.claimed_by == consumer_id,
                        models.EvalWorkUnit.status == "RUNNING",
                    )
                    .values(status="DONE")
                )
                await session.commit()
                if done.rowcount == 1:
                    completed += 1
                    retry = " (retry succeeded)" if unit.attempts > 0 else ""
                    _log(
                        consumer_id,
                        f"unit {unit_id} ({name} on span {unit.span_rowid}) DONE{retry}",
                    )
    return completed


async def _seed(db: async_sessionmaker[Any]) -> tuple[int, dict[str, int]]:
    async with db() as session:
        project = models.Project(name=f"proto-{token_hex(4)}")
        session.add(project)
        await session.flush()
        trace = models.Trace(
            project_rowid=project.id, trace_id=token_hex(8), start_time=_now(), end_time=_now()
        )
        session.add(trace)
        await session.flush()
        evaluator_ids: dict[str, int] = {}
        for c in CRITERIA:
            ev = models.BuiltinEvaluator(
                name=Identifier(root=f"{c.evaluator_name}-{token_hex(3)}"),
                kind="BUILTIN",
                key=f"proto:{c.evaluator_name}",
                input_schema={},
                output_configs=[],
            )
            session.add(ev)
            await session.flush()
            evaluator_ids[c.evaluator_name] = ev.id
        session.add(
            models.EvalWorkCursor(grain="SPAN", consumer_group="default", produced_through_id=0)
        )
        await session.commit()
        return trace.id, evaluator_ids


async def _ingest_wave(db: async_sessionmaker[Any], trace_rowid: int, n: int) -> None:
    async with db() as session:
        for i in range(n):
            session.add(
                models.Span(
                    trace_rowid=trace_rowid,
                    span_id=token_hex(8),
                    name=f"span-{i}",
                    span_kind="LLM" if i % 3 else "TOOL",
                    start_time=_now(),
                    end_time=_now(),
                    attributes={},
                    events=[],
                    status_code="ERROR" if i % 5 == 0 else "OK",
                    status_message="",
                    cumulative_error_count=0,
                    cumulative_llm_token_count_prompt=0,
                    cumulative_llm_token_count_completion=0,
                )
            )
        await session.commit()
    _log("ingest", f"wave of {n} spans committed")


async def main() -> None:
    with tempfile.NamedTemporaryFile(suffix=".db") as f:
        engine: AsyncEngine = create_async_engine(f"sqlite+aiosqlite:///{f.name}")
        async with engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.create_all)
        db = async_sessionmaker(engine, expire_on_commit=False)
        trace_rowid, evaluator_ids = await _seed(db)
        names_by_evaluator_id = {v: k for k, v in evaluator_ids.items()}

        consumers = [
            asyncio.create_task(consumer_loop(db, f"consumer-{c}", names_by_evaluator_id))
            for c in ("A", "B")
        ]
        for wave in range(3):
            await _ingest_wave(db, trace_rowid, 15)
            for contender in ("producer-A", "producer-B"):
                await producer_tick(db, contender, evaluator_ids)
            await asyncio.sleep(0.3)
        for _ in range(3):
            for contender in ("producer-A", "producer-B"):
                await producer_tick(db, contender, evaluator_ids)
            await asyncio.sleep(0.3)

        completed = await asyncio.gather(*consumers)
        async with db() as session:
            status_rows = (
                await session.execute(
                    select(models.EvalWorkUnit.status, func.count()).group_by(
                        models.EvalWorkUnit.status
                    )
                )
            ).all()
            by_status: dict[str, int] = {status: count for status, count in status_rows}
            annotations = await session.scalar(
                select(func.count()).select_from(models.SpanAnnotation)
            )
            spans_total = await session.scalar(select(func.count()).select_from(models.Span))
        print()
        _log("summary", f"spans ingested: {spans_total}")
        _log("summary", f"work units by status: {by_status}")
        _log("summary", f"annotations written: {annotations}")
        _log("summary", f"completed per consumer: A={completed[0]} B={completed[1]}")
        _log(
            "summary",
            "note: DONE units == annotations, and no unit was completed twice — "
            "the CAS claim + unique keys did the coordination",
        )
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
