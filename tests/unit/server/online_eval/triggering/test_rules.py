import logging
from secrets import token_hex
from typing import Any

import pytest
from sqlalchemy import bindparam, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.config import EVALUATORS_PROJECT_NAME
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    annotation_rules_exist,
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
    """A trigger with predicate JSON when any predicate is given."""
    trigger = models.ProjectEvaluatorTrigger(
        criteria_id=criteria.id,
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


async def test_invalid_or_retired_predicate_json_is_skipped(
    db: DbSessionFactory,
    caplog: pytest.LogCaptureFixture,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        valid = await _add_trigger(session, criteria)
        malformed = await _add_trigger(session, criteria, name="before corruption")
        retired = await _add_trigger(session, criteria, name="before corruption")
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
            rules = await load_rules(session)

    assert [rule.trigger_id for rule in rules] == [valid.id]
    assert caplog.text.count("invalid predicates") == 2
    assert "evaluation_completed" in caplog.text


async def test_invalid_predicate_json_does_not_make_annotation_rules_exist(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        project = await _add_project(session)
        criteria = await _add_criteria(session, project)
        mismatched = await _add_trigger(session, criteria)
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
