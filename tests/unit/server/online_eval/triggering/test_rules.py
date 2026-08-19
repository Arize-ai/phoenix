from secrets import token_hex
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import EVALUATORS_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    EvaluationTriggerRule,
    evaluator_annotation_rules_exist,
    load_rules,
)
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project


async def _add_criteria(
    session: AsyncSession,
    project: models.Project,
    *,
    evaluation_target: models.EvaluationTarget = "SESSION",
    enabled: bool = True,
) -> models.ProjectEvaluatorCriteria:
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
        evaluation_target=evaluation_target,
        enabled=enabled,
    )
    session.add(criteria)
    await session.flush()
    return criteria


async def _add_trigger(
    session: AsyncSession,
    criteria: models.ProjectEvaluatorCriteria,
    *,
    event_kind: models.EvaluatorEventKind = "annotation_upserted",
    **predicates: Any,
) -> models.ProjectEvaluatorTrigger:
    """A trigger, with a predicate row of its own family when any predicate is given."""
    trigger = models.ProjectEvaluatorTrigger(criteria_id=criteria.id, event_kind=event_kind)
    session.add(trigger)
    await session.flush()
    if predicates:
        table = (
            models.ProjectEvaluatorTriggerAnnotationPredicates
            if event_kind == "annotation_upserted"
            else models.ProjectEvaluatorTriggerEvaluationPredicates
        )
        session.add(table(trigger_id=trigger.id, event_kind=event_kind, **predicates))
        await session.flush()
    return trigger


async def test_a_live_rule_loads_with_its_predicates_and_its_criteria_s_project(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        trigger = await _add_trigger(
            session,
            criteria,
            name="human-review",
            label="incorrect",
            score_below=0.5,
            annotator_kind="HUMAN",
            annotation_change="created",
            annotation_target="span",
            matches_evaluator_annotations=True,
        )

    async with db() as session:
        (rule,) = await load_rules(session)
    assert isinstance(rule, AnnotationTriggerRule)
    assert rule.trigger_id == trigger.id
    assert rule.criteria_id == criteria.id
    assert rule.project_id == project.id
    assert rule.evaluation_target == "SESSION"
    assert rule.event_kind == "annotation_upserted"
    assert rule.name == "human-review"
    assert rule.label == "incorrect"
    assert rule.score_below == 0.5
    assert rule.score_above is None
    assert rule.annotator_kind == "HUMAN"
    assert rule.annotation_change == "created"
    assert rule.annotation_target == "span"
    assert rule.matches_evaluator_annotations is True


async def test_an_evaluation_rule_loads_with_the_predicates_of_its_own_family(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        watched = await _add_criteria(session, project)
        trigger = await _add_trigger(
            session,
            criteria,
            event_kind="evaluation_completed",
            name="hallucination",
            label="hallucinated",
            source_criteria_id=watched.id,
            result_changed_only=True,
        )

    async with db() as session:
        (rule,) = await load_rules(session)
    assert isinstance(rule, EvaluationTriggerRule)
    assert rule.trigger_id == trigger.id
    assert rule.event_kind == "evaluation_completed"
    assert rule.name == "hallucination"
    assert rule.label == "hallucinated"
    assert rule.source_criteria_id == watched.id
    assert rule.result_changed_only is True


async def test_a_trigger_without_predicates_loads_unconstrained(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)

    async with db() as session:
        (rule,) = await load_rules(session)
    assert isinstance(rule, AnnotationTriggerRule)
    assert rule.name is None
    assert rule.label is None
    assert rule.score_below is None
    assert rule.score_above is None
    assert rule.annotator_kind is None
    assert rule.annotation_change is None
    assert rule.annotation_target is None
    assert rule.matches_evaluator_annotations is False


async def test_only_an_opted_in_annotation_rule_makes_evaluator_annotations_worth_logging(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria, matches_evaluator_annotations=False)

    async with db() as session:
        assert await evaluator_annotation_rules_exist(session) is False

    async with db() as session:
        opted_in = await _add_criteria(session, project)
        await _add_trigger(session, opted_in, matches_evaluator_annotations=True)

    async with db() as session:
        assert await evaluator_annotation_rules_exist(session) is True


async def test_a_trigger_whose_criteria_is_disabled_is_dormant(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project, enabled=False)
        await _add_trigger(session, criteria)

    async with db() as session:
        assert await load_rules(session) == ()

    async with db() as session:
        record = await session.get(models.ProjectEvaluatorCriteria, criteria.id)
        assert record is not None
        record.enabled = True

    async with db() as session:
        assert len(await load_rules(session)) == 1


async def test_triggers_on_span_criteria_and_on_the_evaluators_project_do_not_load(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        span_criteria = await _add_criteria(session, project, evaluation_target="SPAN")
        await _add_trigger(session, span_criteria)

        evaluators_project = await _add_project(session, name=EVALUATORS_PROJECT_NAME)
        reserved_criteria = await _add_criteria(session, evaluators_project)
        await _add_trigger(session, reserved_criteria)

    async with db() as session:
        assert await load_rules(session) == ()


async def test_deleting_a_criteria_takes_its_triggers_with_it(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        await _add_trigger(session, criteria)

    async with db() as session:
        assert len(await load_rules(session)) == 1
        await session.execute(
            delete(models.ProjectEvaluatorCriteria).where(
                models.ProjectEvaluatorCriteria.id == criteria.id
            )
        )

    async with db() as session:
        assert await load_rules(session) == ()
