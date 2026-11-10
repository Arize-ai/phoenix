"""Controls for the two judge-alignment verifiers."""

from __future__ import annotations

import base64
from typing import Any

import pytest
from phoenix.evals import Score

from harbor_verifiers import trail_truth
from harbor_verifiers.evals_state import Experiment, PromptVersion, confusion
from harbor_verifiers.judge_alignment import Candidate
from harbor_verifiers.trail_truth import TraceFacts

from .fakes import START, Recorder, load_check

agreement_check = load_check("judge-agreement", "check_judge_agreement")
holdout_check = load_check("judge-improve-holdout", "check_judge_holdout")


def _facts() -> dict[str, TraceFacts]:
    return {
        f"t{i}": TraceFacts(
            trace_id=f"t{i}",
            span_ids=frozenset({f"s{i}"}),
            question=f"find the population of city number {i} in the census tables please",
            labeled=i < 100,
            error_categories=frozenset({"Goal Deviation"} if i % 3 == 0 else {"Formatting Errors"}),
            uses_search_agent=False,
            llm_spans=3,
        )
        for i in range(110)
    }


FACTS = _facts()


def _predictions(traces: list[str], flip_every: int) -> dict[str, bool]:
    return {t: FACTS[t].goal_deviation != (int(t[1:]) % flip_every == 0) for t in traces}


def _experiment(rowid: int) -> Experiment:
    encoded = base64.b64encode(f"Experiment:{rowid}".encode()).decode()
    return Experiment(id=encoded, name=f"e{rowid}", created_at=START, metadata={}, runs=[])


def _stub_judge(expected_text: str) -> Any:
    def judge(reply: str, reference: str, notes: str = "") -> Score:
        return Score(
            name="m",
            score=float(expected_text in reference and expected_text in reply),
            explanation="stub",
        )

    return judge


def _figures(predictions: dict[str, bool]) -> str:
    matrix = confusion((p, FACTS[t].goal_deviation) for t, p in predictions.items())
    return f"'tp': {matrix.tp}, 'fp': {matrix.fp}"


def _run_agreement(
    monkeypatch: pytest.MonkeyPatch, candidates: list[Candidate], reply: str, expected_text: str
) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(trail_truth, "traces", lambda: FACTS)
    monkeypatch.setattr(agreement_check, "annotation_candidates", lambda: candidates)
    monkeypatch.setattr(agreement_check, "experiment_candidates", lambda: [])
    monkeypatch.setattr(agreement_check, "read_reply", lambda *a: (reply, "trajectory"))
    monkeypatch.setattr(agreement_check, "matches_reference", _stub_judge(expected_text))
    monkeypatch.setattr(agreement_check, "write_reward", recorder)
    agreement_check.main()
    return recorder


LABELED = [f"t{i}" for i in range(100)]


def test_judge_with_f1_reported_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    predictions = _predictions(LABELED, 5)
    figures = _figures(predictions)
    candidate = Candidate("annotation:judge", predictions, llm_kind=True)
    result = _run_agreement(monkeypatch, [candidate], f"precision and recall... {figures}", figures)
    assert result.reward == 1.0, result.details


def test_accuracy_only_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    predictions = _predictions(LABELED, 5)
    figures = _figures(predictions)
    candidate = Candidate("annotation:judge", predictions, llm_kind=True)
    result = _run_agreement(monkeypatch, [candidate], f"Accuracy is 80%. {figures}", figures)
    assert result.scores["outcome_class_aware_metrics"] == 0.0
    assert result.reward == 0.0


def test_too_few_traces_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    candidate = Candidate("annotation:judge", _predictions(LABELED[:20], 5), llm_kind=True)
    assert _run_agreement(monkeypatch, [candidate], "precision 0.8", "x").reward == 0.0


def test_dataset_with_unlabeled_traces_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    traces = [f"t{i}" for i in range(110)]
    predictions = _predictions(traces, 5)
    figures = _figures({t: p for t, p in predictions.items() if FACTS[t].labeled})
    candidate = Candidate(
        "experiment:x:output:label", predictions, True, _experiment(1), frozenset(traces)
    )
    result = _run_agreement(monkeypatch, [candidate], f"recall {figures}", figures)
    assert result.scores["outcome_no_unlabeled_in_dataset"] == 0.0


def _run_holdout(
    monkeypatch: pytest.MonkeyPatch,
    candidates: list[Candidate],
    prompt: str,
    reply: str,
    expected_text: str,
) -> Recorder:
    recorder = Recorder()
    monkeypatch.setattr(trail_truth, "traces", lambda: FACTS)
    monkeypatch.setattr(holdout_check, "experiment_candidates", lambda: candidates)
    monkeypatch.setattr(
        holdout_check,
        "prompt_versions",
        lambda name: [PromptVersion("v", None, prompt)] if prompt else [],
    )
    monkeypatch.setattr(holdout_check, "read_reply", lambda *a: (reply, "trajectory"))
    monkeypatch.setattr(holdout_check, "matches_reference", _stub_judge(expected_text))
    monkeypatch.setattr(holdout_check, "write_reward", recorder)
    holdout_check.main()
    return recorder


DEV = [f"t{i}" for i in range(100) if i % 4]
TEST = [f"t{i}" for i in range(100) if i % 4 == 0]
GOOD_PROMPT = (
    "Decide whether the agent pursued the user's stated goal. Answer deviation or on_track."
)


def _candidate(traces: list[str], rowid: int, flip_every: int) -> Candidate:
    return Candidate(
        f"experiment:e{rowid}:output:label",
        _predictions(traces, flip_every),
        True,
        _experiment(rowid),
        frozenset(traces),
    )


def test_dev_tuning_and_one_test_run_pass(monkeypatch: pytest.MonkeyPatch) -> None:
    final = _candidate(TEST, 3, 7)
    figures = _figures(final.predictions)
    candidates = [_candidate(DEV, 1, 3), _candidate(DEV, 2, 7), final]
    result = _run_holdout(monkeypatch, candidates, GOOD_PROMPT, f"held-out {figures}", figures)
    assert result.reward == 1.0, result.details
    assert result.scores["practice_single_holdout_look"] == 1.0


def test_tuning_on_all_labeled_traces_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    final = _candidate(LABELED, 2, 7)
    figures = _figures(final.predictions)
    result = _run_holdout(
        monkeypatch, [_candidate(LABELED, 1, 3), final], GOOD_PROMPT, figures, figures
    )
    assert result.reward == 0.0
    assert result.scores["outcome_held_out_set"] == 0.0


def test_leaked_held_out_question_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    final = _candidate(TEST, 3, 7)
    figures = _figures(final.predictions)
    leaky = GOOD_PROMPT + " Example: " + FACTS[TEST[0]].question
    result = _run_holdout(monkeypatch, [_candidate(DEV, 1, 3), final], leaky, figures, figures)
    assert result.scores["outcome_no_leakage"] == 0.0
    assert result.reward == 0.0


def test_unchanged_prompt_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    final = _candidate(TEST, 3, 7)
    figures = _figures(final.predictions)
    result = _run_holdout(
        monkeypatch, [_candidate(DEV, 1, 3), final], holdout_check.START_PROMPT, figures, figures
    )
    assert result.reward == 0.0
