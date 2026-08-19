from datetime import datetime, timezone
from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.log import (
    AnnotationUpserted,
    DrainedEvent,
    EvaluationCompleted,
    Event,
)
from phoenix.server.online_eval.triggering.matching import RequestKey, match_events
from phoenix.server.online_eval.triggering.rules import (
    AnnotationTriggerRule,
    EvaluationTriggerRule,
)

_NOTICED_AT = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)
_PROJECT_ID = 1
_SESSION_ROWID = 10


def _drained(
    event: Event,
    *,
    event_id: int = 1,
    project_id: int = _PROJECT_ID,
    evaluation_target: models.EvaluationTarget = "SESSION",
) -> DrainedEvent:
    return DrainedEvent(
        event_id=event_id,
        kind=event.kind,
        occurrence_key=event.occurrence_key,
        project_id=project_id,
        evaluation_target=evaluation_target,
        target_rowid=_SESSION_ROWID,
        payload=event.payload(),
        created_at=_NOTICED_AT,
    )


def _annotation(
    *,
    event_id: int = 1,
    project_id: int = _PROJECT_ID,
    evaluation_target: models.EvaluationTarget = "SESSION",
    name: str = "human-review",
    label: Optional[str] = "incorrect",
    score: Optional[float] = None,
    annotator_kind: Optional[str] = "HUMAN",
    change: models.AnnotationChange = "created",
    annotation_target: models.AnnotationTarget = "span",
    criteria_id: Optional[int] = None,
) -> DrainedEvent:
    return _drained(
        AnnotationUpserted(
            annotation_target=annotation_target,
            annotation_id=event_id,
            target_rowid=event_id,
            change=change,
            updated_at=_NOTICED_AT,
            name=name,
            label=label,
            score=score,
            annotator_kind=annotator_kind,  # type: ignore[arg-type]
            criteria_id=criteria_id,
        ),
        event_id=event_id,
        project_id=project_id,
        evaluation_target=evaluation_target,
    )


def _completion(
    *,
    event_id: int = 1,
    criteria_id: int,
    label: Optional[str] = "hallucinated",
    result_changed: bool = True,
) -> DrainedEvent:
    return _drained(
        EvaluationCompleted(
            work_unit_kind="session",
            work_unit_id=event_id,
            criteria_id=criteria_id,
            evaluator_name="hallucination",
            name="hallucination",
            label=label,
            result_changed=result_changed,
        ),
        event_id=event_id,
    )


def _rule(
    *,
    trigger_id: int = 1,
    criteria_id: int = 100,
    project_id: int = _PROJECT_ID,
    evaluation_target: models.EvaluationTarget = "SESSION",
    **predicates: Any,
) -> AnnotationTriggerRule:
    return AnnotationTriggerRule(
        trigger_id=trigger_id,
        criteria_id=criteria_id,
        project_id=project_id,
        evaluation_target=evaluation_target,
        **predicates,
    )


def _completion_rule(
    *,
    trigger_id: int = 1,
    criteria_id: int = 100,
    project_id: int = _PROJECT_ID,
    **predicates: Any,
) -> EvaluationTriggerRule:
    return EvaluationTriggerRule(
        trigger_id=trigger_id,
        criteria_id=criteria_id,
        project_id=project_id,
        evaluation_target="SESSION",
        **predicates,
    )


def _key(*, event_id: int, criteria_id: int) -> RequestKey:
    return RequestKey(
        event_id=event_id,
        evaluation_target="SESSION",
        target_rowid=_SESSION_ROWID,
        criteria_id=criteria_id,
    )


def test_an_event_resolves_to_the_criteria_of_every_rule_that_matches_it() -> None:
    event = _annotation()
    assert match_events(
        [event],
        [
            _rule(trigger_id=1, criteria_id=100, name="human-review"),
            _rule(trigger_id=2, criteria_id=200, label="incorrect"),
            _rule(trigger_id=3, criteria_id=300, label="correct"),
        ],
    ) == (
        _key(event_id=1, criteria_id=100),
        _key(event_id=1, criteria_id=200),
    )


def test_no_rules_means_no_matches() -> None:
    assert match_events([_annotation()], []) == ()


def test_two_rules_on_one_criteria_resolve_to_one_key_per_occurrence() -> None:
    rules = [
        _rule(trigger_id=1, criteria_id=100, name="human-review"),
        _rule(trigger_id=2, criteria_id=100, label="incorrect"),
    ]
    assert match_events([_annotation(event_id=1)], rules) == (_key(event_id=1, criteria_id=100),)
    assert match_events([_annotation(event_id=1), _annotation(event_id=2)], rules) == (
        _key(event_id=1, criteria_id=100),
        _key(event_id=2, criteria_id=100),
    )


def test_an_unconstrained_rule_fires_on_every_event_of_its_kind_in_its_project() -> None:
    rule = _rule()
    assert len(match_events([_annotation(event_id=1), _annotation(event_id=2)], [rule])) == 2
    assert match_events([_completion(event_id=3, criteria_id=999)], [rule]) == ()


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


def test_an_evaluator_written_annotation_needs_the_opt_in_and_never_its_own_author() -> None:
    written_by_another = _annotation(criteria_id=101)
    assert match_events([written_by_another], [_rule(criteria_id=100)]) == ()
    assert (
        match_events(
            [written_by_another],
            [_rule(criteria_id=100, matches_evaluator_annotations=True)],
        )
        != ()
    )
    written_by_itself = _annotation(criteria_id=100)
    assert (
        match_events(
            [written_by_itself],
            [_rule(criteria_id=100, matches_evaluator_annotations=True)],
        )
        == ()
    )


def test_a_rule_declines_the_verdict_its_own_criteria_authored() -> None:
    rule = _completion_rule(criteria_id=100)
    assert match_events([_completion(criteria_id=100)], [rule]) == ()
    assert match_events([_completion(criteria_id=101)], [rule]) != ()


def test_evaluation_predicates_select_the_author_and_the_changed_result() -> None:
    rule = _completion_rule(criteria_id=100, source_criteria_id=101)
    assert match_events([_completion(criteria_id=101)], [rule]) != ()
    assert match_events([_completion(criteria_id=102)], [rule]) == ()

    changed_only = _completion_rule(criteria_id=100, result_changed_only=True)
    assert match_events([_completion(criteria_id=101, result_changed=True)], [changed_only]) != ()
    assert match_events([_completion(criteria_id=101, result_changed=False)], [changed_only]) == ()
