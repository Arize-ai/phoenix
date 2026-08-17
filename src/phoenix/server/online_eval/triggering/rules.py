"""Reads for `project_evaluator_triggers`, the rules that say which signals demand work.

This is the only module that knows a signal can cause an evaluation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from sqlalchemy import Select, select
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
    annotation_change: Optional[models.AnnotationChange] = None
    annotation_target: Optional[models.AnnotationTarget] = None
    source_project_evaluator_id: Optional[int] = None
    result_changed_only: bool = False


def _live_rules(*selected: Any) -> Select[Any]:
    """Select ``selected`` from the rules that can fire right now.

    A trigger is dormant while its project_evaluators is unschedulable, and the dormant ones are
    left out here rather than filtered afterwards. Both exclusions this applies —
    `session_project_evaluator_is_schedulable` and `exclude_project_evaluators_in_trace_projects`
    — already have row-side voices in `session_policy.session_schedulability_reason` and
    `SchedulabilityReason.TARGETS_EVALUATOR_TRACES`, so a surface asking why a trigger
    never fires can answer without re-deriving the rules.
    """
    return exclude_project_evaluators_in_trace_projects(
        select(*selected)
        .join(
            models.ProjectEvaluator,
            models.ProjectEvaluatorTrigger.project_evaluator_id == models.ProjectEvaluator.id,
        )
        .where(session_project_evaluator_is_schedulable(models.ProjectEvaluator))
    )


async def annotation_rules_exist(session: AsyncSession) -> bool:
    """Whether any live rule fires on annotations at all.

    The annotation scan runs only when one does. Without the gate, turning session
    evaluation on also turns on a signal write per annotation write, plus a day of
    retained payload, drained against an empty rule set — an amplification an operator
    never asked for and cannot see.

    Like `load_rules`, this read is a linearization point: a rule committed after it
    does not open the scan for the tick that ran it.
    """
    stmt = _live_rules(models.ProjectEvaluatorTrigger.id).where(
        models.ProjectEvaluatorTrigger.signal_kind == "annotation_upserted"
    )
    return await session.scalar(stmt.limit(1)) is not None


async def load_rules(session: AsyncSession) -> tuple[TriggerRule, ...]:
    """Read every rule that can fire right now, in one statement.

    This statement is the drain's linearization point: a rule committed after it runs
    does not participate in the tick that ran it.
    """
    stmt = _live_rules(
        models.ProjectEvaluatorTrigger,
        models.ProjectEvaluator.project_id,
    ).order_by(models.ProjectEvaluatorTrigger.id)
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
            annotation_change=trigger.annotation_change,
            annotation_target=trigger.annotation_target,
            source_project_evaluator_id=trigger.source_project_evaluator_id,
            result_changed_only=trigger.result_changed_only,
        )
        for trigger, project_id in await session.execute(stmt)
    )

