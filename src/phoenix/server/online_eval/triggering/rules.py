"""Reads for `project_evaluator_triggers`, the rules that say which events demand work.

This is the only module that knows an event can cause an evaluation.

Each event kind has its own predicate table and its own rule type here. A new kind is a
new table and a new rule type; the ones already in place do not change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar, Optional, Union

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.db import models
from phoenix.db.helpers import exclude_criteria_targeting_evaluator_traces
from phoenix.server.online_eval.session_policy import session_criteria_is_schedulable


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
    unset fires on every annotation write in its project — except the ones online
    evaluation itself wrote, which need `matches_evaluator_annotations`.
    """

    event_kind: ClassVar[models.EvaluatorEventKind] = "annotation_upserted"

    name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    annotator_kind: Optional[str] = None
    annotation_change: Optional[models.AnnotationChange] = None
    annotation_target: Optional[models.AnnotationTarget] = None
    matches_evaluator_annotations: bool = False


@dataclass(frozen=True)
class EvaluationTriggerRule(_Rule):
    """One live rule on evaluations reaching a verdict.

    Every predicate is optional and None means unconstrained, so a rule with all of them
    unset fires on every verdict in its project except its own criteria's.
    """

    event_kind: ClassVar[models.EvaluatorEventKind] = "evaluation_completed"

    name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    source_criteria_id: Optional[int] = None
    result_changed_only: bool = False


TriggerRule: TypeAlias = Union[AnnotationTriggerRule, EvaluationTriggerRule]


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


async def annotation_rules_exist(session: AsyncSession) -> bool:
    """Whether any live rule fires on annotations at all.

    Annotation writes append events only when one does. Without the gate, turning
    session evaluation on also turns on an event write per annotation write, plus a day
    of retained payload, drained against an empty rule set — an amplification an
    operator never asked for and cannot see.

    Like `load_rules`, this read is a linearization point: a rule committed after it
    does not cause an earlier annotation transaction to append an event.
    """
    stmt = _live_rules(models.ProjectEvaluatorTrigger.id).where(
        models.ProjectEvaluatorTrigger.event_kind == "annotation_upserted"
    )
    return await session.scalar(stmt.limit(1)) is not None


async def evaluation_rules_exist(session: AsyncSession) -> bool:
    """Whether any live rule fires on completed evaluations at all.

    Evaluation completion appends events only when one does, matching the annotation
    write seam's no-cost-without-rules behavior. The read is in the work completion
    transaction, so a rule committed afterwards does not retroactively receive the event.
    """
    stmt = _live_rules(models.ProjectEvaluatorTrigger.id).where(
        models.ProjectEvaluatorTrigger.event_kind == "evaluation_completed"
    )
    return await session.scalar(stmt.limit(1)) is not None


async def evaluator_annotation_rules_exist(session: AsyncSession) -> bool:
    """Whether any live rule asks to match annotations online evaluation wrote.

    Online evaluation announces its own annotation writes only when one does, on the
    same no-cost-without-rules footing as `annotation_rules_exist`. Whether a given rule
    wants a given one of those writes is the matcher's question, not this one's.
    """
    stmt = (
        _live_rules(models.ProjectEvaluatorTrigger.id)
        .join(
            models.ProjectEvaluatorTriggerAnnotationPredicates,
            models.ProjectEvaluatorTriggerAnnotationPredicates.trigger_id
            == models.ProjectEvaluatorTrigger.id,
        )
        .where(
            models.ProjectEvaluatorTriggerAnnotationPredicates.matches_evaluator_annotations.is_(
                True
            )
        )
    )
    return await session.scalar(stmt.limit(1)) is not None


async def load_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
    """Read every rule that can fire right now, one statement per event kind.

    These statements are the drain's linearization point: a rule committed after they
    run does not participate in the tick that ran them. A trigger with no predicate row
    is a rule with no constraints, which is why each family is read through an outer
    join and its columns come back NULL.
    """
    annotation_predicates = models.ProjectEvaluatorTriggerAnnotationPredicates
    annotation_rows = await session.execute(
        _live_rules(
            models.ProjectEvaluatorTrigger.id,
            models.ProjectEvaluatorTrigger.criteria_id,
            models.ProjectEvaluatorCriteria.project_id,
            models.ProjectEvaluatorCriteria.evaluation_target,
            annotation_predicates.name,
            annotation_predicates.label,
            annotation_predicates.score_below,
            annotation_predicates.score_above,
            annotation_predicates.annotator_kind,
            annotation_predicates.annotation_change,
            annotation_predicates.annotation_target,
            annotation_predicates.matches_evaluator_annotations,
        )
        .outerjoin(
            annotation_predicates,
            annotation_predicates.trigger_id == models.ProjectEvaluatorTrigger.id,
        )
        .where(models.ProjectEvaluatorTrigger.event_kind == "annotation_upserted")
    )
    evaluation_predicates = models.ProjectEvaluatorTriggerEvaluationPredicates
    evaluation_rows = await session.execute(
        _live_rules(
            models.ProjectEvaluatorTrigger.id,
            models.ProjectEvaluatorTrigger.criteria_id,
            models.ProjectEvaluatorCriteria.project_id,
            models.ProjectEvaluatorCriteria.evaluation_target,
            evaluation_predicates.name,
            evaluation_predicates.label,
            evaluation_predicates.score_below,
            evaluation_predicates.score_above,
            evaluation_predicates.source_criteria_id,
            evaluation_predicates.result_changed_only,
        )
        .outerjoin(
            evaluation_predicates,
            evaluation_predicates.trigger_id == models.ProjectEvaluatorTrigger.id,
        )
        .where(models.ProjectEvaluatorTrigger.event_kind == "evaluation_completed")
    )
    rules: list[TriggerRule] = [
        AnnotationTriggerRule(
            trigger_id=row.id,
            criteria_id=row.criteria_id,
            project_id=row.project_id,
            evaluation_target=row.evaluation_target,
            name=row.name,
            label=row.label,
            score_below=row.score_below,
            score_above=row.score_above,
            annotator_kind=row.annotator_kind,
            annotation_change=row.annotation_change,
            annotation_target=row.annotation_target,
            matches_evaluator_annotations=bool(row.matches_evaluator_annotations),
        )
        for row in annotation_rows
    ]
    rules.extend(
        EvaluationTriggerRule(
            trigger_id=row.id,
            criteria_id=row.criteria_id,
            project_id=row.project_id,
            evaluation_target=row.evaluation_target,
            name=row.name,
            label=row.label,
            score_below=row.score_below,
            score_above=row.score_above,
            source_criteria_id=row.source_criteria_id,
            result_changed_only=bool(row.result_changed_only),
        )
        for row in evaluation_rows
    )
    return tuple(sorted(rules, key=lambda rule: rule.trigger_id))
