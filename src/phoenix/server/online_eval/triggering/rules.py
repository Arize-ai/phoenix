"""Load live, schema-validated rule shapes that say which events demand work.

This is the only module that knows an event can cause an evaluation.

Each event kind has its own predicate model and rule type here. A new kind is a new
model and a new rule type; the ones already in place do not change.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, ClassVar, Optional

from pydantic import ValidationError
from sqlalchemy import Select, select, type_coerce
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import exclude_criteria_targeting_evaluator_traces
from phoenix.db.types.evaluator_trigger_predicates import (
    AnnotationPredicates,
    TriggerPredicates,
    TriggerPredicatesType,
)
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable

logger = logging.getLogger(__name__)

_raw_predicates = type_coerce(
    models.ProjectEvaluatorTrigger.__table__.c.predicates,
    models.JSON_,
).label("predicates")


@dataclass(frozen=True)
class _Rule:
    """What every live rule carries, whatever it matches on.

    `evaluation_target` is the criteria's, and an event only matches a rule that routes
    to the same kind of entity.
    """

    trigger_id: int
    criteria_id: int
    project_id: int
    evaluation_target: models.EvaluationTarget


@dataclass(frozen=True)
class AnnotationTriggerRule(_Rule):
    """One live rule on annotation writes.

    Every predicate is optional and None means unconstrained, so a rule with all of them
    unset fires on every annotation write in its project, whoever wrote it.
    """

    event_kind: ClassVar[models.EvaluatorEventKind] = "annotation_upserted"

    name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    annotator_kind: Optional[str] = None
    annotation_change: Optional[models.AnnotationChange] = None
    annotation_target: Optional[models.AnnotationTarget] = None


TriggerRule: TypeAlias = AnnotationTriggerRule


def _live_rules(*selected: Any) -> Select[Any]:
    """Select ``selected`` from the rules that can fire right now.

    A trigger is dormant while its criteria is unschedulable, and the dormant ones are
    left out here rather than filtered afterwards. Both exclusions this applies —
    `session_criteria_is_schedulable` and `exclude_criteria_targeting_evaluator_traces`
    — already have row-side voices in `session_policy.session_schedulability_reason` and
    `SchedulabilityReason.TARGETS_EVALUATOR_TRACES`, so a surface asking why a trigger
    never fires can answer without re-deriving the rules.
    """
    return exclude_criteria_targeting_evaluator_traces(
        select(*selected)
        .join(
            models.ProjectEvaluatorCriteria,
            models.ProjectEvaluatorTrigger.criteria_id == models.ProjectEvaluatorCriteria.id,
        )
        .where(session_criteria_is_schedulable(models.ProjectEvaluatorCriteria))
    )


def _validated_predicates(
    trigger_id: int,
    event_kind: models.EvaluatorEventKind,
    value: Any,
) -> tuple[bool, Optional[TriggerPredicatesType]]:
    """Validate one stored predicate object without letting a bad row broaden a rule."""
    if value is None:
        return True, None
    try:
        predicates = TriggerPredicates.model_validate(value).root
    except ValidationError as error:
        logger.error(
            "Skipping project evaluator trigger %s: invalid predicates: %s",
            trigger_id,
            error,
        )
        return False, None
    if predicates.type != event_kind:
        logger.error(
            "Skipping project evaluator trigger %s: predicate type %s disagrees with event kind %s",
            trigger_id,
            predicates.type,
            event_kind,
        )
        return False, None
    return True, predicates


async def _rules_exist_for_event_kind(
    session: AsyncSession,
    event_kind: models.EvaluatorEventKind,
    project_id: int,
) -> bool:
    rows = await session.execute(
        _live_rules(
            models.ProjectEvaluatorTrigger.id,
            models.ProjectEvaluatorTrigger.event_kind,
            _raw_predicates,
        ).where(
            models.ProjectEvaluatorCriteria.project_id == project_id,
            models.ProjectEvaluatorTrigger.event_kind == event_kind,
        )
    )
    return any(_validated_predicates(row.id, row.event_kind, row.predicates)[0] for row in rows)


async def annotation_rules_exist(session: AsyncSession, *, project_id: int) -> bool:
    """Whether any valid live rule fires on annotations in the project.

    Annotation writes append events only when one does. Without the gate, turning
    session evaluation on also turns on an event write per annotation write, plus a day
    of retained payload, drained against an empty rule set — an amplification an
    operator never asked for and cannot see.

    Like `load_rules`, this read is a linearization point: a rule committed after it
    does not cause an earlier annotation transaction to append an event.
    """
    return await _rules_exist_for_event_kind(session, "annotation_upserted", project_id)


async def load_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
    """Read every valid rule that can fire right now.

    This statement is the drain's linearization point: a rule committed after it runs
    does not participate in that tick. NULL predicate JSON becomes a rule with no
    constraints; invalid or kind-mismatched JSON is logged and omitted.
    """
    rows = await session.execute(
        _live_rules(
            models.ProjectEvaluatorTrigger.id,
            models.ProjectEvaluatorTrigger.criteria_id,
            models.ProjectEvaluatorCriteria.project_id,
            models.ProjectEvaluatorCriteria.evaluation_target,
            models.ProjectEvaluatorTrigger.event_kind,
            _raw_predicates,
        )
    )
    rules: list[TriggerRule] = []
    for row in rows:
        valid, predicates = _validated_predicates(row.id, row.event_kind, row.predicates)
        if not valid:
            continue
        annotation_predicates = predicates or AnnotationPredicates(type="annotation_upserted")
        if not isinstance(annotation_predicates, AnnotationPredicates):
            continue
        rules.append(
            AnnotationTriggerRule(
                trigger_id=row.id,
                criteria_id=row.criteria_id,
                project_id=row.project_id,
                evaluation_target=row.evaluation_target,
                **annotation_predicates.model_dump(exclude={"type"}),
            )
        )
    return tuple(sorted(rules, key=lambda rule: rule.trigger_id))
