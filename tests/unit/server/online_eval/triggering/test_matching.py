from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.matching import (
    AnnotationEvent,
    RequestKey,
    match_events,
)
from phoenix.server.online_eval.triggering.rules import AnnotationTriggerRule

_PROJECT_ID = 1
_SESSION_ROWID = 10


def _annotation(
    *,
    annotation_id: int = 1,
    project_id: int = _PROJECT_ID,
    evaluation_target: models.EvaluationTarget = "SESSION",
    name: str = "human-review",
    label: Optional[str] = "incorrect",
    score: Optional[float] = None,
    annotator_kind: Optional[str] = "HUMAN",
    change: models.AnnotationChange = "created",
    annotation_target: models.AnnotationTarget = "span",
) -> AnnotationEvent:
    return AnnotationEvent(
        annotation_id=annotation_id,
        annotation_target=annotation_target,
        project_id=project_id,
        evaluation_target=evaluation_target,
        target_rowid=_SESSION_ROWID,
        change=change,
        name=name,
        label=label,
        score=score,
        annotator_kind=annotator_kind,
    )


def _rule(
    *,
    trigger_id: int = 1,
    project_evaluator_id: int = 100,
    project_id: int = _PROJECT_ID,
    evaluation_target: models.EvaluationTarget = "SESSION",
    **predicates: Any,
) -> AnnotationTriggerRule:
    return AnnotationTriggerRule(
        trigger_id=trigger_id,
        project_evaluator_id=project_evaluator_id,
        project_id=project_id,
        evaluation_target=evaluation_target,
        **predicates,
    )


def _key(*, annotation_id: int, project_evaluator_id: int) -> RequestKey:
    return RequestKey(
        annotation_id=annotation_id,
        evaluation_target="SESSION",
        target_rowid=_SESSION_ROWID,
        project_evaluator_id=project_evaluator_id,
    )


def test_an_event_resolves_to_the_criteria_of_every_rule_that_matches_it() -> None:
    event = _annotation()
    assert match_events(
        [event],
        [
            _rule(trigger_id=1, project_evaluator_id=100, name="human-review"),
            _rule(trigger_id=2, project_evaluator_id=200, label="incorrect"),
            _rule(trigger_id=3, project_evaluator_id=300, label="correct"),
        ],
    ) == (
        _key(annotation_id=1, project_evaluator_id=100),
        _key(annotation_id=1, project_evaluator_id=200),
    )


def test_no_rules_means_no_matches() -> None:
    assert match_events([_annotation()], []) == ()


def test_two_rules_on_one_criteria_resolve_to_one_key_per_occurrence() -> None:
    rules = [
        _rule(trigger_id=1, project_evaluator_id=100, name="human-review"),
        _rule(trigger_id=2, project_evaluator_id=100, label="incorrect"),
    ]
    assert match_events([_annotation(annotation_id=1)], rules) == (_key(annotation_id=1, project_evaluator_id=100),)
    assert match_events([_annotation(annotation_id=1), _annotation(annotation_id=2)], rules) == (
        _key(annotation_id=1, project_evaluator_id=100),
        _key(annotation_id=2, project_evaluator_id=100),
    )


def test_an_unconstrained_rule_fires_on_every_event_in_its_project() -> None:
    rule = _rule()
    assert len(match_events([_annotation(annotation_id=1), _annotation(annotation_id=2)], [rule])) == 2


def test_a_rule_in_another_project_never_matches() -> None:
    assert match_events([_annotation(project_id=2)], [_rule(project_id=1)]) == ()


def test_an_event_routed_to_another_kind_of_entity_never_matches() -> None:
    span_routed = _annotation(evaluation_target="SPAN")
    assert match_events([span_routed], [_rule(evaluation_target="SESSION")]) == ()
    assert match_events([span_routed], [_rule(evaluation_target="SPAN")]) != ()


def test_score_bounds_conjoin_and_a_null_score_matches_neither() -> None:
    bounded = _rule(score_above=0.2, score_below=0.8)
    assert match_events([_annotation(score=0.5)], [bounded]) != ()
    assert match_events([_annotation(score=0.9)], [bounded]) == ()
    assert match_events([_annotation(score=0.1)], [bounded]) == ()
    assert match_events([_annotation(score=None)], [bounded]) == ()
    assert match_events([_annotation(score=None)], [_rule(score_below=0.8)]) == ()


def test_annotation_predicates_match_the_edge_the_event_carries() -> None:
    event = _annotation(change="updated", annotation_target="session", annotator_kind="LLM")
    assert match_events([event], [_rule(annotation_change="updated")]) != ()
    assert match_events([event], [_rule(annotation_change="created")]) == ()
    assert match_events([event], [_rule(annotation_target="session")]) != ()
    assert match_events([event], [_rule(annotation_target="span")]) == ()
    assert match_events([event], [_rule(annotator_kind="LLM")]) != ()
    assert match_events([event], [_rule(annotator_kind="HUMAN")]) == ()


def test_an_evaluator_written_annotation_matches_like_any_other() -> None:
    written_by_an_evaluator = _annotation(annotator_kind="LLM")
    assert match_events([written_by_an_evaluator], [_rule(project_evaluator_id=100)]) != ()
    by_name = _rule(project_evaluator_id=100, name="human-review")
    assert match_events([written_by_an_evaluator], [by_name]) != ()

