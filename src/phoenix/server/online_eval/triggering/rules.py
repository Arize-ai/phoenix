"""Load live, schema-validated rule shapes that say which events demand work."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, ClassVar, Optional

from pydantic import ValidationError
from sqlalchemy import Select, select, type_coerce
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import exclude_project_evaluators_in_trace_projects
from phoenix.db.types.evaluator_trigger_predicates import (
    AnnotationPredicates,
    TriggerPredicates,
    TriggerPredicatesType,
)
from phoenix.server.online_eval.session_policy import session_project_evaluator_is_schedulable

logger = logging.getLogger(__name__)

_raw_predicates = type_coerce(
    models.ProjectEvaluatorTrigger.__table__.c.predicates,
    models.JSON_,
).label("predicates")


@dataclass(frozen=True)
class _Rule:
    """What every live rule carries, whatever it matches on. `evaluation_target` is the
    project_evaluators's, and an event only matches a rule routing to the same kind of entity."""

    trigger_id: int
    project_evaluator_id: int
    project_id: int
    evaluation_target: models.EvaluationTarget


@dataclass(frozen=True)
class AnnotationTriggerRule(_Rule):
    """One live rule on annotation writes; None means unconstrained."""

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
    """Select ``selected`` from the rules that can fire right now."""
    return exclude_project_evaluators_in_trace_projects(
        select(*selected)
        .join(
            models.ProjectEvaluator,
            models.ProjectEvaluatorTrigger.project_evaluator_id == models.ProjectEvaluator.id,
        )
        .where(session_project_evaluator_is_schedulable(models.ProjectEvaluator))
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
            models.ProjectEvaluator.project_id == project_id,
            models.ProjectEvaluatorTrigger.event_kind == event_kind,
        )
    )
    return any(_validated_predicates(row.id, row.event_kind, row.predicates)[0] for row in rows)


async def annotation_rules_exist(session: AsyncSession, *, project_id: int) -> bool:
    """Whether any valid live rule fires on annotations in the project; annotation writes
    load rules only when one does."""
    return await _rules_exist_for_event_kind(session, "annotation_upserted", project_id)


async def load_rules(
    session: AsyncSession,
    *,
    project_ids: Iterable[int],
) -> tuple[TriggerRule, ...]:
    """Read every valid rule that can fire right now in `project_ids`; invalid JSON is
    logged and omitted."""
    ids = sorted(set(project_ids))
    if not ids:
        return ()
    rows = await session.execute(
        _live_rules(
            models.ProjectEvaluatorTrigger.id,
            models.ProjectEvaluatorTrigger.project_evaluator_id,
            models.ProjectEvaluator.project_id,
            models.ProjectEvaluator.evaluation_target,
            models.ProjectEvaluatorTrigger.event_kind,
            _raw_predicates,
        ).where(models.ProjectEvaluator.project_id.in_(ids))
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
                project_evaluator_id=row.project_evaluator_id,
                project_id=row.project_id,
                evaluation_target=row.evaluation_target,
                **annotation_predicates.model_dump(exclude={"type"}),
            )
        )
    return tuple(sorted(rules, key=lambda rule: rule.trigger_id))
