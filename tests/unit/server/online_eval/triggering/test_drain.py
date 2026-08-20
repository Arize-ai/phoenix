import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from phoenix.config import (
    ENV_PHOENIX_ONLINE_EVAL_EVENT_DRAIN_PAGE_SIZE,
    ENV_PHOENIX_ONLINE_EVAL_EVENT_RETENTION_SECONDS,
)
from phoenix.db import models
from phoenix.db.insertion.helpers import OnConflict, insert_on_conflict
from phoenix.server.app import _db
from phoenix.server.online_eval.coordinator import ClaimedWorkUnit
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.executor import _announce_annotations
from phoenix.server.online_eval.leases import LeaseLost
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.online_eval.triggering import drain as drain_module
from phoenix.server.online_eval.triggering.drain import EventDrain
from phoenix.server.online_eval.triggering.log import (
    AnnotationUpserted,
    EvaluationCompleted,
    append,
    drain_page,
)
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    TriggerRule,
)
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace
from ..test_session_sweeper import _add_session_liveness, _seed_criteria
from .test_rules import _add_project_evaluator, _add_trigger

_NOTICED_AT = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)
_CLAIMED_BY = "consumer"


def _annotation(annotation_id: int, *, label: str = "incorrect") -> AnnotationUpserted:
    return AnnotationUpserted(
        annotation_target="span",
        annotation_id=annotation_id,
        target_rowid=annotation_id,
        change="created",
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
        return tuple(event.event_id for event in await drain_page(session, limit=100))


async def _append_backlog(db: DbSessionFactory, count: int) -> tuple[int, ...]:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        for annotation_id in range(1, count + 1):
            await append(
                session,
                _annotation(annotation_id),
                project_id=project.id,
                evaluation_target="SESSION",
                target_rowid=project_session.id,
            )
    return await _unacknowledged(db)


async def test_a_matched_event_becomes_a_request_and_its_page_is_acknowledged(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator, label="incorrect")
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )
        # A second occurrence no rule selects for, drained on the same page.
        await append(
            session,
            _annotation(2, label="correct"),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    await EventDrain(db)._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.project_session_rowid == project_session.id
    assert request.project_evaluator_id == project_evaluator.id
    assert request.requested_generation == 1
    assert await _unacknowledged(db) == ()


async def test_one_tick_drains_three_full_pages_with_a_four_page_budget(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_EVENT_DRAIN_PAGE_SIZE, "2")
    monkeypatch.setattr(drain_module, "MAX_PAGES_PER_TICK", 4)
    event_ids = await _append_backlog(db, 6)
    drain = EventDrain(db)
    renew = drain._lease.renew
    renewals = 0

    async def _counted_renew() -> None:
        nonlocal renewals
        renewals += 1
        await renew()

    monkeypatch.setattr(drain._lease, "renew", _counted_renew)
    await drain._tick()

    assert event_ids
    assert await _unacknowledged(db) == ()
    assert renewals == 3


async def test_a_one_page_budget_preserves_one_page_per_tick(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_EVENT_DRAIN_PAGE_SIZE, "2")
    monkeypatch.setattr(drain_module, "MAX_PAGES_PER_TICK", 1)
    event_ids = await _append_backlog(db, 4)
    drain = EventDrain(db)

    await drain._tick()
    assert await _unacknowledged(db) == event_ids[2:]

    await drain._tick()
    assert await _unacknowledged(db) == ()


async def test_a_tick_stops_when_its_page_budget_is_exhausted(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_EVENT_DRAIN_PAGE_SIZE, "2")
    monkeypatch.setattr(drain_module, "MAX_PAGES_PER_TICK", 4)
    event_ids = await _append_backlog(db, 10)
    drain = EventDrain(db)

    await drain._tick()
    assert await _unacknowledged(db) == event_ids[8:]

    await drain._tick()
    assert await _unacknowledged(db) == ()


async def test_an_event_matching_a_dormant_trigger_is_acknowledged_without_a_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project, enabled=False)
        await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    await EventDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_an_event_whose_criteria_was_deleted_is_acknowledged_without_a_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    async with db() as session:
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    await EventDrain(db)._tick()

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
        project_evaluator = await _add_project_evaluator(session, project)
        trigger = await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    # The rule the matcher decided on, held past the deletion of the project evaluator it names.
    stale = AnnotationTriggerRule(
        trigger_id=trigger.id,
        project_evaluator_id=project_evaluator.id,
        project_id=project.id,
        evaluation_target="SESSION",
    )
    async with db() as session:
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    async def _stale_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
        return (stale,)

    monkeypatch.setattr(drain_module, "load_rules", _stale_rules)
    await EventDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_an_event_whose_session_has_no_content_identity_is_consumed_as_a_no_op(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        assert project_session.last_span_ingested_at is None
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    await EventDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_an_event_whose_session_is_in_another_project_writes_no_request(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        elsewhere = await _add_project(session)
        foreign_session = await _add_live_session(session, elsewhere)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=foreign_session.id,
        )

    await EventDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_rule_created_after_a_page_is_drained_never_matches_it(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    drain = EventDrain(db)
    await drain._tick()
    assert await _unacknowledged(db) == ()

    async with db() as session:
        await _add_trigger(session, project_evaluator)

    await drain._tick()

    async with db() as session:
        assert await _requests(session) == []

    # The rule does apply to what arrives after it.
    async with db() as session:
        await append(
            session,
            _annotation(2),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )
    await drain._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.requested_generation == 1


async def test_rules_sharing_a_project_evaluator_advance_one_generation_per_occurrence(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator, name="human-review")
        await _add_trigger(session, project_evaluator, label="incorrect")
        await _add_trigger(session, project_evaluator, annotator_kind="HUMAN")
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    drain = EventDrain(db)
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
                evaluation_target="SESSION",
                target_rowid=project_session.id,
            )

    await drain._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.requested_generation == 3


async def test_losing_the_lease_leaves_the_page_unacknowledged(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    drain = EventDrain(db)

    async def _stolen(session: AsyncSession) -> None:
        raise LeaseLost

    monkeypatch.setattr(drain._lease, "fence", _stolen)
    await drain._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert len(await _unacknowledged(db)) == 1


async def test_the_drain_purges_acknowledged_events_on_its_first_tick(
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
                evaluation_target="SESSION",
                target_rowid=project_session.id,
            )
        stale = await session.scalar(select(models.EvaluatorEvent.id))
        await session.execute(
            update(models.EvaluatorEvent)
            .where(models.EvaluatorEvent.id == stale)
            .values(acknowledged_at=datetime.now(timezone.utc) - timedelta(hours=1))
        )

    monkeypatch.setenv(ENV_PHOENIX_ONLINE_EVAL_EVENT_RETENTION_SECONDS, "1800")
    await EventDrain(db)._tick()

    async with db() as session:
        surviving = list(await session.scalars(select(models.EvaluatorEvent.id)))
        assert stale not in surviving
        assert len(surviving) == 1


@pytest.mark.postgres_only
async def test_a_rule_committed_after_the_matching_select_does_not_participate(
    postgresql_engine: AsyncEngine,
) -> None:
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await append(
            session,
            _annotation(1),
            project_id=project.id,
            evaluation_target="SESSION",
            target_rowid=project_session.id,
        )

    drain = EventDrain(db)
    committed_during_the_tick: Optional[int] = None

    async def _commit_a_rule_mid_tick(session: AsyncSession) -> None:
        nonlocal committed_during_the_tick
        async with db() as author:
            trigger = await _add_trigger(author, project_evaluator)
            committed_during_the_tick = trigger.id
        await fence(session)

    fence = drain._lease.fence
    drain._lease.fence = _commit_a_rule_mid_tick  # type: ignore[method-assign]
    await drain._tick()
    assert committed_during_the_tick is not None

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


_A_ANNOTATION = "helpfulness"
_B_ANNOTATION = "hallucination"


async def _work_units(db: DbSessionFactory) -> list[models.EvalSessionWorkUnit]:
    async with db() as session:
        rows = await session.scalars(
            select(models.EvalSessionWorkUnit).order_by(models.EvalSessionWorkUnit.id)
        )
        return list(rows)


async def _claim_pending(db: DbSessionFactory) -> dict[int, ClaimedWorkUnit]:
    """Lease every pending session unit, keyed by the project_evaluator it runs."""
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")
    claimed = await coordinator.claim(claimed_by=_CLAIMED_BY, limit=100)
    return {unit.project_evaluator_id: unit for unit in claimed}


async def _publish(
    db: DbSessionFactory,
    unit: ClaimedWorkUnit,
    *,
    name: str,
    complete: bool = True,
) -> None:
    """Publish one evaluator's verdict the way the executor does.

    The annotation write and the generated-annotation announcement land in the
    publication's fenced transaction; completion is a separate transition, and leaving
    it undone is what a publication that has to be retried looks like.
    """
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")

    async def _write(session: AsyncSession) -> None:
        inserted = (
            await session.scalars(
                insert_on_conflict(
                    {
                        "project_session_id": unit.target_rowid,
                        "name": name,
                        "label": "yes",
                        "score": None,
                        "explanation": None,
                        "metadata_": {},
                        "annotator_kind": "LLM",
                        "identifier": unit.identifier,
                        "source": "API",
                        "user_id": None,
                    },
                    table=models.ProjectSessionAnnotation,
                    dialect=db.dialect,
                    unique_by=("name", "project_session_id", "identifier"),
                    on_conflict=OnConflict.DO_UPDATE,
                ).returning(models.ProjectSessionAnnotation.id)
            )
        ).all()
        if inserted:
            await _announce_annotations(
                session,
                unit,
                models.ProjectSessionAnnotation,
                inserted,
                replaced_names=frozenset(),
            )

    await coordinator.publish(
        work_unit_id=unit.work_unit_id,
        claimed_by=_CLAIMED_BY,
        write=_write,
    )
    if not complete:
        return
    await coordinator.complete(
        work_unit_id=unit.work_unit_id,
        claimed_by=_CLAIMED_BY,
        completion_events=(
            EvaluationCompleted(
                work_unit_kind="session",
                work_unit_id=unit.work_unit_id,
                project_evaluator_id=unit.project_evaluator_id,
                evaluator_name=name,
                name=name,
                label="yes",
            ),
        ),
    )


async def _generated_events(db: DbSessionFactory) -> list[models.EvaluatorEvent]:
    async with db() as session:
        rows = await session.scalars(
            select(models.EvaluatorEvent)
            .where(models.EvaluatorEvent.kind == "annotation_upserted")
            .order_by(models.EvaluatorEvent.id)
        )
        return list(rows)


async def _last_span_ingested_at(db: DbSessionFactory, project_session_id: int) -> datetime:
    async with db() as session:
        ingested_at = await session.scalar(
            select(models.ProjectSession.last_span_ingested_at).where(
                models.ProjectSession.id == project_session_id
            )
        )
    assert ingested_at is not None
    return ingested_at


async def _seed_mutually_watching_evaluators(
    db: DbSessionFactory,
    *,
    b_matches_evaluator_annotations: bool = True,
) -> tuple[int, int, int]:
    """One session and two evaluators, each opted in to the other's annotations.

    Returns the session rowid and both project_evaluator ids.
    """
    project_id, project_session_id, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_a_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    _, project_evaluator_b_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")
    async with db() as session:
        project_evaluator_a = await session.get(models.ProjectEvaluator, project_evaluator_a_id)
        project_evaluator_b = await session.get(models.ProjectEvaluator, project_evaluator_b_id)
        assert project_evaluator_a is not None and project_evaluator_b is not None
        await _add_trigger(
            session,
            project_evaluator_b,
            name=_A_ANNOTATION,
            matches_evaluator_annotations=b_matches_evaluator_annotations,
        )
        await _add_trigger(
            session,
            project_evaluator_a,
            name=_B_ANNOTATION,
            matches_evaluator_annotations=True,
        )
    return project_session_id, project_evaluator_a_id, project_evaluator_b_id


async def test_an_opted_in_evaluator_cycle_settles_on_the_unchanged_content_watermark(
    db: DbSessionFactory,
) -> None:
    """Two evaluators each triggering on the other's output stop after one round.

    Nothing brakes the requests — they are written and granted both ways. What stops
    the cycle is that an annotation never advances the session's content, so the second
    request for A is answered by the evaluation A already finished.
    """
    project_session_id, project_evaluator_a_id, project_evaluator_b_id = await _seed_mutually_watching_evaluators(db)
    ingested_at = await _last_span_ingested_at(db, project_session_id)
    sweeper = SessionEvalSweeper(db)
    drain = EventDrain(db)

    await sweeper._tick()
    units = await _claim_pending(db)
    assert set(units) == {project_evaluator_a_id, project_evaluator_b_id}

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION)
    await drain._tick()
    await sweeper._tick()

    await _publish(db, units[project_evaluator_b_id], name=_B_ANNOTATION)
    await drain._tick()

    # Each evaluator's annotation asked for the other.
    async with db() as session:
        requested = sorted(request.project_evaluator_id for request in await _requests(session))
    assert requested == sorted([project_evaluator_a_id, project_evaluator_b_id])

    await sweeper._tick()

    # The falsifier: an annotation that advanced the session's content would let the
    # second request schedule fresh work, and the cycle would have no per-node bound.
    assert await _last_span_ingested_at(db, project_session_id) == ingested_at
    work = await _work_units(db)
    assert [(unit.project_evaluator_id, unit.status) for unit in work] == [
        (project_evaluator_a_id, "DONE"),
        (project_evaluator_b_id, "DONE"),
    ]
    async with db() as session:
        for request in await _requests(session):
            assert request.materialized_generation == request.requested_generation


async def test_a_rule_that_did_not_opt_in_ignores_a_generated_annotation_that_was_logged(
    db: DbSessionFactory,
) -> None:
    """The occurrence reaches the log; the rule that never asked for it draws nothing.

    The refusal itself is the matcher's, and is asserted there. What this pins is that
    an opted-out rule is refused at matching rather than silently unannounced.
    """
    _, project_evaluator_a_id, _ = await _seed_mutually_watching_evaluators(
        db,
        b_matches_evaluator_annotations=False,
    )
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    units = await _claim_pending(db)

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION)

    (logged,) = await _generated_events(db)
    assert logged.payload["project_evaluator_id"] == project_evaluator_a_id
    assert logged.payload["name"] == _A_ANNOTATION

    await EventDrain(db)._tick()

    async with db() as session:
        assert await _requests(session) == []
    assert await _unacknowledged(db) == ()


async def test_a_publication_retried_before_it_completes_logs_one_generated_annotation(
    db: DbSessionFactory,
) -> None:
    """The occurrence is the publication, not the attempt, so a retry of it collapses.

    A later distinct annotation write staying distinct is the other half, and is pinned
    at the log altitude in test_log.
    """
    _, project_evaluator_a_id, _ = await _seed_mutually_watching_evaluators(db)
    await SessionEvalSweeper(db)._tick()
    units = await _claim_pending(db)

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION, complete=False)
    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION)

    assert len(await _generated_events(db)) == 1


async def test_publishing_logs_no_annotation_when_no_rule_asked_for_evaluator_output(
    db: DbSessionFactory,
) -> None:
    project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    _, project_evaluator_id = await _seed_criteria(db, project_id, evaluation_target="SESSION")

    await SessionEvalSweeper(db)._tick()
    units = await _claim_pending(db)
    await _publish(db, units[project_evaluator_id], name=_A_ANNOTATION)

    assert await _generated_events(db) == []


async def test_evaluator_annotation_rule_gate_is_project_scoped(
    db: DbSessionFactory,
) -> None:
    opted_in_project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    _, opted_in_project_evaluator_id = await _seed_criteria(
        db,
        opted_in_project_id,
        evaluation_target="SESSION",
    )
    async with db() as session:
        opted_in_criteria = await session.get(
            models.ProjectEvaluator,
            opted_in_project_evaluator_id,
        )
        assert opted_in_criteria is not None
        await _add_trigger(
            session,
            opted_in_criteria,
            matches_evaluator_annotations=True,
        )

    bystander_project_id, _, _ = await _add_session_liveness(db, age_seconds=600)
    _, bystander_project_evaluator_id = await _seed_criteria(
        db,
        bystander_project_id,
        evaluation_target="SESSION",
    )
    await SessionEvalSweeper(db)._tick()
    units = await _claim_pending(db)

    await _publish(db, units[bystander_project_evaluator_id], name=_A_ANNOTATION)

    assert await _generated_events(db) == []


async def test_an_occurrence_routed_to_a_span_is_consumed_without_holding_up_a_session(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A rule on a target the drain cannot ask for never turns into a request.

    Only session evaluations can be requested, so a span- or trace-routed occurrence is
    acknowledged and passed over. The rules are supplied directly because a project_evaluator on
    any other target is dormant, which would settle the question before the drain saw it.
    """
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        trace = await _add_trace(session, project, project_session)
        span = await _add_span(session, trace)
        project_evaluator = await _add_project_evaluator(session, project)
        routed: tuple[tuple[models.EvaluationTarget, int], ...] = (
            ("SPAN", span.id),
            ("TRACE", trace.id),
            ("SESSION", project_session.id),
        )
        for evaluation_target, target_rowid in routed:
            await append(
                session,
                _annotation(target_rowid),
                project_id=project.id,
                evaluation_target=evaluation_target,
                target_rowid=target_rowid,
            )

    every_target: tuple[models.EvaluationTarget, ...] = ("SPAN", "TRACE", "SESSION")
    unconstrained = tuple(
        AnnotationTriggerRule(
            trigger_id=index,
            project_evaluator_id=project_evaluator.id,
            project_id=project.id,
            evaluation_target=evaluation_target,
        )
        for index, evaluation_target in enumerate(every_target, start=1)
    )

    async def _every_target(session: AsyncSession) -> tuple[TriggerRule, ...]:
        return unconstrained

    monkeypatch.setattr(drain_module, "load_rules", _every_target)
    with caplog.at_level(logging.INFO, logger=drain_module.__name__):
        await EventDrain(db)._tick()

    async with db() as session:
        (request,) = await _requests(session)
    assert request.project_session_rowid == project_session.id
    assert request.project_evaluator_id == project_evaluator.id
    # Only the session occurrence asked; the other two never reached the request layer.
    assert request.requested_generation == 1
    assert await _unacknowledged(db) == ()
    assert "SessionTarget" in caplog.text

