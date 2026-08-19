"""Evaluate trigger-rule predicates purely in memory over drained events."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.log import DrainedEvent
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    EvaluationTriggerRule,
    TriggerRule,
)


@dataclass(frozen=True)
class RequestKey:
    """One occurrence demanding one pair be evaluated.

    Several rules matching the same occurrence for the same pair resolve to one key, so
    they ask for one evaluation between them; two occurrences for that pair are two keys.
    """

    event_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    criteria_id: int


def match_events(
    events: Iterable[DrainedEvent],
    rules: Iterable[TriggerRule],
) -> tuple[RequestKey, ...]:
    """Resolve which pairs these events demand, in a deterministic order.

    Rules are indexed by the two things an event must agree with before any predicate is
    worth testing — its project and its kind — so a page is compared against the rules
    that could match it rather than against every rule in the deployment. Nothing caps
    how many rules a deployment holds, and the comparison runs between awaits: the whole
    cross-product would land as an event-loop stall on the API process.
    """
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
    # Project and kind are settled by the index `match_events` matches through: a rule
    # only ever meets an event that already agrees with it on both. The other two legs of
    # event.project == criteria.project == session.project: the session's project is
    # checked against the criteria's by `requests.request_evaluations`, which rejects the
    # pair rather than writing a cross-project request.
    if event.evaluation_target != rule.evaluation_target:
        return False
    if isinstance(rule, AnnotationTriggerRule):
        return _matches_annotation(event.payload, rule)
    return _matches_evaluation(event.payload, rule)


def _matches_result(
    payload: dict[str, Any],
    *,
    name: Optional[str],
    label: Optional[str],
    score_below: Optional[float],
    score_above: Optional[float],
) -> bool:
    """Test the predicates every family spells for itself over what the payload verdicts."""
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


def _matches_annotation(payload: dict[str, Any], rule: AnnotationTriggerRule) -> bool:
    producer_criteria_id = payload.get("criteria_id")
    if producer_criteria_id is not None:
        # Self-refusal blocks direct feedback; session_sweeper's eligibility-identity
        # check and insert re-check are its indirect-cycle twin.
        if producer_criteria_id == rule.criteria_id:
            return False
        if not rule.matches_evaluator_annotations:
            return False
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


def _matches_evaluation(payload: dict[str, Any], rule: EvaluationTriggerRule) -> bool:
    # Self-refusal blocks direct feedback; session_sweeper's eligibility-identity check
    # and insert re-check are its indirect-cycle twin.
    if payload.get("criteria_id") == rule.criteria_id:
        return False
    if not _matches_result(
        payload,
        name=rule.name,
        label=rule.label,
        score_below=rule.score_below,
        score_above=rule.score_above,
    ):
        return False
    if rule.source_criteria_id is not None and payload.get("criteria_id") != (
        rule.source_criteria_id
    ):
        return False
    if rule.result_changed_only and not payload.get("result_changed"):
        return False
    return True
