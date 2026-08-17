from secrets import token_hex
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import EVALUATORS_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.triggering.rules import load_rules
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
    signal_kind: models.EvaluatorSignalKind = "annotation_upserted",
    **predicates: Any,
) -> models.ProjectEvaluatorTrigger:
    trigger = models.ProjectEvaluatorTrigger(
        criteria_id=criteria.id,
        signal_kind=signal_kind,
        **predicates,
    )
    session.add(trigger)
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
            annotation_name="human-review",
            label="incorrect",
            score_below=0.5,
            annotator_kind="HUMAN",
            annotation_edge="created",
            annotation_kind="span",
        )

    async with db() as session:
        (rule,) = await load_rules(session)
    assert rule.trigger_id == trigger.id
    assert rule.criteria_id == criteria.id
    assert rule.project_id == project.id
    assert rule.signal_kind == "annotation_upserted"
    assert rule.annotation_name == "human-review"
    assert rule.label == "incorrect"
    assert rule.score_below == 0.5
    assert rule.score_above is None
    assert rule.annotator_kind == "HUMAN"
    assert rule.annotation_edge == "created"
    assert rule.annotation_kind == "span"
    assert rule.source_evaluator_id is None
    assert rule.result_changed_only is False


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
