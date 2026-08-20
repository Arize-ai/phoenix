"""Evaluate trigger-rule predicates purely in memory over annotation writes."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import ClassVar, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.rules import TriggerRule


@dataclass(frozen=True)
class AnnotationEvent:
    """An annotation as it stood when it was written, with the entity it routes to.
    `target_rowid` is that entity's rowid, not the annotated one's."""

    kind: ClassVar[models.EvaluatorEventKind] = "annotation_upserted"

    annotation_id: int
    annotation_target: models.AnnotationTarget
    project_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    change: models.AnnotationChange
    name: str
    label: Optional[str] = None
    score: Optional[float] = None
    annotator_kind: Optional[str] = None


@dataclass(frozen=True)
class RequestKey:
    """One occurrence demanding one pair be evaluated."""

    annotation_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    criteria_id: int


def match_events(
    events: Iterable[AnnotationEvent],
    rules: Iterable[TriggerRule],
) -> tuple[RequestKey, ...]:
    """Resolve which pairs these events demand, in a deterministic order."""
    by_project_and_kind: dict[tuple[int, str], list[TriggerRule]] = defaultdict(list)
    for rule in rules:
        by_project_and_kind[(rule.project_id, rule.event_kind)].append(rule)
    keys = {
        RequestKey(
            annotation_id=event.annotation_id,
            evaluation_target=event.evaluation_target,
            target_rowid=event.target_rowid,
            criteria_id=rule.criteria_id,
        )
        for event in events
        for rule in by_project_and_kind.get((event.project_id, event.kind), ())
        if _matches(event, rule)
    }
    return tuple(
        sorted(
            keys,
            key=lambda key: (
                key.evaluation_target,
                key.target_rowid,
                key.criteria_id,
                key.annotation_id,
            ),
        )
    )


def _matches(event: AnnotationEvent, rule: TriggerRule) -> bool:
    if event.evaluation_target != rule.evaluation_target:
        return False
    if rule.name is not None and event.name != rule.name:
        return False
    if rule.label is not None and event.label != rule.label:
        return False
    if rule.score_below is not None and not (
        event.score is not None and event.score < rule.score_below
    ):
        return False
    if rule.score_above is not None and not (
        event.score is not None and event.score > rule.score_above
    ):
        return False
    if rule.annotator_kind is not None and event.annotator_kind != rule.annotator_kind:
        return False
    if rule.annotation_change is not None and event.change != rule.annotation_change:
        return False
    if rule.annotation_target is not None and event.annotation_target != rule.annotation_target:
        return False
    return True
