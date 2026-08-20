from datetime import datetime, timezone
from typing import Any, Optional

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.insertion import annotation as annotation_module
from phoenix.db.insertion.annotation import upsert_annotations
from phoenix.db.insertion.helpers import OnConflict
from phoenix.server.online_eval.coordinator import ClaimedWorkUnit
from phoenix.server.online_eval.db_coordinator import DbEvalWorkCoordinator
from phoenix.server.online_eval.session_sweeper import SessionEvalSweeper
from phoenix.server.online_eval.triggering.rules import AnnotationTriggerRule, TriggerRule
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project, _add_project_session, _add_span, _add_trace
from ..test_session_sweeper import _add_session_liveness, _seed_criteria
from .test_rules import _add_project_evaluator, _add_trigger

_CLAIMED_BY = "consumer"


async def _add_live_session(
    session: AsyncSession,
    project: models.Project,
) -> models.ProjectSession:
    project_session = await _add_project_session(session, project)
    project_session.last_span_ingested_at = datetime.now(timezone.utc)
    await session.flush()
    return project_session


async def _add_annotated_span(
    session: AsyncSession,
    project: models.Project,
    project_session: models.ProjectSession,
) -> models.Span:
    trace = await _add_trace(session, project, project_session)
    return await _add_span(session, trace)


async def _annotate(
    db: DbSessionFactory,
    span_rowid: int,
    *,
    name: str = "human-review",
    label: Optional[str] = "incorrect",
    identifier: str = "",
) -> None:
    """Write one span annotation through the seam, the way an ingesting caller does."""
    async with db() as session:
        await upsert_annotations(
            session,
            {
                "span_rowid": span_rowid,
                "name": name,
                "label": label,
                "score": None,
                "explanation": None,
                "metadata_": {},
                "annotator_kind": "HUMAN",
                "identifier": identifier,
                "source": "APP",
                "user_id": None,
            },
            table=models.SpanAnnotation,
            dialect=db.dialect,
            unique_by=("name", "span_rowid", "identifier"),
        )


async def _requests(db: DbSessionFactory) -> list[models.EvaluationRequest]:
    async with db() as session:
        rows = await session.scalars(
            select(models.EvaluationRequest).order_by(models.EvaluationRequest.id)
        )
        return list(rows)


async def _seed_rule_and_span(
    db: DbSessionFactory,
    **predicates: Any,
) -> tuple[models.ProjectEvaluator, models.ProjectSession, models.Span]:
    """A live annotation rule and a span whose annotations route to its session."""
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator, **predicates)
        span = await _add_annotated_span(session, project, project_session)
    return project_evaluator, project_session, span


async def test_a_matching_annotation_asks_and_a_non_matching_one_does_not(
    db: DbSessionFactory,
) -> None:
    project_evaluator, project_session, span = await _seed_rule_and_span(db, label="incorrect")

    await _annotate(db, span.id, label="correct")
    assert await _requests(db) == []

    await _annotate(db, span.id, label="incorrect")

    (request,) = await _requests(db)
    assert request.project_session_rowid == project_session.id
    assert request.project_evaluator_id == project_evaluator.id
    assert request.requested_generation == 1
    assert request.force_requested is False


async def test_the_seam_calls_the_first_write_created_and_the_next_one_updated(
    db: DbSessionFactory,
) -> None:
    _, _, span = await _seed_rule_and_span(db, annotation_change="updated")

    await _annotate(db, span.id, label="incorrect")
    assert await _requests(db) == []

    await _annotate(db, span.id, label="correct")

    (request,) = await _requests(db)
    assert request.requested_generation == 1


async def test_an_annotation_never_fires_another_project_s_rules(db: DbSessionFactory) -> None:
    await _seed_rule_and_span(db)
    async with db() as session:
        elsewhere = await _add_project(session)
        elsewhere_session = await _add_live_session(session, elsewhere)
        span = await _add_annotated_span(session, elsewhere, elsewhere_session)

    await _annotate(db, span.id)

    assert await _requests(db) == []


async def test_an_annotation_matching_a_dormant_trigger_asks_for_nothing(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project, enabled=False)
        await _add_trigger(session, project_evaluator)
        span = await _add_annotated_span(session, project, project_session)

    await _annotate(db, span.id)

    assert await _requests(db) == []


async def test_an_annotation_whose_criteria_was_deleted_asks_for_nothing(
    db: DbSessionFactory,
) -> None:
    project_evaluator, _, span = await _seed_rule_and_span(db)
    async with db() as session:
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    await _annotate(db, span.id)

    assert await _requests(db) == []


async def test_a_rejected_ask_leaves_the_annotation_written(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_project_session(session, project)
        assert project_session.last_span_ingested_at is None
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)
        span = await _add_annotated_span(session, project, project_session)

    await _annotate(db, span.id)

    assert await _requests(db) == []
    async with db() as session:
        assert await session.scalar(select(models.SpanAnnotation.id)) is not None


async def test_a_criteria_deleted_after_matching_is_rejected_without_raising(
    db: DbSessionFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_evaluator, _, span = await _seed_rule_and_span(db)
    async with db() as session:
        trigger_id = await session.scalar(select(models.ProjectEvaluatorTrigger.id))
        assert trigger_id is not None
        project_id = project_evaluator.project_id
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    # The rule the seam matched on, held past the deletion of the project_evaluator it names.
    stale = AnnotationTriggerRule(
        trigger_id=trigger_id,
        project_evaluator_id=project_evaluator.id,
        project_id=project_id,
        evaluation_target="SESSION",
    )

    async def _stale_rules(session: AsyncSession, *, project_ids: Any) -> tuple[TriggerRule, ...]:
        return (stale,)

    monkeypatch.setattr(annotation_module, "load_rules", _stale_rules)
    await _annotate(db, span.id)

    assert await _requests(db) == []
    async with db() as session:
        assert await session.scalar(select(models.SpanAnnotation.id)) is not None


async def test_a_rule_created_after_a_write_never_fires_on_it(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        span = await _add_annotated_span(session, project, project_session)

    await _annotate(db, span.id, name="first")
    async with db() as session:
        await _add_trigger(session, project_evaluator)
    assert await _requests(db) == []

    await _annotate(db, span.id, name="second")

    (request,) = await _requests(db)
    assert request.requested_generation == 1


async def test_rules_sharing_a_project_evaluator_ask_once_per_annotation(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_session = await _add_live_session(session, project)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator, name="human-review")
        await _add_trigger(session, project_evaluator, label="incorrect")
        await _add_trigger(session, project_evaluator, annotator_kind="HUMAN")
        span = await _add_annotated_span(session, project, project_session)

    await _annotate(db, span.id, identifier="first")

    (request,) = await _requests(db)
    assert request.requested_generation == 1

    await _annotate(db, span.id, identifier="second")
    await _annotate(db, span.id, identifier="third")

    (request,) = await _requests(db)
    assert request.requested_generation == 3


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

    The annotation write and the asks it matches land in the publication's fenced
    transaction; completion is a separate transition, and leaving it undone is what a
    publication that has to be retried looks like.
    """
    coordinator = DbEvalWorkCoordinator(db, evaluation_target="SESSION")

    async def _write(session: AsyncSession) -> None:
        await upsert_annotations(
            session,
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
    )


async def _last_span_ingested_at(db: DbSessionFactory, project_session_id: int) -> datetime:
    async with db() as session:
        ingested_at = await session.scalar(
            select(models.ProjectSession.last_span_ingested_at).where(
                models.ProjectSession.id == project_session_id
            )
        )
    assert ingested_at is not None
    return ingested_at


async def _seed_mutually_watching_evaluators(db: DbSessionFactory) -> tuple[int, int, int]:
    """One session and two evaluators, each triggering on the other's annotation name.

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
        )
        await _add_trigger(
            session,
            project_evaluator_a,
            name=_B_ANNOTATION,
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

    await sweeper._tick()
    units = await _claim_pending(db)
    assert set(units) == {project_evaluator_a_id, project_evaluator_b_id}

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION)
    await sweeper._tick()

    await _publish(db, units[project_evaluator_b_id], name=_B_ANNOTATION)

    # Each evaluator's annotation asked for the other.
    requested = sorted(request.project_evaluator_id for request in await _requests(db))
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
    for request in await _requests(db):
        assert request.materialized_generation == request.requested_generation


async def test_a_retried_publication_re_asks_and_the_brake_refuses_the_duplicate(
    db: DbSessionFactory,
) -> None:
    """Republishing the same verdict asks again; no second evaluation comes of it."""
    _, project_evaluator_a_id, project_evaluator_b_id = await _seed_mutually_watching_evaluators(db)
    sweeper = SessionEvalSweeper(db)
    await sweeper._tick()
    units = await _claim_pending(db)

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION, complete=False)
    (asked,) = [request for request in await _requests(db) if request.project_evaluator_id == project_evaluator_b_id]
    assert asked.requested_generation == 1

    await _publish(db, units[project_evaluator_a_id], name=_A_ANNOTATION)
    (re_asked,) = [
        request for request in await _requests(db) if request.project_evaluator_id == project_evaluator_b_id
    ]
    assert re_asked.requested_generation == 2

    await sweeper._tick()
    assert [unit.project_evaluator_id for unit in await _work_units(db)] == [project_evaluator_a_id, project_evaluator_b_id]

