from secrets import token_hex
from typing import Any

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.triggering.rules import load_rules
from phoenix.server.types import DbSessionFactory

from ...._helpers import _add_project


async def _add_project_evaluator(
    session: AsyncSession,
    project: models.Project,
    *,
    evaluation_target: models.EvaluationTarget = "SESSION",
    enabled: bool = True,
) -> models.ProjectEvaluator:
    evaluator = models.BuiltinEvaluator(
        name=Identifier(root=f"eval-{token_hex(4)}"),
        kind="BUILTIN",
        key=token_hex(8),
        input_schema={},
        output_configs=[],
    )
    session.add(evaluator)
    await session.flush()
    project_evaluator = models.ProjectEvaluator(
        project_id=project.id,
        evaluator_id=evaluator.id,
        name=Identifier(root=f"project-evaluator-name-{token_hex(4)}"),
        filter_condition="",
        sampling_rate=1.0,
        evaluation_target=evaluation_target,
        enabled=enabled,
    )
    session.add(project_evaluator)
    await session.flush()
    return project_evaluator


async def _add_trigger(
    session: AsyncSession,
    project_evaluator: models.ProjectEvaluator,
    *,
    signal_kind: models.EvaluatorSignalKind = "annotation_upserted",
    **predicates: Any,
) -> models.ProjectEvaluatorTrigger:
    trigger = models.ProjectEvaluatorTrigger(
        project_evaluator_id=project_evaluator.id,
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
        project_evaluator = await _add_project_evaluator(session, project)
        trigger = await _add_trigger(
            session,
            project_evaluator,
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
    assert rule.project_evaluator_id == project_evaluator.id
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
        project_evaluator = await _add_project_evaluator(session, project, enabled=False)
        await _add_trigger(session, project_evaluator)

    async with db() as session:
        assert await load_rules(session) == ()

    async with db() as session:
        record = await session.get(models.ProjectEvaluator, project_evaluator.id)
        assert record is not None
        record.enabled = True

    async with db() as session:
        assert len(await load_rules(session)) == 1


async def test_triggers_on_span_project_evaluators_and_in_trace_projects_do_not_load(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        span_project_evaluator = await _add_project_evaluator(
            session, project, evaluation_target="SPAN"
        )
        await _add_trigger(session, span_project_evaluator)

        trace_project = await _add_project(session)
        owning_project_evaluator = await _add_project_evaluator(session, project)
        owning_project_evaluator.trace_project_id = trace_project.id
        reserved_project_evaluator = await _add_project_evaluator(session, trace_project)
        await _add_trigger(session, reserved_project_evaluator)

    async with db() as session:
        assert await load_rules(session) == ()


async def test_deleting_a_criteria_takes_its_triggers_with_it(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)

    async with db() as session:
        assert len(await load_rules(session)) == 1
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    async with db() as session:
        assert await load_rules(session) == ()

