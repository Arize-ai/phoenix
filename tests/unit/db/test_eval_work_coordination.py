from secrets import token_hex

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory

from .._helpers import _add_span


async def _seed_span_and_evaluator(db: DbSessionFactory) -> tuple[int, int]:
    """Create a span and a builtin evaluator, returning (span_rowid, evaluator_id)."""
    async with db() as session:
        span = await _add_span(session)
        evaluator = models.BuiltinEvaluator(
            name=Identifier(root=f"eval-{token_hex(4)}"),
            kind="BUILTIN",
            key=token_hex(8),
            input_schema={},
            output_configs=[],
        )
        session.add(evaluator)
        await session.flush()
        return span.id, evaluator.id


async def test_eval_work_unit_defaults_and_relationships(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id = await _seed_span_and_evaluator(db)

    async with db() as session:
        work_unit = models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            config_fingerprint="fp-1",
        )
        session.add(work_unit)
        await session.flush()
        work_unit_id = work_unit.id

    async with db() as session:
        fetched = await session.scalar(
            select(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.id == work_unit_id)
            .options(
                selectinload(models.EvalWorkUnit.span),
                selectinload(models.EvalWorkUnit.evaluator),
            )
        )
        assert fetched is not None
        assert fetched.status == "PENDING"
        assert fetched.attempts == 0
        assert fetched.claimed_at is None
        assert fetched.claimed_by is None
        assert fetched.cooldown_until is None
        assert fetched.span.id == span_rowid
        assert fetched.evaluator.id == evaluator_id


async def test_eval_work_unit_distinct_fingerprints_coexist(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id = await _seed_span_and_evaluator(db)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    config_fingerprint="fp-a",
                ),
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    config_fingerprint="fp-b",
                ),
            ]
        )
        await session.flush()
        count = await session.scalar(
            select(func.count())
            .select_from(models.EvalWorkUnit)
            .where(models.EvalWorkUnit.span_rowid == span_rowid)
        )
        assert count == 2


async def test_eval_work_unit_work_key_is_unique(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id = await _seed_span_and_evaluator(db)

    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=span_rowid,
                evaluator_id=evaluator_id,
                config_fingerprint="fp-dup",
            )
        )
        await session.flush()

    with pytest.raises(Exception):
        async with db() as session:
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    config_fingerprint="fp-dup",
                )
            )
            await session.flush()


async def test_eval_work_unit_rejects_unknown_status(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id = await _seed_span_and_evaluator(db)

    with pytest.raises(Exception):
        async with db() as session:
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    config_fingerprint="fp-bad-status",
                    status="FINISHED",  # type: ignore[arg-type]
                )
            )
            await session.flush()


async def test_eval_work_cursor_defaults(db: DbSessionFactory) -> None:
    async with db() as session:
        cursor = models.EvalWorkCursor(grain="SPAN", consumer_group="default")
        session.add(cursor)
        await session.flush()
        cursor_id = cursor.id

    async with db() as session:
        fetched = await session.scalar(
            select(models.EvalWorkCursor).where(models.EvalWorkCursor.id == cursor_id)
        )
        assert fetched is not None
        assert fetched.produced_through_id == 0
        assert fetched.observed_high_water_id is None
        assert fetched.observed_at is None
        assert fetched.claimed_by is None


async def test_eval_work_cursor_unique_grain_group(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(models.EvalWorkCursor(grain="SPAN", consumer_group="default"))
        await session.flush()

    with pytest.raises(Exception):
        async with db() as session:
            session.add(models.EvalWorkCursor(grain="SPAN", consumer_group="default"))
            await session.flush()


async def test_eval_work_cursor_rejects_unknown_grain(db: DbSessionFactory) -> None:
    with pytest.raises(Exception):
        async with db() as session:
            session.add(
                models.EvalWorkCursor(
                    grain="DOCUMENT",  # type: ignore[arg-type]
                    consumer_group="default",
                )
            )
            await session.flush()
