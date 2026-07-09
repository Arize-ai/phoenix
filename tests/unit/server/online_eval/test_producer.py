from datetime import datetime, timedelta, timezone
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import func, select, update

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval import producer as producer_module
from phoenix.server.online_eval.db_coordinator import MAX_ATTEMPTS
from phoenix.server.online_eval.derivation import config_fingerprint
from phoenix.server.online_eval.producer import (
    OnlineEvalProducer,
    resolve_criteria,
)
from phoenix.server.types import DbSessionFactory

from ..._helpers import _add_project, _add_span, _add_trace


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _seed_criteria(
    db: DbSessionFactory,
    project_id: int,
    *,
    filter_condition: str = "",
    sampling_rate: float = 1.0,
) -> tuple[int, int]:
    """Create a builtin evaluator and a criteria row, returning
    (evaluator_id, criteria_id)."""
    async with db() as session:
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        criteria = models.ProjectEvaluatorCriteria(
            project_id=project_id,
            evaluator_id=evaluator.id,
            annotation_name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition=filter_condition,
            sampling_rate=sampling_rate,
        )
        session.add(criteria)
        await session.flush()
        return evaluator.id, criteria.id


async def _seed_cursor(
    db: DbSessionFactory,
    *,
    produced_through_id: int = 0,
    observed_high_water_id: int | None = None,
    observed_at: datetime | None = None,
    claimed_by: str | None = None,
    claimed_at: datetime | None = None,
) -> int:
    async with db() as session:
        cursor = models.EvalWorkCursor(
            grain="SPAN",
            consumer_group="default",
            produced_through_id=produced_through_id,
            observed_high_water_id=observed_high_water_id,
            observed_at=observed_at,
            claimed_by=claimed_by,
            claimed_at=claimed_at,
        )
        session.add(cursor)
        await session.flush()
        return cursor.id


async def _get_cursor(db: DbSessionFactory, cursor_id: int) -> models.EvalWorkCursor:
    async with db() as session:
        cursor = await session.get(models.EvalWorkCursor, cursor_id)
        assert cursor is not None
        return cursor


async def _work_unit_span_rowids(db: DbSessionFactory) -> list[int]:
    async with db() as session:
        return list(await session.scalars(select(models.EvalWorkUnit.span_rowid)))


async def test_tick_materializes_matching_spans_and_advances_watermark(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        llm_spans = [await _add_span(session, trace, span_kind="LLM") for _ in range(3)]
        tool_span = await _add_span(session, trace, span_kind="TOOL")
        other_project = await _add_project(session)
        other_trace = await _add_trace(session, other_project)
        other_span = await _add_span(session, other_trace, span_kind="LLM")
    evaluator_id, criteria_id = await _seed_criteria(
        db, project.id, filter_condition="span_kind == 'LLM'"
    )
    high_water = other_span.id
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=high_water,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    materialized = await _work_unit_span_rowids(db)
    assert sorted(materialized) == sorted(span.id for span in llm_spans)
    assert tool_span.id not in materialized
    assert other_span.id not in materialized

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
        criteria = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert criteria is not None
        evaluator = await session.get(models.BuiltinEvaluator, evaluator_id)
        assert evaluator is not None
        resolved = await resolve_criteria(session, criteria, evaluator)
        assert resolved is not None
        expected_fingerprint = config_fingerprint(resolved)
    for unit in units:
        assert unit.status == "PENDING"
        assert unit.evaluator_id == evaluator_id
        assert unit.criteria_id == criteria_id
        assert unit.config_fingerprint == expected_fingerprint

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == high_water
    assert cursor.claimed_by == producer._producer_id

    # Re-scanning the same window is idempotent under the work-key unique constraint.
    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(
                produced_through_id=0,
                observed_high_water_id=high_water,
                observed_at=_now() - timedelta(seconds=120),
            )
        )
    await producer._tick()
    assert len(await _work_unit_span_rowids(db)) == len(llm_spans)


async def test_frontier_gate_holds_until_lag_elapses(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    observed_at = _now()
    cursor_id = await _seed_cursor(db, observed_high_water_id=span.id, observed_at=observed_at)

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == 0
    # The pending observation is held so it can age past the lag gate — a tick
    # must not reset observed_at while the observation is unconsumed.
    assert cursor.observed_high_water_id == span.id
    assert cursor.observed_at == observed_at


async def test_backstop_catches_late_visible_span(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        late_span = await _add_span(session, trace)
        annotated_span = await _add_span(session, trace)
        expired_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    watermark = expired_span.id
    await _seed_cursor(db, produced_through_id=watermark)

    producer = OnlineEvalProducer(db)
    active = await producer._load_active_criteria()
    assert len(active) == 1
    criteria = active[0]

    async with db() as session:
        session.add(
            models.SpanAnnotation(
                span_rowid=annotated_span.id,
                name=criteria.annotation_name,
                label="ok",
                score=1.0,
                explanation=None,
                metadata_={},
                annotator_kind="LLM",
                identifier=criteria.identifier,
                source="API",
                user_id=None,
            )
        )
        session.add(
            models.EvalWorkUnit(
                span_rowid=expired_span.id,
                evaluator_id=evaluator_id,
                criteria_id=criteria_id,
                config_fingerprint=criteria.fingerprint,
                status="EXPIRED",
            )
        )

    await producer._backstop_sweep(active, watermark)

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    by_span = {unit.span_rowid: unit for unit in units}
    assert len(units) == 2
    assert by_span[late_span.id].status == "PENDING"
    assert annotated_span.id not in by_span
    assert by_span[expired_span.id].status == "EXPIRED"


async def test_reaper_transitions_and_deletes(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        spans = [await _add_span(session, trace) for _ in range(5)]
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    produced_through = spans[-1].id
    outside, inside = spans[0].id, spans[-1].id
    now = _now()
    ancient = now - timedelta(days=30)

    def _unit(span_rowid: int, **kwargs: object) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            **kwargs,
        )

    async with db() as session:
        stale_pending = _unit(inside, status="PENDING", created_at=ancient)
        fresh_pending = _unit(inside, status="PENDING")
        done_outside = _unit(outside, status="DONE", created_at=ancient, updated_at=ancient)
        done_inside = _unit(inside, status="DONE", created_at=ancient, updated_at=ancient)
        exhausted_error_outside = _unit(
            outside,
            status="ERROR",
            attempts=MAX_ATTEMPTS,
            created_at=ancient,
            updated_at=ancient,
        )
        retryable_error_outside = _unit(
            outside, status="ERROR", attempts=1, created_at=ancient, updated_at=ancient
        )
        session.add_all(
            [
                stale_pending,
                fresh_pending,
                done_outside,
                done_inside,
                exhausted_error_outside,
                retryable_error_outside,
            ]
        )
        await session.flush()
        ids = {
            "stale_pending": stale_pending.id,
            "fresh_pending": fresh_pending.id,
            "done_outside": done_outside.id,
            "done_inside": done_inside.id,
            "exhausted_error_outside": exhausted_error_outside.id,
            "retryable_error_outside": retryable_error_outside.id,
        }

    producer = OnlineEvalProducer(db)
    producer._backstop_lookback_span_ids = 2
    # TTL shedding is opt-in (default off); this test exercises the opted-in path.
    producer._pending_ttl_seconds = 3600.0
    await producer._reap(now, produced_through)

    async with db() as session:
        remaining = {
            unit.id: unit.status for unit in await session.scalars(select(models.EvalWorkUnit))
        }
    assert remaining.get(ids["stale_pending"]) == "EXPIRED"
    assert remaining.get(ids["fresh_pending"]) == "PENDING"
    assert ids["done_outside"] not in remaining
    assert remaining.get(ids["done_inside"]) == "DONE"
    assert ids["exhausted_error_outside"] not in remaining
    assert remaining.get(ids["retryable_error_outside"]) == "ERROR"


async def test_reaper_default_keeps_old_pending_work(db: DbSessionFactory) -> None:
    """With the pending TTL unset (the default), backlog never expires: a
    PENDING unit older than any drain window stays claimable instead of being
    shed. TTL expiry is terminal and blocks backstop re-materialization of the
    same fingerprint, so shedding must be an explicit operator opt-in."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    now = _now()
    ancient = now - timedelta(days=30)
    async with db() as session:
        old_pending = models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status="PENDING",
            created_at=ancient,
        )
        session.add(old_pending)
        await session.flush()
        unit_id = old_pending.id

    producer = OnlineEvalProducer(db)
    producer._backstop_lookback_span_ids = 2
    await producer._reap(now, span.id)

    async with db() as session:
        unit = await session.get(models.EvalWorkUnit, unit_id)
    assert unit is not None
    assert unit.status == "PENDING"


async def test_admission_gate_skips_materialization(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
        backlog_span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)
    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=backlog_span.id,
                evaluator_id=evaluator_id,
                criteria_id=criteria_id,
                config_fingerprint=f"fp-{token_hex(8)}",
            )
        )
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    producer._max_pending = 0
    await producer._tick()

    async with db() as session:
        unit_count = await session.scalar(select(func.count()).select_from(models.EvalWorkUnit))
    assert unit_count == 1
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == 0


async def test_admission_gate_counts_nonterminal_backlog(db: DbSessionFactory) -> None:
    """The gate bounds all backlog that will eventually demand consumer
    capacity: RUNNING and retryable-ERROR rows count alongside PENDING (under
    a provider outage the pending population migrates into retryable ERROR),
    while exhausted ERROR is terminal and must not hold the gate closed."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    evaluator_id, criteria_id = await _seed_criteria(db, project.id)

    def _unit(status: str, **kwargs: Any) -> models.EvalWorkUnit:
        return models.EvalWorkUnit(
            span_rowid=span.id,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint=f"fp-{token_hex(8)}",
            status=status,
            **kwargs,
        )

    producer = OnlineEvalProducer(db)
    producer._max_pending = 0
    assert await producer._admission_gate_open()

    async with db() as session:
        session.add(_unit("ERROR", attempts=MAX_ATTEMPTS))
    assert await producer._admission_gate_open()  # exhausted ERROR is terminal

    async with db() as session:
        session.add(_unit("RUNNING", claimed_by="consumer-1", claimed_at=_now()))
        await session.flush()
        running_id = (
            await session.scalars(
                select(models.EvalWorkUnit.id).order_by(models.EvalWorkUnit.id.desc()).limit(1)
            )
        ).one()
    assert not await producer._admission_gate_open()  # RUNNING counts

    async with db() as session:
        await session.execute(
            update(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == running_id)
            .values(status="DONE")
        )
    assert await producer._admission_gate_open()

    async with db() as session:
        session.add(_unit("ERROR", attempts=1))
    assert not await producer._admission_gate_open()  # retryable ERROR counts


async def test_unexpected_criteria_load_error_fails_closed(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An unexpected exception during criteria resolution (e.g. a transient DB
    error) must abort the tick without advancing the cursor — advancing would
    silently skip the window for the criteria that failed to load."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    async def _transient_boom(*args: Any, **kwargs: Any) -> None:
        raise RuntimeError("transient version-lookup failure")

    monkeypatch.setattr(producer_module, "resolve_criteria", _transient_boom)

    producer = OnlineEvalProducer(db)
    with pytest.raises(RuntimeError, match="transient version-lookup failure"):
        await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == 0


async def test_uncompilable_filter_is_skipped_without_stalling(db: DbSessionFactory) -> None:
    """A filter_condition that fails to compile is a persistent per-criteria
    condition: the criteria is skipped (operator-visibly, via log) while the
    cursor still advances for the healthy criteria — one bad DSL string must
    not stall the shared cursor forever."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    good_evaluator_id, _ = await _seed_criteria(db, project.id)
    bad_evaluator_id, _ = await _seed_criteria(db, project.id, filter_condition="span_kind ==")
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=_now() - timedelta(seconds=120),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    async with db() as session:
        units = list(await session.scalars(select(models.EvalWorkUnit)))
    assert {unit.evaluator_id for unit in units} == {good_evaluator_id}
    assert bad_evaluator_id not in {unit.evaluator_id for unit in units}
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.produced_through_id == span.id


async def test_lease_stand_down_and_stale_reclaim(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
    await _seed_criteria(db, project.id)
    observed_at = _now() - timedelta(seconds=120)
    cursor_id = await _seed_cursor(
        db,
        observed_high_water_id=span.id,
        observed_at=observed_at,
        claimed_by="rival-producer",
        claimed_at=_now(),
    )

    producer = OnlineEvalProducer(db)
    await producer._tick()

    assert await _work_unit_span_rowids(db) == []
    cursor = await _get_cursor(db, cursor_id)
    assert cursor.claimed_by == "rival-producer"
    assert cursor.produced_through_id == 0

    async with db() as session:
        await session.execute(
            update(models.EvalWorkCursor)
            .where(models.EvalWorkCursor.id == cursor_id)
            .values(claimed_at=_now() - timedelta(seconds=300))
        )
    await producer._tick()

    cursor = await _get_cursor(db, cursor_id)
    assert cursor.claimed_by == producer._producer_id
    assert cursor.produced_through_id == span.id
    assert sorted(await _work_unit_span_rowids(db)) == [span.id]
