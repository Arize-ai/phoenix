"""Evaluate trigger-rule predicates purely in memory over drained events."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.log import DrainedEvent
from phoenix.server.online_eval.triggering.rules import TriggerRule


@dataclass(frozen=True)
class RequestKey:
    """One occurrence demanding one pair be evaluated."""

    event_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    criteria_id: int


def match_events(
    events: Iterable[DrainedEvent],
    rules: Iterable[TriggerRule],
) -> tuple[RequestKey, ...]:
    """Resolve which pairs these events demand, in a deterministic order."""
    by_project_and_kind: dict[tuple[int, str], list[TriggerRule]] = defaultdict(list)
    for rule in rules:
        by_project_and_kind[(rule.project_id, rule.event_kind)].append(rule)
    keys = {
        RequestKey(
            event_id=event.event_id,
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
                key.event_id,
            ),
        )
    )


def _matches(event: DrainedEvent, rule: TriggerRule) -> bool:
    if event.evaluation_target != rule.evaluation_target:
        return False
    return _matches_annotation(event.payload, rule)


def _matches_result(
    payload: dict[str, Any],
    *,
    name: Optional[str],
    label: Optional[str],
    score_below: Optional[float],
    score_above: Optional[float],
) -> bool:
    if name is not None and payload.get("name") != name:
        return False
    if label is not None and payload.get("label") != label:
        return False
    score = payload.get("score")
    if score_below is not None and not (score is not None and score < score_below):
        return False
    if score_above is not None and not (score is not None and score > score_above):
        return False
    return True


def _matches_annotation(payload: dict[str, Any], rule: TriggerRule) -> bool:
    if not _matches_result(
        payload,
        name=rule.name,
        label=rule.label,
        score_below=rule.score_below,
        score_above=rule.score_above,
    ):
        return False
    if rule.annotator_kind is not None and payload.get("annotator_kind") != rule.annotator_kind:
        return False
    if rule.annotation_change is not None and payload.get("change") != rule.annotation_change:
        return False
    if (
        rule.annotation_target is not None
        and payload.get("annotation_target") != rule.annotation_target
    ):
        return False
    return True
