"""Reads for `project_evaluator_triggers`, the rules that say which signals demand work.

This is the only module that knows a signal can cause an evaluation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from phoenix.db import models
from phoenix.db.helpers import exclude_project_evaluators_in_trace_projects
from phoenix.server.online_eval.session_policy import session_project_evaluator_is_schedulable


@dataclass(frozen=True)
class TriggerRule:
    """One live rule, flattened out of its row and its project_evaluators's.

    Every predicate is optional and None means unconstrained, so a rule with all of them
    unset fires on every signal of its kind in its project.
    """

    trigger_id: int
    project_evaluator_id: int
    project_id: int
    signal_kind: models.EvaluatorSignalKind
    annotation_name: Optional[str] = None
    label: Optional[str] = None
    score_below: Optional[float] = None
    score_above: Optional[float] = None
    annotator_kind: Optional[str] = None
    annotation_edge: Optional[models.AnnotationEdge] = None
    annotation_kind: Optional[models.AnnotationKind] = None
    source_evaluator_id: Optional[int] = None
    result_changed_only: bool = False


async def load_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
    """Read every rule that can fire right now, in one statement.

    A trigger is dormant while its project_evaluators is unschedulable, and the dormant ones are
    left out here rather than filtered afterwards. Both exclusions this applies —
    `session_project_evaluator_is_schedulable` and `exclude_project_evaluators_in_trace_projects`
    — already have row-side voices in `session_policy.session_schedulability_reason` and
    `SchedulabilityReason.TARGETS_EVALUATOR_TRACES`, so a surface asking why a trigger
    never fires can answer without re-deriving the rules.

    This statement is the drain's linearization point: a rule committed after it runs
    does not participate in the tick that ran it.
    """
    stmt = exclude_project_evaluators_in_trace_projects(
        select(
            models.ProjectEvaluatorTrigger,
            models.ProjectEvaluator.project_id,
        )
        .join(
            models.ProjectEvaluator,
            models.ProjectEvaluatorTrigger.project_evaluator_id == models.ProjectEvaluator.id,
        )
        .where(session_project_evaluator_is_schedulable(models.ProjectEvaluator))
        .order_by(models.ProjectEvaluatorTrigger.id)
    )
    return tuple(
        TriggerRule(
            trigger_id=trigger.id,
            project_evaluator_id=trigger.project_evaluator_id,
            project_id=project_id,
            signal_kind=trigger.signal_kind,
            annotation_name=trigger.annotation_name,
            label=trigger.label,
            score_below=trigger.score_below,
            score_above=trigger.score_above,
            annotator_kind=trigger.annotator_kind,
            annotation_edge=trigger.annotation_edge,
            annotation_kind=trigger.annotation_kind,
            source_evaluator_id=trigger.source_evaluator_id,
            result_changed_only=trigger.result_changed_only,
        )
        for trigger, project_id in await session.execute(stmt)
    )

