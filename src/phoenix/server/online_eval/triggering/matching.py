"""Matches drained signals against trigger rules, in memory and without side effects."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from phoenix.server.online_eval.triggering.log import DrainedSignal
from phoenix.server.online_eval.triggering.rules import TriggerRule


@dataclass(frozen=True)
class RequestKey:
    """One occurrence demanding one pair be evaluated.

    Several rules matching the same occurrence for the same pair resolve to one key, so
    they ask for one evaluation between them; two occurrences for that pair are two keys.
    """

    signal_id: int
    project_session_rowid: int
    criteria_id: int


def match_signals(
    signals: Iterable[DrainedSignal],
    rules: Iterable[TriggerRule],
) -> tuple[RequestKey, ...]:
    """Resolve which pairs these signals demand, in a deterministic order."""
    rules = tuple(rules)
    keys = {
        RequestKey(
            signal_id=signal.signal_id,
            project_session_rowid=signal.project_session_rowid,
            criteria_id=rule.criteria_id,
        )
        for signal in signals
        for rule in rules
        if _matches(signal, rule)
    }
    return tuple(
        sorted(keys, key=lambda key: (key.project_session_rowid, key.criteria_id, key.signal_id))
    )


def _matches(signal: DrainedSignal, rule: TriggerRule) -> bool:
    if rule.signal_kind != signal.kind:
        return False
    # The other two legs of signal.project == criteria.project == session.project: the
    # session's project is checked against the criteria's by `requests.request_evaluations`,
    # which rejects the pair rather than writing a cross-project request.
    if rule.project_id != signal.project_id:
        return False
    payload = signal.payload
    if rule.annotation_name is not None and payload.get("name") != rule.annotation_name:
        return False
    if rule.label is not None and payload.get("label") != rule.label:
        return False
    score = payload.get("score")
    if rule.score_below is not None and not (score is not None and score < rule.score_below):
        return False
    if rule.score_above is not None and not (score is not None and score > rule.score_above):
        return False
    if signal.kind == "annotation_upserted":
        return _matches_annotation(payload, rule)
    if signal.kind == "evaluation_completed":
        return _matches_evaluation(payload, rule)
    return False


def _matches_annotation(payload: dict[str, Any], rule: TriggerRule) -> bool:
    if rule.annotator_kind is not None and payload.get("annotator_kind") != rule.annotator_kind:
        return False
    if rule.annotation_edge is not None and payload.get("edge") != rule.annotation_edge:
        return False
    if rule.annotation_kind is not None and payload.get("annotation_kind") != rule.annotation_kind:
        return False
    return True


def _matches_evaluation(payload: dict[str, Any], rule: TriggerRule) -> bool:
    # A criteria never re-triggers on its own verdict, whatever the rule's predicates say.
    if payload.get("criteria_id") == rule.criteria_id:
        return False
    if rule.source_evaluator_id is not None and payload.get("criteria_id") != (
        rule.source_evaluator_id
    ):
        return False
    if rule.result_changed_only and not payload.get("result_changed"):
        return False
    return True
