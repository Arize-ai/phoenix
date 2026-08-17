from datetime import datetime, timezone
from typing import Any, Optional

from phoenix.db import models
from phoenix.server.online_eval.triggering.log import (
    AnnotationUpserted,
    DrainedSignal,
    EvaluationCompleted,
    Signal,
)
from phoenix.server.online_eval.triggering.matching import RequestKey, match_signals
from phoenix.server.online_eval.triggering.rules import TriggerRule

_NOTICED_AT = datetime(2026, 8, 17, 12, 0, tzinfo=timezone.utc)
_PROJECT_ID = 1
_SESSION_ROWID = 10


def _drained(signal: Signal, *, signal_id: int = 1, project_id: int = _PROJECT_ID) -> DrainedSignal:
    return DrainedSignal(
        signal_id=signal_id,
        kind=signal.kind,
        dedup_key=signal.dedup_key,
        project_id=project_id,
        project_session_rowid=_SESSION_ROWID,
        payload=signal.payload(),
        created_at=_NOTICED_AT,
    )


def _annotation(
    *,
    signal_id: int = 1,
    project_id: int = _PROJECT_ID,
    name: str = "human-review",
    label: Optional[str] = "incorrect",
    score: Optional[float] = None,
    annotator_kind: Optional[str] = "HUMAN",
    change: models.AnnotationChange = "created",
    annotation_target: models.AnnotationTarget = "span",
) -> DrainedSignal:
    return _drained(
        AnnotationUpserted(
            annotation_target=annotation_target,
            annotation_id=signal_id,
            target_rowid=signal_id,
            change=change,
            updated_at=_NOTICED_AT,
            name=name,
            label=label,
            score=score,
            annotator_kind=annotator_kind,  # type: ignore[arg-type]
        ),
        signal_id=signal_id,
        project_id=project_id,
    )


def _completion(
    *,
    signal_id: int = 1,
    project_evaluator_id: int,
    label: Optional[str] = "hallucinated",
    result_changed: bool = True,
) -> DrainedSignal:
    return _drained(
        EvaluationCompleted(
            work_unit_kind="session",
            work_unit_id=signal_id,
            project_evaluator_id=project_evaluator_id,
            evaluator_name="hallucination",
            name="hallucination",
            label=label,
            result_changed=result_changed,
        ),
        signal_id=signal_id,
    )


def _rule(
    *,
    trigger_id: int = 1,
    project_evaluator_id: int = 100,
    project_id: int = _PROJECT_ID,
    signal_kind: models.EvaluatorSignalKind = "annotation_upserted",
    **predicates: Any,
) -> TriggerRule:
    return TriggerRule(
        trigger_id=trigger_id,
        project_evaluator_id=project_evaluator_id,
        project_id=project_id,
        signal_kind=signal_kind,
        **predicates,
    )


def test_a_signal_resolves_to_the_criteria_of_every_rule_that_matches_it() -> None:
    signal = _annotation()
    assert match_signals(
        [signal],
        [
            _rule(trigger_id=1, project_evaluator_id=100, annotation_name="human-review"),
            _rule(trigger_id=2, project_evaluator_id=200, label="incorrect"),
            _rule(trigger_id=3, project_evaluator_id=300, label="correct"),
        ],
    ) == (
        RequestKey(signal_id=1, project_session_rowid=_SESSION_ROWID, project_evaluator_id=100),
        RequestKey(signal_id=1, project_session_rowid=_SESSION_ROWID, project_evaluator_id=200),
    )


def test_no_rules_means_no_matches() -> None:
    assert match_signals([_annotation()], []) == ()


def test_two_rules_on_one_criteria_resolve_to_one_key_per_occurrence() -> None:
    rules = [
        _rule(trigger_id=1, project_evaluator_id=100, annotation_name="human-review"),
        _rule(trigger_id=2, project_evaluator_id=100, label="incorrect"),
    ]
    assert match_signals([_annotation(signal_id=1)], rules) == (
        RequestKey(signal_id=1, project_session_rowid=_SESSION_ROWID, project_evaluator_id=100),
    )
    assert match_signals([_annotation(signal_id=1), _annotation(signal_id=2)], rules) == (
        RequestKey(signal_id=1, project_session_rowid=_SESSION_ROWID, project_evaluator_id=100),
        RequestKey(signal_id=2, project_session_rowid=_SESSION_ROWID, project_evaluator_id=100),
    )


def test_an_unconstrained_rule_fires_on_every_signal_of_its_kind_in_its_project() -> None:
    rule = _rule(signal_kind="annotation_upserted")
    assert len(match_signals([_annotation(signal_id=1), _annotation(signal_id=2)], [rule])) == 2
    assert match_signals([_completion(signal_id=3, project_evaluator_id=999)], [rule]) == ()


def test_a_rule_in_another_project_never_matches() -> None:
    assert match_signals([_annotation(project_id=2)], [_rule(project_id=1)]) == ()


def test_score_bounds_conjoin_and_a_null_score_matches_neither() -> None:
    bounded = _rule(score_above=0.2, score_below=0.8)
    assert match_signals([_annotation(score=0.5)], [bounded]) != ()
    assert match_signals([_annotation(score=0.9)], [bounded]) == ()
    assert match_signals([_annotation(score=0.1)], [bounded]) == ()
    assert match_signals([_annotation(score=None)], [bounded]) == ()
    assert match_signals([_annotation(score=None)], [_rule(score_below=0.8)]) == ()


def test_annotation_predicates_match_the_edge_the_signal_carries() -> None:
    signal = _annotation(change="updated", annotation_target="session", annotator_kind="LLM")
    assert match_signals([signal], [_rule(annotation_change="updated")]) != ()
    assert match_signals([signal], [_rule(annotation_change="created")]) == ()
    assert match_signals([signal], [_rule(annotation_target="session")]) != ()
    assert match_signals([signal], [_rule(annotation_target="span")]) == ()
    assert match_signals([signal], [_rule(annotator_kind="LLM")]) != ()
    assert match_signals([signal], [_rule(annotator_kind="HUMAN")]) == ()


def test_a_rule_declines_the_verdict_its_own_project_evaluator_authored() -> None:
    rule = _rule(project_evaluator_id=100, signal_kind="evaluation_completed")
    assert match_signals([_completion(project_evaluator_id=100)], [rule]) == ()
    assert match_signals([_completion(project_evaluator_id=101)], [rule]) != ()


def test_evaluation_predicates_select_the_author_and_the_changed_result() -> None:
    rule = _rule(project_evaluator_id=100, signal_kind="evaluation_completed", source_project_evaluator_id=101)
    assert match_signals([_completion(project_evaluator_id=101)], [rule]) != ()
    assert match_signals([_completion(project_evaluator_id=102)], [rule]) == ()

    changed_only = _rule(
        project_evaluator_id=100, signal_kind="evaluation_completed", result_changed_only=True
    )
    assert match_signals([_completion(project_evaluator_id=101, result_changed=True)], [changed_only]) != ()
    assert match_signals([_completion(project_evaluator_id=101, result_changed=False)], [changed_only]) == ()

