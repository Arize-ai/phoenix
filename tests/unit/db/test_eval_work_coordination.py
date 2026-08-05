from datetime import datetime, timezone
from secrets import token_hex

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError as SQLAlchemyIntegrityError
from sqlalchemy.orm import selectinload
from sqlean.dbapi2 import IntegrityError as SQLiteIntegrityError  # type: ignore[import-untyped]

from phoenix.db import models
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory

from .._helpers import _add_project, _add_project_session, _add_span, _add_trace

_INTEGRITY_ERRORS = (SQLAlchemyIntegrityError, SQLiteIntegrityError)


async def _seed_span_evaluator_and_criteria(db: DbSessionFactory) -> tuple[int, int, int]:
    """Create a span, a builtin evaluator, and a criteria row, returning
    (span_rowid, evaluator_id, criteria_id)."""
    async with db() as session:
        project = await _add_project(session)
        trace = await _add_trace(session, project)
        span = await _add_span(session, trace)
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
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SPAN",
        )
        session.add(criteria)
        await session.flush()
        return span.id, evaluator.id, criteria.id


async def test_eval_work_unit_defaults_and_relationships(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        work_unit = models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
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
                selectinload(models.EvalWorkUnit.criteria),
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
        assert fetched.criteria.id == criteria_id


async def test_eval_work_unit_distinct_fingerprints_coexist(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)
    async with db() as session:
        session.add_all(
            [
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
                    config_fingerprint="fp-a",
                ),
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
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
    span_rowid, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        session.add(
            models.EvalWorkUnit(
                span_rowid=span_rowid,
                evaluator_id=evaluator_id,
                criteria_id=criteria_id,
                config_fingerprint="fp-dup",
            )
        )
        await session.flush()

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
                    config_fingerprint="fp-dup",
                )
            )
            await session.flush()


async def test_eval_work_unit_rejects_unknown_status(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.EvalWorkUnit(
                    span_rowid=span_rowid,
                    evaluator_id=evaluator_id,
                    criteria_id=criteria_id,
                    config_fingerprint="fp-bad-status",
                    status="BOGUS",
                )
            )
            await session.flush()


async def test_eval_work_unit_accepts_expired_status(db: DbSessionFactory) -> None:
    span_rowid, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        work_unit = models.EvalWorkUnit(
            span_rowid=span_rowid,
            evaluator_id=evaluator_id,
            criteria_id=criteria_id,
            config_fingerprint="fp-expired",
            status="EXPIRED",
        )
        session.add(work_unit)
        await session.flush()
        work_unit_id = work_unit.id

    async with db() as session:
        fetched = await session.scalar(
            select(models.EvalWorkUnit).where(models.EvalWorkUnit.id == work_unit_id)
        )
        assert fetched is not None
        assert fetched.status == "EXPIRED"


async def test_session_liveness_and_work_accounting(db: DbSessionFactory) -> None:
    evaluated_through = datetime(2026, 1, 1, tzinfo=timezone.utc)
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        project_session_id = project_session.id
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
            project_id=project.id,
            evaluator_id=evaluator.id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="SESSION",
        )
        session.add(criteria)
        await session.flush()
        evaluator_id = evaluator.id
        criteria_id = criteria.id
        session.add(
            models.EvalSessionWorkUnit(
                project_session_rowid=project_session_id,
                evaluator_id=evaluator_id,
                criteria_id=criteria_id,
                config_fingerprint="fp-session",
                evaluated_through=evaluated_through,
            )
        )

    async with db() as session:
        fetched_session = await session.get(models.ProjectSession, project_session_id)
        assert fetched_session is not None
        assert fetched_session.last_span_seen_at is not None
        assert fetched_session.content_complete is True

        work_unit = await session.scalar(
            select(models.EvalSessionWorkUnit).options(
                selectinload(models.EvalSessionWorkUnit.project_session),
                selectinload(models.EvalSessionWorkUnit.evaluator),
                selectinload(models.EvalSessionWorkUnit.criteria),
            )
        )
        assert work_unit is not None
        assert work_unit.project_session.id == project_session_id
        assert work_unit.evaluator.id == evaluator_id
        assert work_unit.criteria.id == criteria_id
        assert work_unit.evaluated_through == evaluated_through
        assert work_unit.status == "PENDING"
        assert work_unit.attempts == 0


async def test_project_evaluator_criteria_defaults_and_relationships(
    db: DbSessionFactory,
) -> None:
    _, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        fetched = await session.scalar(
            select(models.ProjectEvaluatorCriteria)
            .where(models.ProjectEvaluatorCriteria.id == criteria_id)
            .options(
                selectinload(models.ProjectEvaluatorCriteria.project),
                selectinload(models.ProjectEvaluatorCriteria.evaluator),
            )
        )
        assert fetched is not None
        assert fetched.enabled is True
        assert fetched.name.root.startswith("criteria-")
        assert fetched.filter_condition == ""
        assert fetched.evaluation_target == "SPAN"
        assert fetched.evaluation_delay_seconds == 300
        assert fetched.input_mapping is None
        assert fetched.sampling_rate == 1.0
        assert fetched.evaluator.id == evaluator_id
        assert fetched.project is not None


async def test_project_evaluator_criteria_rejects_out_of_range_sampling_rate(
    db: DbSessionFactory,
) -> None:
    _, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        existing = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert existing is not None
        project_id = existing.project_id

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator_id,
                    name=Identifier(root=f"criteria-{token_hex(4)}"),
                    filter_condition="",
                    sampling_rate=1.5,
                    evaluation_target="SPAN",
                )
            )
            await session.flush()


async def test_project_evaluator_criteria_name_is_unique_per_project(
    db: DbSessionFactory,
) -> None:
    _, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)

    async with db() as session:
        existing = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert existing is not None
        project_id = existing.project_id
        name = existing.name

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator_id,
                    name=name,
                    filter_condition="",
                    sampling_rate=0.5,
                    evaluation_target="SPAN",
                )
            )
            await session.flush()


async def test_project_evaluator_criteria_preserves_empty_input_mapping(
    db: DbSessionFactory,
) -> None:
    _, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)
    async with db() as session:
        existing = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert existing is not None
        criteria = models.ProjectEvaluatorCriteria(
            project_id=existing.project_id,
            evaluator_id=evaluator_id,
            name=Identifier(root=f"criteria-{token_hex(4)}"),
            filter_condition="",
            sampling_rate=1.0,
            evaluation_target="TRACE",
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        )
        session.add(criteria)
        await session.flush()
        criteria_id = criteria.id

    async with db() as session:
        fetched = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert fetched is not None
        assert fetched.input_mapping == InputMapping(literal_mapping={}, path_mapping={})


async def test_project_evaluator_criteria_rejects_unknown_target(
    db: DbSessionFactory,
) -> None:
    _, evaluator_id, criteria_id = await _seed_span_evaluator_and_criteria(db)
    async with db() as session:
        existing = await session.get(models.ProjectEvaluatorCriteria, criteria_id)
        assert existing is not None
        project_id = existing.project_id

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.ProjectEvaluatorCriteria(
                    project_id=project_id,
                    evaluator_id=evaluator_id,
                    name=Identifier(root=f"criteria-{token_hex(4)}"),
                    filter_condition="",
                    sampling_rate=1.0,
                    evaluation_target="BOGUS",
                )
            )
            await session.flush()


async def test_eval_work_cursor_defaults(db: DbSessionFactory) -> None:
    async with db() as session:
        cursor = models.EvalWorkCursor(evaluation_target="SPAN", consumer_group="default")
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


async def test_eval_work_cursor_unique_target_group(db: DbSessionFactory) -> None:
    async with db() as session:
        session.add(models.EvalWorkCursor(evaluation_target="SPAN", consumer_group="default"))
        await session.flush()

    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(models.EvalWorkCursor(evaluation_target="SPAN", consumer_group="default"))
            await session.flush()


async def test_eval_work_cursor_rejects_unknown_evaluation_target(db: DbSessionFactory) -> None:
    with pytest.raises(_INTEGRITY_ERRORS):
        async with db() as session:
            session.add(
                models.EvalWorkCursor(
                    evaluation_target="BOGUS",
                    consumer_group="default",
                )
            )
            await session.flush()
