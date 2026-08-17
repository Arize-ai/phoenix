from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_ENABLED,
    ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED,
    ENV_PHOENIX_ONLINE_EVAL_SIGNAL_RETENTION_SECONDS,
)
from phoenix.db import models
from phoenix.server.app import _db
from phoenix.server.online_eval.leases import LeaseLost
from phoenix.server.online_eval.triggering import drain as drain_module
from phoenix.server.online_eval.triggering.drain import SignalDrain, SignalNotConsumable
from phoenix.server.online_eval.triggering.log import AnnotationUpserted, append, drain_page
from phoenix.server.online_eval.triggering.rules import TriggerRule
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session
from .test_rules import _add_criteria, _add_trigger

_NOTICED_AT = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def session_evaluation_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_ENABLED, "true")
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "true")


def _annotation(annotation_id: int, *, label: str = "incorrect") -> AnnotationUpserted:
    return AnnotationUpserted(
        annotation_kind="span",
        annotation_id=annotation_id,
        target_rowid=annotation_id,
        edge="created",
        updated_at=_NOTICED_AT + timedelta(minutes=annotation_id),
        name="human-review",
        label=label,
        annotator_kind="HUMAN",
        source="APP",
    )


async def _add_live_session(
    session: AsyncSession,
    project: models.Project,
) -> models.ProjectSession:
    project_session = await _add_project_session(session, project)
    project_session.last_span_ingested_at = datetime.now(timezone.utc)
    await session.flush()
    return project_session


async def _requests(session: AsyncSession) -> list[models.EvaluationRequest]:
    rows = await session.scalars(
        select(models.EvaluationRequest).order_by(models.EvaluationRequest.id)
    )
    return list(rows)


async def _unacknowledged(db: DbSessionFactory) -> tuple[int, ...]:
    async with db() as session:
        return tuple(signal.signal_id for signal in await drain_page(session, limit=100))


async def test_a_matched_signal_becomes_a_request_and_its_page_is_acknowledged(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria, label="incorrect")
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )
        # A second occurrence no rule selects for, drained on the same page.
        await append(
            session,
            _annotation(2, label="correct"),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    await SignalDrain(db)._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.project_session_rowid == project_session.id
    assert request.criteria_id == criteria.id
    assert request.requested_generation == 1
    assert await _unacknowledged(db) == ()


async def test_a_signal_matching_a_dormant_trigger_is_acknowledged_without_a_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project, enabled=False)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_signal_whose_criteria_was_deleted_is_acknowledged_without_a_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    async with db() as session:
        await session.execute(
            delete(models.ProjectEvaluatorCriteria).where(
                models.ProjectEvaluatorCriteria.id == criteria.id
            )
        )

    await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_rule_whose_criteria_vanishes_before_the_request_is_consumed_as_a_no_op(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        trigger = await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    # The rule the matcher decided on, held past the deletion of the criteria it names.
    stale = TriggerRule(
        trigger_id=trigger.id,
        criteria_id=criteria.id,
        project_id=project.id,
        signal_kind="annotation_upserted",
    )
    async with db() as session:
        await session.execute(
            delete(models.ProjectEvaluatorCriteria).where(
                models.ProjectEvaluatorCriteria.id == criteria.id
            )
        )

    async def _stale_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
        return (stale,)

    monkeypatch.setattr(drain_module, "load_rules", _stale_rules)
    await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_signal_whose_session_has_no_content_identity_is_consumed_as_a_no_op(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        assert project_session.last_span_ingested_at is None
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_signal_whose_session_is_in_another_project_writes_no_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        elsewhere = await _add_project(session)
        foreign_session = await _add_live_session(session, elsewhere)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=foreign_session.id,
        )

    await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_rule_created_after_a_page_is_drained_never_matches_it(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    drain = SignalDrain(db)
    await drain._tick()
    assert await _unacknowledged(db) == ()

    async with db() as session:
        await _add_trigger(session, criteria)

    await drain._tick()

    async with db() as session:
        assert await _requests(session) == []

    # The rule does apply to what arrives after it.
    async with db() as session:
        await append(
            session,
            _annotation(2),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )
    await drain._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.requested_generation == 1


async def test_rules_sharing_a_criteria_advance_one_generation_per_occurrence(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria, annotation_name="human-review")
        await _add_trigger(session, criteria, label="incorrect")
        await _add_trigger(session, criteria, annotator_kind="HUMAN")
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    drain = SignalDrain(db)
    await drain._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.requested_generation == 1

    async with db() as session:
        for annotation_id in (2, 3):
            await append(
                session,
                _annotation(annotation_id),
                project_id=project.id,
                project_session_rowid=project_session.id,
            )

    await drain._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.requested_generation == 3


async def test_a_rejection_that_is_not_about_the_target_leaves_the_page_unacknowledged(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SESSION_ENABLED, "false")
    with pytest.raises(SignalNotConsumable):
        await SignalDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert len(await _unacknowledged(db)) == 1


async def test_losing_the_lease_leaves_the_page_unacknowledged(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    drain = SignalDrain(db)

    async def _stolen(session: AsyncSession) -> None:
        raise LeaseLost

    monkeypatch.setattr(drain._lease, "fence", _stolen)
    await drain._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert len(await _unacknowledged(db)) == 1


async def test_the_drain_purges_acknowledged_signals_past_the_safety_window(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        for annotation_id in (1, 2):
            await append(
                session,
                _annotation(annotation_id),
                project_id=project.id,
                project_session_rowid=project_session.id,
            )

    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_SIGNAL_RETENTION_SECONDS, "1800")
    drain = SignalDrain(db, purge_interval_seconds=0.0)
    await drain._tick()

    async with db() as session:
        stale = await session.scalar(select(models.EvaluatorSignal.id))
        await session.execute(
            update(models.EvaluatorSignal)
            .where(models.EvaluatorSignal.id == stale)
            .values(acknowledged_at=datetime.now(timezone.utc) - timedelta(hours=1))
        )

    assert await drain._purge_if_due() == 1

    async with db() as session:
        surviving = await session.scalars(select(models.EvaluatorSignal.id))
        assert stale not in list(surviving)


@pytest.mark.postgres_only
async def test_a_rule_committed_after_the_matching_select_does_not_participate(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        criteria = await _add_criteria(session, project)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            project_session_rowid=project_session.id,
        )

    drain = SignalDrain(db)
    committed_during_the_tick: Optional[int] = None

    async def _commit_a_rule_mid_tick(session: AsyncSession) -> None:
        nonlocal committed_during_the_tick
        async with db() as author:
            trigger = await _add_trigger(author, criteria)
            committed_during_the_tick = trigger.id
        await fence(session)

    fence = drain._lease.fence
    drain._lease.fence = _commit_a_rule_mid_tick  # type: ignore[method-assign]
    await drain._tick()
    assert committed_during_the_tick is not None

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()
