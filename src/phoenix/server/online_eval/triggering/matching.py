"""Matches drained signals against trigger rules, in memory and without side effects."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.log import DrainedSignal
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

    signal_id: int
    evaluation_target: models.EvaluationTarget
    target_rowid: int
    project_evaluator_id: int


def match_signals(
    signals: Iterable[DrainedSignal],
    rules: Iterable[TriggerRule],
) -> tuple[RequestKey, ...]:
    """Resolve which pairs these signals demand, in a deterministic order.

    Rules are indexed by the two things a signal must agree with before any predicate is
    worth testing — its project and its kind — so a page is compared against the rules
    that could match it rather than against every rule in the deployment. Nothing caps
    how many rules a deployment holds, and the comparison runs between awaits: the whole
    cross-product would land as an event-loop stall on the API process.
    """
    by_project_and_kind: dict[tuple[int, str], list[TriggerRule]] = defaultdict(list)
    for rule in rules:
        by_project_and_kind[(rule.project_id, rule.signal_kind)].append(rule)
    keys = {
        RequestKey(
            signal_id=signal.signal_id,
            evaluation_target=signal.evaluation_target,
            target_rowid=signal.target_rowid,
            project_evaluator_id=rule.project_evaluator_id,
        )
        for signal in signals
        for rule in by_project_and_kind.get((signal.project_id, signal.kind), ())
        if _matches(signal, rule)
    }
    return tuple(
        sorted(
            keys,
            key=lambda key: (
                key.evaluation_target,
                key.target_rowid,
                key.project_evaluator_id,
                key.signal_id,
            ),
        )
    )


def _matches(signal: DrainedSignal, rule: TriggerRule) -> bool:
    # Project and kind are settled by the index `match_signals` matches through: a rule
    # only ever meets a signal that already agrees with it on both. The other two legs of
    # signal.project == evaluator.project == session.project: the session's project is
    # checked against the project evaluator's by `requests.request_evaluations`, which
    # rejects the pair rather than writing a cross-project request.
    if signal.evaluation_target != rule.evaluation_target:
        return False
    if isinstance(rule, AnnotationTriggerRule):
        return _matches_annotation(signal.payload, rule)
    return _matches_evaluation(signal.payload, rule)


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
    producer_project_evaluator_id = payload.get("project_evaluator_id")
    if producer_project_evaluator_id is not None:
        # A project_evaluators never re-triggers on an annotation it wrote itself, whatever the
        # rule's predicates say; anyone else's output takes an explicit opt-in.
        if producer_project_evaluator_id == rule.project_evaluator_id:
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
    # A project_evaluators never re-triggers on its own verdict, whatever the rule's predicates say.
    if payload.get("project_evaluator_id") == rule.project_evaluator_id:
        return False
    if not _matches_result(
        payload,
        name=rule.name,
        label=rule.label,
        score_below=rule.score_below,
        score_above=rule.score_above,
    ):
        return False
    if rule.source_project_evaluator_id is not None and payload.get("project_evaluator_id") != (
        rule.source_project_evaluator_id
    ):
        return False
    if rule.result_changed_only and not payload.get("result_changed"):
        return False
    return True

