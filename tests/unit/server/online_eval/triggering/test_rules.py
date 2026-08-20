import logging
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import bindparam, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    annotation_rules_exist,
    load_rules,
)
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
    event_kind: models.EvaluatorEventKind = "annotation_upserted",
    **predicates: Any,
) -> models.ProjectEvaluatorTrigger:
    """A trigger with predicate JSON when any predicate is given."""
    trigger = models.ProjectEvaluatorTrigger(
        project_evaluator_id=project_evaluator.id,
        event_kind=event_kind,
        predicates={"type": event_kind, **predicates} if predicates else None,
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
            name="human-review",
            label="incorrect",
            score_below=0.5,
            annotator_kind="HUMAN",
            annotation_change="created",
            annotation_target="span",
        )

    async with db() as session:
        (rule,) = await load_rules(session, project_ids=[project.id])
    assert isinstance(rule, AnnotationTriggerRule)
    assert rule.trigger_id == trigger.id
    assert rule.project_evaluator_id == project_evaluator.id
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


async def test_a_trigger_without_predicates_loads_unconstrained(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)

    async with db() as session:
        (rule,) = await load_rules(session, project_ids=[project.id])
    assert isinstance(rule, AnnotationTriggerRule)
    assert rule.name is None
    assert rule.label is None
    assert rule.score_below is None
    assert rule.score_above is None
    assert rule.annotator_kind is None
    assert rule.annotation_change is None
    assert rule.annotation_target is None


async def test_invalid_or_retired_predicate_json_is_skipped(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project)
        valid = await _add_trigger(session, project_evaluator)
        malformed = await _add_trigger(session, project_evaluator, name="before corruption")
        retired = await _add_trigger(session, project_evaluator, name="before corruption")
        overwrite_predicates = text(
            "UPDATE project_evaluator_triggers SET predicates = :predicates WHERE id = :id"
        ).bindparams(bindparam("predicates", type_=models.JSON_))
        await session.execute(
            overwrite_predicates,
            {"id": malformed.id, "predicates": {"type": "annotation_upserted", "unexpected": True}},
        )
        await session.execute(
            overwrite_predicates,
            {"id": retired.id, "predicates": {"type": "evaluation_completed"}},
        )

    with caplog.at_level(logging.ERROR):
        async with db() as session:
            rules = await load_rules(session, project_ids=[project.id])

    assert [rule.trigger_id for rule in rules] == [valid.id]
    assert caplog.text.count("invalid predicates") == 2
    assert "evaluation_completed" in caplog.text


async def test_invalid_predicate_json_does_not_make_annotation_rules_exist(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project)
        mismatched = await _add_trigger(session, project_evaluator)
        await session.execute(
            text(
                "UPDATE project_evaluator_triggers SET predicates = :predicates WHERE id = :id"
            ).bindparams(bindparam("predicates", type_=models.JSON_)),
            {"id": mismatched.id, "predicates": {"type": "evaluation_completed"}},
        )

    async with db() as session:
        assert await annotation_rules_exist(session, project_id=project.id) is False


async def test_a_trigger_whose_criteria_is_disabled_is_dormant(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project, enabled=False)
        await _add_trigger(session, project_evaluator)

    async with db() as session:
        assert await load_rules(session, project_ids=[project.id]) == ()

    async with db() as session:
        record = await session.get(models.ProjectEvaluator, project_evaluator.id)
        assert record is not None
        record.enabled = True

    async with db() as session:
        assert len(await load_rules(session, project_ids=[project.id])) == 1


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
        assert await load_rules(session, project_ids=[project.id, evaluators_project.id]) == ()


async def test_deleting_a_criteria_takes_its_triggers_with_it(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluator = await _add_project_evaluator(session, project)
        await _add_trigger(session, project_evaluator)

    async with db() as session:
        assert len(await load_rules(session, project_ids=[project.id])) == 1
        await session.execute(
            delete(models.ProjectEvaluator).where(
                models.ProjectEvaluator.id == project_evaluator.id
            )
        )

    async with db() as session:
        assert await load_rules(session, project_ids=[project.id]) == ()


async def test_rules_load_only_for_the_projects_asked_for(db: DbSessionFactory) -> None:
    async with db() as session:
        project = await _add_project(session)
        project_evaluators = await _add_project_evaluator(session, project)
        trigger = await _add_trigger(session, project_evaluators)
        elsewhere = await _add_project(session)
        await _add_trigger(session, await _add_project_evaluator(session, elsewhere))

    async with db() as session:
        assert [rule.trigger_id for rule in await load_rules(session, project_ids=[project.id])] == [
            trigger.id
        ]
        assert await load_rules(session, project_ids=[]) == ()

